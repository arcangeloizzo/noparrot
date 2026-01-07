// Lovable Cloud Function: publish-post
// Creates a post with DB-backed idempotency to prevent duplicates on crash/retry

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type PublishPostBody = {
  content: string
  sharedUrl?: string | null
  sharedTitle?: string | null
  previewImg?: string | null
  articleContent?: string | null
  quotedPostId?: string | null
  mediaIds?: string[]
  idempotencyKey?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const reqId = crypto.randomUUID().slice(0, 8)
  console.log(`[publish-post:${reqId}] ← request received`)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('authorization') || ''
    const hasAuth = authHeader.length > 20

    console.log(`[publish-post:${reqId}] hasAuth=${hasAuth}`)

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    let body: PublishPostBody
    try {
      body = (await req.json()) as PublishPostBody
    } catch (parseErr) {
      console.error(`[publish-post:${reqId}] stage=parse_json error`, parseErr)
      return new Response(JSON.stringify({ error: 'invalid_json', stage: 'parse' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (!content) {
      console.error(`[publish-post:${reqId}] stage=validate empty content`)
      return new Response(JSON.stringify({ error: 'content_required', stage: 'validate' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr || !user) {
      console.warn(`[publish-post:${reqId}] stage=auth failed`, userErr?.message || 'no user')
      return new Response(JSON.stringify({ error: 'unauthorized', stage: 'auth', details: userErr?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const idempotencyKey = body.idempotencyKey || null

    console.log(`[publish-post:${reqId}] stage=start`, {
      userId: user.id,
      hasSharedUrl: !!body.sharedUrl,
      mediaCount: Array.isArray(body.mediaIds) ? body.mediaIds.length : 0,
      contentLen: content.length,
      idempotencyKey,
    })

    // IDEMPOTENCY CHECK: Use DB table with unique constraint
    if (idempotencyKey) {
      // First check if this key already exists and has a post_id
      const { data: existing, error: checkErr } = await supabase
        .from('publish_idempotency')
        .select('post_id')
        .eq('user_id', user.id)
        .eq('key', idempotencyKey)
        .maybeSingle()

      if (checkErr) {
        console.warn(`[publish-post:${reqId}] stage=idempotency_check error`, checkErr.message)
      }

      if (existing?.post_id) {
        console.log(`[publish-post:${reqId}] stage=idempotency_hit returning existing`, {
          postId: existing.post_id,
        })
        return new Response(
          JSON.stringify({ postId: existing.post_id, idempotent: true }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // Try to reserve this key (will fail on duplicate due to unique index)
      const { error: reserveErr } = await supabase
        .from('publish_idempotency')
        .insert({ user_id: user.id, key: idempotencyKey, post_id: null })

      if (reserveErr) {
        console.log(`[publish-post:${reqId}] stage=reserve conflict code=${reserveErr.code}`, reserveErr.message)
        
        const { data: raceCheck } = await supabase
          .from('publish_idempotency')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('key', idempotencyKey)
          .maybeSingle()

        if (raceCheck?.post_id) {
          console.log(`[publish-post:${reqId}] stage=race_resolved returning existing`, {
            postId: raceCheck.post_id,
          })
          return new Response(
            JSON.stringify({ postId: raceCheck.post_id, idempotent: true }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        
        // Key exists but no post_id yet - another request is in progress
        await new Promise(r => setTimeout(r, 500))
        
        const { data: retryCheck } = await supabase
          .from('publish_idempotency')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('key', idempotencyKey)
          .maybeSingle()

        if (retryCheck?.post_id) {
          console.log(`[publish-post:${reqId}] stage=retry_resolved returning existing`, {
            postId: retryCheck.post_id,
          })
          return new Response(
            JSON.stringify({ postId: retryCheck.post_id, idempotent: true }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        
        console.warn(`[publish-post:${reqId}] stage=idempotency_race_unresolved proceeding anyway`)
      } else {
        console.log(`[publish-post:${reqId}] stage=reserve_ok key reserved`)
      }
    }

    const insertPayload = {
      content: content.substring(0, 5000),
      author_id: user.id,
      shared_url: body.sharedUrl ? String(body.sharedUrl).substring(0, 2000) : null,
      shared_title: body.sharedTitle ? String(body.sharedTitle).substring(0, 500) : null,
      preview_img: body.previewImg ? String(body.previewImg).substring(0, 2000) : null,
      article_content: body.articleContent ? String(body.articleContent).substring(0, 10000) : null,
      quoted_post_id: body.quotedPostId ?? null,
      category: null as string | null,
    }

    console.log(`[publish-post:${reqId}] stage=insert_start contentLen=${insertPayload.content.length}`)

    const { data: inserted, error: insertErr } = await supabase
      .from('posts')
      .insert(insertPayload)
      .select('id')
      .maybeSingle()

    if (insertErr) {
      console.error(`[publish-post:${reqId}] stage=insert_error`, insertErr.code, insertErr.message)
      return new Response(JSON.stringify({ 
        error: 'insert_failed', 
        stage: 'insert',
        code: insertErr.code,
        details: insertErr.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!inserted?.id) {
      console.error(`[publish-post:${reqId}] stage=insert_no_id no id returned`)
      return new Response(JSON.stringify({ error: 'insert_no_id', stage: 'insert' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[publish-post:${reqId}] stage=insert_ok postId=${inserted.id}`)

    // Update idempotency record with the new post_id
    if (idempotencyKey) {
      const { error: updateErr } = await supabase
        .from('publish_idempotency')
        .update({ post_id: inserted.id })
        .eq('user_id', user.id)
        .eq('key', idempotencyKey)

      if (updateErr) {
        console.warn(`[publish-post:${reqId}] stage=idempotency_update_error`, updateErr.message)
      } else {
        console.log(`[publish-post:${reqId}] stage=idempotency_update_ok`)
      }
    }

    // Link media (best-effort; never block publish)
    const mediaIds = Array.isArray(body.mediaIds) ? body.mediaIds.filter(Boolean) : []
    if (mediaIds.length > 0) {
      const rows = mediaIds.map((mediaId, idx) => ({
        post_id: inserted.id,
        media_id: mediaId,
        order_idx: idx,
      }))

      const { error: mediaErr } = await supabase.from('post_media').insert(rows)
      if (mediaErr) {
        console.warn(`[publish-post:${reqId}] stage=media_link_error`, mediaErr.message)
      } else {
        console.log(`[publish-post:${reqId}] stage=media_link_ok count=${mediaIds.length}`)
      }
    }

    // Increment shares count for reshares (quoted posts)
    if (body.quotedPostId) {
      const { error: shareErr } = await supabase.rpc('increment_post_shares', { target_post_id: body.quotedPostId });
      if (shareErr) {
        console.warn(`[publish-post:${reqId}] stage=increment_shares_error`, shareErr.message);
      } else {
        console.log(`[publish-post:${reqId}] stage=increment_shares_ok quotedPostId=${body.quotedPostId}`);
      }
    }

    console.log(`[publish-post:${reqId}] stage=done postId=${inserted.id}`)

    return new Response(JSON.stringify({ postId: inserted.id, idempotent: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(`[publish-post:${reqId}] stage=fatal`, e)
    return new Response(JSON.stringify({ error: 'fatal', stage: 'fatal', details: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

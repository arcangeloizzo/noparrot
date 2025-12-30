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
  quotedPostId?: string | null
  mediaIds?: string[]
  idempotencyKey?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('authorization') || ''

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
      console.error('[publish-post] JSON parse error', parseErr)
      return new Response(JSON.stringify({ error: 'invalid_json' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (!content) {
      console.error('[publish-post] empty content')
      return new Response(JSON.stringify({ error: 'content_required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr || !user) {
      console.warn('[publish-post] auth failed', userErr)
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const idempotencyKey = body.idempotencyKey || null

    console.log('[publish-post] start', {
      userId: user.id,
      hasSharedUrl: !!body.sharedUrl,
      mediaCount: Array.isArray(body.mediaIds) ? body.mediaIds.length : 0,
      contentLen: content.length,
      idempotencyKey,
    })

    // IDEMPOTENCY CHECK: Use DB table with unique constraint
    if (idempotencyKey) {
      // First check if this key already exists and has a post_id
      const { data: existing } = await supabase
        .from('publish_idempotency')
        .select('post_id')
        .eq('user_id', user.id)
        .eq('key', idempotencyKey)
        .maybeSingle()

      if (existing?.post_id) {
        console.log('[publish-post] idempotency hit - returning existing post', {
          postId: existing.post_id,
          idempotencyKey,
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
        // If unique constraint violation, the key was just inserted by another request
        // Try to fetch the post_id in case it was already set
        console.log('[publish-post] reserve conflict, checking again', reserveErr.code)
        
        const { data: raceCheck } = await supabase
          .from('publish_idempotency')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('key', idempotencyKey)
          .maybeSingle()

        if (raceCheck?.post_id) {
          console.log('[publish-post] race resolved - returning existing post', {
            postId: raceCheck.post_id,
            idempotencyKey,
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
        // Wait briefly and check again
        await new Promise(r => setTimeout(r, 500))
        
        const { data: retryCheck } = await supabase
          .from('publish_idempotency')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('key', idempotencyKey)
          .maybeSingle()

        if (retryCheck?.post_id) {
          console.log('[publish-post] retry resolved - returning existing post', {
            postId: retryCheck.post_id,
            idempotencyKey,
          })
          return new Response(
            JSON.stringify({ postId: retryCheck.post_id, idempotent: true }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        
        // If still no post_id, something is wrong - proceed anyway (will create new post)
        console.warn('[publish-post] idempotency race unresolved, proceeding with insert')
      }
    }

    const insertPayload = {
      content: content.substring(0, 5000),
      author_id: user.id,
      shared_url: body.sharedUrl ? String(body.sharedUrl).substring(0, 2000) : null,
      quoted_post_id: body.quotedPostId ?? null,
      category: null as string | null,
    }

    console.log('[publish-post] inserting post', { contentLen: insertPayload.content.length })

    const { data: inserted, error: insertErr } = await supabase
      .from('posts')
      .insert(insertPayload)
      .select('id')
      .maybeSingle()

    if (insertErr) {
      console.error('[publish-post] insert error', insertErr)
      return new Response(JSON.stringify({ error: 'insert_failed', details: insertErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!inserted?.id) {
      console.error('[publish-post] insert returned no id')
      return new Response(JSON.stringify({ error: 'insert_no_id' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update idempotency record with the new post_id
    if (idempotencyKey) {
      const { error: updateErr } = await supabase
        .from('publish_idempotency')
        .update({ post_id: inserted.id })
        .eq('user_id', user.id)
        .eq('key', idempotencyKey)

      if (updateErr) {
        console.warn('[publish-post] failed to update idempotency record', updateErr)
        // Non-blocking - post is already created
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
        console.warn('[publish-post] media link failed (continuing)', mediaErr)
      }
    }

    console.log('[publish-post] done', { postId: inserted.id })

    return new Response(JSON.stringify({ postId: inserted.id, idempotent: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[publish-post] fatal', e)
    return new Response(JSON.stringify({ error: 'fatal', details: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

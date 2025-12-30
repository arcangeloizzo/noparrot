// Lovable Cloud Function: publish-post
// Creates a post with minimal payload to avoid client-side crashes (iOS Safari)

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

    const body = (await req.json()) as PublishPostBody

    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (!content) {
      return new Response(JSON.stringify({ error: 'content_required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[publish-post] start', {
      hasSharedUrl: !!body.sharedUrl,
      mediaCount: Array.isArray(body.mediaIds) ? body.mediaIds.length : 0,
      contentLen: content.length,
    })

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

    const insertPayload = {
      content: content.substring(0, 5000),
      author_id: user.id,
      shared_url: body.sharedUrl ? String(body.sharedUrl).substring(0, 2000) : null,
      quoted_post_id: body.quotedPostId ?? null,
      // category left null (client classification disabled)
      category: null as string | null,
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('posts')
      .insert(insertPayload)
      .select('id')
      .maybeSingle()

    if (insertErr) {
      console.error('[publish-post] insert error', insertErr)
      return new Response(JSON.stringify({ error: 'insert_failed', details: insertErr }), {
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

    return new Response(JSON.stringify({ postId: inserted.id }), {
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

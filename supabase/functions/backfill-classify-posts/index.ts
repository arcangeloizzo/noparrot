import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const reqId = crypto.randomUUID().slice(0, 8)
  console.log(`[backfill-classify-posts:${reqId}] ← request received`)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Auth check: Authorization header must match SUPABASE_SERVICE_ROLE_KEY
    const authHeader = req.headers.get('Authorization') || ''
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (bearer !== supabaseServiceKey) {
      console.warn(`[backfill-classify-posts:${reqId}] Unauthorized request`)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Fetch posts that do not have any row in post_topics
    // We also fetch related voice_posts and challenges to compile their text
    console.log(`[backfill-classify-posts:${reqId}] fetching posts...`)
    const { data: posts, error: fetchErr } = await supabase
      .from('posts')
      .select(`
        id, title, content, post_type, author_id,
        voice_posts (title, body_text),
        challenges (title, body_text),
        post_topics (id)
      `)
      .eq('is_removed', false)
      .order('created_at', { ascending: false });

    if (fetchErr) {
      console.error(`[backfill-classify-posts:${reqId}] error fetching posts:`, fetchErr.message)
      return new Response(JSON.stringify({ error: 'fetch_failed', details: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const allPosts = posts || []
    // Filter out posts that already have a topic
    const postsToBackfill = allPosts.filter(p => !p.post_topics || p.post_topics.length === 0)

    console.log(`[backfill-classify-posts:${reqId}] found ${allPosts.length} posts total. ${postsToBackfill.length} posts need backfill.`)

    const results = []
    let successCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const post of postsToBackfill) {
      try {
        let text = ''
        let title = ''

        const vp = Array.isArray(post.voice_posts) ? post.voice_posts[0] : post.voice_posts
        const ch = Array.isArray(post.challenges) ? post.challenges[0] : post.challenges

        if (post.post_type === 'challenge' && ch) {
          title = ch.title || ''
          text = ch.body_text || ''
        } else if (post.post_type === 'voice' && vp) {
          title = vp.title || ''
          text = vp.body_text || ''
        } else {
          title = post.title || ''
          text = post.content || ''
        }

        const aggregateText = `${title} ${text}`.trim()
        if (aggregateText.length < 10) {
          console.log(`[backfill-classify-posts:${reqId}] post ${post.id} skipped (text too short, len=${aggregateText.length})`)
          skippedCount++
          results.push({ post_id: post.id, status: 'skipped', reason: 'too_short' })
          continue
        }

        console.log(`[backfill-classify-posts:${reqId}] classifying post ${post.id}... text snippet: "${aggregateText.slice(0, 50)}..."`)

        // Call classify-content
        const classResp = await fetch(`${supabaseUrl}/functions/v1/classify-content`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, title }),
        })

        if (!classResp.ok) {
          console.error(`[backfill-classify-posts:${reqId}] classify-content failed for post ${post.id}: HTTP ${classResp.status}`)
          errorCount++
          results.push({ post_id: post.id, status: 'error', reason: `classify_http_${classResp.status}` })
          continue
        }

        const classData = await classResp.json()
        const category = classData?.category as string | null

        if (!category) {
          console.warn(`[backfill-classify-posts:${reqId}] classify-content returned no category for post ${post.id}`)
          errorCount++
          results.push({ post_id: post.id, status: 'error', reason: 'no_category_returned' })
          continue
        }

        // Update posts table with category
        const { error: updateErr } = await supabase
          .from('posts')
          .update({ category })
          .eq('id', post.id)

        if (updateErr) {
          console.error(`[backfill-classify-posts:${reqId}] failed to update category for post ${post.id}:`, updateErr.message)
          errorCount++
          results.push({ post_id: post.id, status: 'error', reason: `update_db_${updateErr.message}` })
          continue
        }

        // Call assign-post-topic
        const topicResp = await fetch(`${supabaseUrl}/functions/v1/assign-post-topic`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ post_id: post.id }),
        })

        let topicId = null
        if (topicResp.ok) {
          const topicData = await topicResp.json()
          topicId = topicData?.topic_id || null
        } else {
          console.warn(`[backfill-classify-posts:${reqId}] assign-post-topic failed for post ${post.id}: HTTP ${topicResp.status}`)
        }

        console.log(`[backfill-classify-posts:${reqId}] post_id: ${post.id} | text: ${aggregateText.slice(0, 50)} | category: ${category} | topic: ${topicId}`)
        successCount++
        results.push({ post_id: post.id, status: 'success', category, topic_id: topicId })

        // Rate limiting delay (500ms)
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (postErr) {
        console.error(`[backfill-classify-posts:${reqId}] error processing post ${post.id}:`, postErr)
        errorCount++
        results.push({ post_id: post.id, status: 'error', reason: String(postErr) })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_scanned: postsToBackfill.length,
        success_count: successCount,
        skipped_count: skippedCount,
        error_count: errorCount,
        details: results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (e) {
    console.error(`[backfill-classify-posts:${reqId}] fatal error:`, e)
    return new Response(JSON.stringify({ error: 'fatal', details: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

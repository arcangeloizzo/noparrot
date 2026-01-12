// Lovable Cloud Function: get-trending-topics
// Serves cached trending topics or generates them with anti-fake trend logic

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cache TTL: 30 minutes
const CACHE_TTL_MINUTES = 30

// Minimum thresholds for generating trends
const MIN_POSTS_7D = 10
const MIN_ACTIVE_USERS_7D = 5
const MIN_CLUSTERS = 2

// Cluster validity thresholds
const MIN_POSTS_PER_CLUSTER = 3
const MIN_COMMENTS_FOR_SMALL_CLUSTER = 15

interface TrendingTopic {
  topic_id: string
  title: string
  summary: string
  badge_category?: string
  stats: { posts: number; comments: number; likes: number }
  top_post_ids: string[]
}

interface CachePayload {
  mode: 'TRENDING' | 'RECENT_POSTS'
  topics?: TrendingTopic[]
  recentPosts?: Array<{ id: string; content: string; shared_title?: string }>
  generatedAt: string
  validUntil: string
}

// Score formula: commenti > like; log-based saturation
function calculateScore(
  postCount: number,
  commentCount: number,
  likeCount: number,
  postCount24h: number
): number {
  return (
    1.2 * Math.log1p(postCount) +
    2.2 * Math.log1p(commentCount) +
    0.8 * Math.log1p(likeCount) +
    0.9 * Math.log1p(postCount24h)
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const reqId = crypto.randomUUID().slice(0, 8)
  console.log(`[get-trending-topics:${reqId}] ← request received`)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Check for valid cache
    const now = new Date()
    const { data: cacheRows, error: cacheError } = await supabase
      .from('trending_topics_cache')
      .select('payload, valid_until')
      .gt('valid_until', now.toISOString())
      .order('generated_at', { ascending: false })
      .limit(1)

    if (cacheError) {
      console.warn(`[get-trending-topics:${reqId}] Cache query error:`, cacheError)
    }

    if (cacheRows && cacheRows.length > 0) {
      console.log(`[get-trending-topics:${reqId}] ✓ Returning cached data`)
      return new Response(JSON.stringify(cacheRows[0].payload), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[get-trending-topics:${reqId}] Cache miss, generating...`)

    // Step 2: Check community signal thresholds
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: signalData, error: signalError } = await supabase
      .from('posts')
      .select('id, author_id, created_at')
      .gte('created_at', sevenDaysAgo)

    if (signalError) {
      console.error(`[get-trending-topics:${reqId}] Signal query error:`, signalError)
      throw signalError
    }

    const posts7d = signalData || []
    const uniqueAuthors = new Set(posts7d.map(p => p.author_id))
    const recentPosts24h = posts7d.filter(p => p.created_at >= oneDayAgo)

    console.log(`[get-trending-topics:${reqId}] Signal: ${posts7d.length} posts, ${uniqueAuthors.size} users, ${recentPosts24h.length} in 24h`)

    // If insufficient signal, return RECENT_POSTS mode
    if (posts7d.length < MIN_POSTS_7D || uniqueAuthors.size < MIN_ACTIVE_USERS_7D) {
      console.log(`[get-trending-topics:${reqId}] Insufficient signal, falling back to RECENT_POSTS`)
      
      const { data: recentPosts } = await supabase
        .from('posts')
        .select('id, content, shared_title')
        .order('created_at', { ascending: false })
        .limit(10)

      const payload: CachePayload = {
        mode: 'RECENT_POSTS',
        recentPosts: recentPosts || [],
        generatedAt: now.toISOString(),
        validUntil: new Date(now.getTime() + CACHE_TTL_MINUTES * 60 * 1000).toISOString(),
      }

      // Save to cache
      await supabase.from('trending_topics_cache').insert({
        valid_until: payload.validUntil,
        input_snapshot: { posts7d: posts7d.length, users7d: uniqueAuthors.size },
        payload,
      })

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 3: Aggregate topics with metrics
    const { data: topicsData, error: topicsError } = await supabase
      .from('post_topics')
      .select(`
        topic_id,
        topic_label,
        macro_category,
        post_id,
        posts!inner(id, created_at, content, shared_title)
      `)
      .gte('created_at', sevenDaysAgo)

    if (topicsError) {
      console.error(`[get-trending-topics:${reqId}] Topics query error:`, topicsError)
      throw topicsError
    }

    // Group by topic
    const topicMap = new Map<string, {
      topic_id: string
      topic_label: string
      macro_category: string | null
      posts: Array<{ id: string; content: string; shared_title?: string; created_at: string }>
    }>()

    for (const row of topicsData || []) {
      const existing = topicMap.get(row.topic_id)
      const postData = row.posts as any
      
      if (existing) {
        existing.posts.push({
          id: postData.id,
          content: postData.content,
          shared_title: postData.shared_title,
          created_at: postData.created_at,
        })
      } else {
        topicMap.set(row.topic_id, {
          topic_id: row.topic_id,
          topic_label: row.topic_label,
          macro_category: row.macro_category,
          posts: [{
            id: postData.id,
            content: postData.content,
            shared_title: postData.shared_title,
            created_at: postData.created_at,
          }],
        })
      }
    }

    // Get comment and reaction counts for posts
    const allPostIds = (topicsData || []).map(t => (t.posts as any).id)
    
    const { data: commentsData } = await supabase
      .from('comments')
      .select('post_id')
      .in('post_id', allPostIds)
      .gte('created_at', sevenDaysAgo)

    const { data: reactionsData } = await supabase
      .from('reactions')
      .select('post_id')
      .in('post_id', allPostIds)
      .gte('created_at', sevenDaysAgo)

    // Count comments and reactions per post
    const commentCountByPost = new Map<string, number>()
    const reactionCountByPost = new Map<string, number>()

    for (const c of commentsData || []) {
      commentCountByPost.set(c.post_id, (commentCountByPost.get(c.post_id) || 0) + 1)
    }
    for (const r of reactionsData || []) {
      reactionCountByPost.set(r.post_id, (reactionCountByPost.get(r.post_id) || 0) + 1)
    }

    // Calculate metrics and scores for each topic
    const scoredTopics: Array<{
      topic_id: string
      topic_label: string
      macro_category: string | null
      postCount: number
      commentCount: number
      likeCount: number
      postCount24h: number
      score: number
      sampleContents: string[]
      topPostIds: string[]
    }> = []

    for (const [topicId, data] of topicMap.entries()) {
      const postCount = data.posts.length
      const postCount24h = data.posts.filter(p => p.created_at >= oneDayAgo).length
      
      let commentCount = 0
      let likeCount = 0
      
      for (const post of data.posts) {
        commentCount += commentCountByPost.get(post.id) || 0
        likeCount += reactionCountByPost.get(post.id) || 0
      }

      // Apply cluster validity filter
      const isValidCluster = postCount >= MIN_POSTS_PER_CLUSTER || commentCount >= MIN_COMMENTS_FOR_SMALL_CLUSTER
      
      if (!isValidCluster) continue

      const score = calculateScore(postCount, commentCount, likeCount, postCount24h)

      scoredTopics.push({
        topic_id: topicId,
        topic_label: data.topic_label,
        macro_category: data.macro_category,
        postCount,
        commentCount,
        likeCount,
        postCount24h,
        score,
        sampleContents: data.posts
          .slice(0, 5)
          .map(p => [p.content, p.shared_title].filter(Boolean).join(' ').slice(0, 200)),
        topPostIds: data.posts.slice(0, 3).map(p => p.id),
      })
    }

    // Sort by score and take top 5
    scoredTopics.sort((a, b) => b.score - a.score)
    const topClusters = scoredTopics.slice(0, 5)

    console.log(`[get-trending-topics:${reqId}] Found ${scoredTopics.length} valid clusters, using top ${topClusters.length}`)

    // Check minimum clusters threshold
    if (topClusters.length < MIN_CLUSTERS) {
      console.log(`[get-trending-topics:${reqId}] Not enough clusters, falling back to RECENT_POSTS`)
      
      const { data: recentPosts } = await supabase
        .from('posts')
        .select('id, content, shared_title')
        .order('created_at', { ascending: false })
        .limit(10)

      const payload: CachePayload = {
        mode: 'RECENT_POSTS',
        recentPosts: recentPosts || [],
        generatedAt: now.toISOString(),
        validUntil: new Date(now.getTime() + CACHE_TTL_MINUTES * 60 * 1000).toISOString(),
      }

      await supabase.from('trending_topics_cache').insert({
        valid_until: payload.validUntil,
        input_snapshot: { posts7d: posts7d.length, clusters: topClusters.length },
        payload,
      })

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 4: Generate AI summaries for top clusters
    const trendingTopics: TrendingTopic[] = []

    for (const cluster of topClusters) {
      let title = cluster.topic_label
      let summary = `${cluster.postCount} post con ${cluster.commentCount} commenti negli ultimi 7 giorni.`

      if (LOVABLE_API_KEY && cluster.sampleContents.length > 0) {
        try {
          const prompt = `Sei un editor. Genera un titolo accattivante e un riassunto per questo trending topic.

TOPIC: ${cluster.topic_label}
${cluster.macro_category ? `CATEGORIA: ${cluster.macro_category}` : ''}
STATISTICHE: ${cluster.postCount} post, ${cluster.commentCount} commenti, ${cluster.likeCount} like

ESEMPI DI CONTENUTI:
${cluster.sampleContents.map((c, i) => `${i + 1}. "${c}"`).join('\n')}

REGOLE:
- title: max 40 caratteri, accattivante, NO "La discussione verte..."
- summary: max 2 frasi, tono editoriale, focus su cosa sta facendo discutere
- Se segnale basso, rispondi {"skip": true}

Rispondi in JSON: {"title": "...", "summary": "..."}`

          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite',
              messages: [{ role: 'user', content: prompt }],
              response_format: { type: 'json_object' },
            }),
          })

          if (response.ok) {
            const aiData = await response.json()
            const aiResult = JSON.parse(aiData.choices?.[0]?.message?.content || '{}')
            
            if (!aiResult.skip) {
              title = aiResult.title || title
              summary = aiResult.summary || summary
            }
          }
        } catch (err) {
          console.warn(`[get-trending-topics:${reqId}] AI summary error for ${cluster.topic_id}:`, err)
        }
      }

      trendingTopics.push({
        topic_id: cluster.topic_id,
        title,
        summary,
        badge_category: cluster.macro_category || undefined,
        stats: {
          posts: cluster.postCount,
          comments: cluster.commentCount,
          likes: cluster.likeCount,
        },
        top_post_ids: cluster.topPostIds,
      })
    }

    // Step 5: Save to cache and return
    const payload: CachePayload = {
      mode: 'TRENDING',
      topics: trendingTopics,
      generatedAt: now.toISOString(),
      validUntil: new Date(now.getTime() + CACHE_TTL_MINUTES * 60 * 1000).toISOString(),
    }

    await supabase.from('trending_topics_cache').insert({
      valid_until: payload.validUntil,
      input_snapshot: {
        posts7d: posts7d.length,
        users7d: uniqueAuthors.size,
        clusters: topClusters.length,
      },
      payload,
    })

    console.log(`[get-trending-topics:${reqId}] ✓ Generated ${trendingTopics.length} trending topics`)

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error(`[get-trending-topics:${reqId}] Fatal error:`, e)
    return new Response(JSON.stringify({ error: 'fatal', details: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

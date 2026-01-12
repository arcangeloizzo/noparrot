// Lovable Cloud Function: assign-post-topic
// Assigns semantic topics to posts using AI

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AssignTopicBody {
  postId: string
  content: string
  sharedTitle?: string | null
  sharedUrl?: string | null
}

interface TopicResult {
  topic_id: string
  topic_label: string
  macro_category: string | null
  confidence: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const reqId = crypto.randomUUID().slice(0, 8)
  console.log(`[assign-post-topic:${reqId}] ← request received`)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

    if (!LOVABLE_API_KEY) {
      console.warn(`[assign-post-topic:${reqId}] No LOVABLE_API_KEY configured`)
      return new Response(JSON.stringify({ error: 'no_api_key' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let body: AssignTopicBody
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'invalid_json' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { postId, content, sharedTitle, sharedUrl } = body

    if (!postId) {
      return new Response(JSON.stringify({ error: 'post_id_required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build content for analysis
    const textParts = [content, sharedTitle].filter(Boolean)
    const analysisText = textParts.join('\n\n').trim()

    if (analysisText.length < 10) {
      console.log(`[assign-post-topic:${reqId}] Content too short, skipping`)
      return new Response(JSON.stringify({ skipped: true, reason: 'content_too_short' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[assign-post-topic:${reqId}] Analyzing content for post ${postId}`)

    // Call AI to extract topic
    const prompt = `Analizza questo contenuto e identifica IL TEMA SPECIFICO discusso.

CONTENUTO:
"""
${analysisText.substring(0, 2000)}
"""

REGOLE RIGIDE:
1. NON usare categorie generiche come "Politica", "Economia", "Tecnologia", "Sport"
2. Identifica l'ARGOMENTO SPECIFICO (es: "traffico-roma", "elezioni-usa-2024", "bitcoin-halving", "sciopero-treni")
3. topic_id: slug in kebab-case, max 40 caratteri, stabile
4. topic_label: etichetta leggibile per umani, max 40 caratteri
5. macro_category: solo se hai alta confidenza, altrimenti null. Opzioni: Politica, Economia, Tecnologia, Sport, Cultura, Scienza, Ambiente, Società, Esteri, Salute
6. confidence: 0.0-1.0, quanto sei sicuro dell'assegnazione

Se non riesci a identificare un tema specifico, rispondi con topic_id: null

Rispondi SOLO in JSON valido:`

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

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[assign-post-topic:${reqId}] AI error ${response.status}:`, errText)
      return new Response(JSON.stringify({ error: 'ai_error', status: response.status }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const aiData = await response.json()
    const rawContent = aiData.choices?.[0]?.message?.content || '{}'
    
    let result: TopicResult
    try {
      result = JSON.parse(rawContent)
    } catch {
      console.error(`[assign-post-topic:${reqId}] Failed to parse AI response:`, rawContent)
      return new Response(JSON.stringify({ error: 'parse_error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate result
    if (!result.topic_id || !result.topic_label) {
      console.log(`[assign-post-topic:${reqId}] No valid topic identified`)
      return new Response(JSON.stringify({ skipped: true, reason: 'no_topic_identified' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Sanitize topic_id
    const sanitizedTopicId = result.topic_id
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40)

    const sanitizedLabel = result.topic_label.slice(0, 40)
    const confidence = Math.min(1, Math.max(0, result.confidence || 0.7))

    // Upsert into post_topics
    const { error: upsertError } = await supabase
      .from('post_topics')
      .upsert({
        post_id: postId,
        topic_id: sanitizedTopicId,
        topic_label: sanitizedLabel,
        macro_category: result.macro_category || null,
        confidence,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'post_id'
      })

    if (upsertError) {
      console.error(`[assign-post-topic:${reqId}] Upsert error:`, upsertError)
      return new Response(JSON.stringify({ error: 'upsert_error', details: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[assign-post-topic:${reqId}] ✓ Assigned topic "${sanitizedTopicId}" to post ${postId}`)

    return new Response(JSON.stringify({
      success: true,
      topic_id: sanitizedTopicId,
      topic_label: sanitizedLabel,
      macro_category: result.macro_category,
      confidence,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error(`[assign-post-topic:${reqId}] Fatal error:`, e)
    return new Response(JSON.stringify({ error: 'fatal', details: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

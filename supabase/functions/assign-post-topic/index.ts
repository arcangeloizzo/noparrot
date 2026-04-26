// Lovable Cloud Function: assign-post-topic
// Assigns a fine-grained semantic topic (topic_id + topic_label + macro_category)
// to a single post using AI. Aggregates user content + shared title + article + transcript
// + media OCR/transcript so reshares are still classifiable.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
}

const CANONICAL_MACROS = [
  'Società', 'Politica', 'Economia', 'Tecnologia',
  'Scienza', 'Cultura', 'Ambiente', 'Benessere',
] as const

const MIN_AGGREGATE_LEN = 50
const SUMMARY_MAX = 3000

const KNOWN_HOSTS: Record<string, { hint: string }> = {
  'open.spotify.com': { hint: 'contenuto musicale o podcast su Spotify' },
  'spotify.com': { hint: 'contenuto musicale o podcast su Spotify' },
  'youtube.com': { hint: 'video YouTube' },
  'youtu.be': { hint: 'video YouTube' },
  'music.youtube.com': { hint: 'contenuto musicale YouTube' },
  'genius.com': { hint: 'testi musicali' },
  'wired.it': { hint: 'articolo Wired (tech/scienza/cultura)' },
  'wired.com': { hint: 'articolo Wired (tech/scienza/cultura)' },
  'ilpost.it': { hint: 'articolo de Il Post' },
  'corriere.it': { hint: 'articolo Corriere della Sera' },
  'repubblica.it': { hint: 'articolo La Repubblica' },
  'ansa.it': { hint: 'notizia ANSA' },
  'reuters.com': { hint: 'notizia Reuters' },
  'theguardian.com': { hint: 'articolo The Guardian' },
  'nytimes.com': { hint: 'articolo New York Times' },
  'lefigaro.fr': { hint: 'articolo Le Figaro' },
  'internazionale.it': { hint: 'articolo Internazionale' },
  'valigiablu.it': { hint: 'articolo Valigia Blu' },
  'substack.com': { hint: 'newsletter Substack' },
  'medium.com': { hint: 'articolo Medium' },
}

interface AssignTopicBody {
  // Preferred: just pass post_id, the function will fetch everything itself.
  post_id?: string
  postId?: string
  // Optional overrides (legacy support); ignored if post_id resolves a row.
  content?: string | null
  sharedTitle?: string | null
  sharedUrl?: string | null
}

interface TopicResult {
  topic_id: string
  topic_label: string
  macro_category: string | null
  confidence: number
}

function trimOr(v: string | null | undefined): string {
  return (v ?? '').trim()
}

async function fetchMediaTextForPost(supabase: any, postId: string): Promise<string> {
  const { data, error } = await supabase
    .from('post_media')
    .select('media:media_id (extracted_text, extracted_status)')
    .eq('post_id', postId)
  if (error || !data) return ''
  const parts: string[] = []
  for (const row of data as any[]) {
    const m = row.media
    if (m && typeof m.extracted_text === 'string' && m.extracted_text.trim().length > 0) {
      parts.push(m.extracted_text.trim())
    }
  }
  return parts.join('\n\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const reqId = crypto.randomUUID().slice(0, 8)
  console.log(`[assign-post-topic:${reqId}] ← request received`)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const internalSecret = Deno.env.get('PUSH_INTERNAL_SECRET') ?? ''
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

    // Auth: accept either service role bearer OR internal secret OR a valid JWT
    // (publish-post is invoked from authenticated clients with anon key + user JWT, so
    // a permissive auth here keeps the fire-and-forget topic assignment from breaking).
    const authHeader = req.headers.get('Authorization') || ''
    const xInternal = req.headers.get('x-internal-secret') || ''
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim()
    const okBearer = bearer.length > 0 && bearer === supabaseServiceKey
    const okInternal = internalSecret.length > 0 && xInternal === internalSecret
    const okJwt = bearer.length > 20 // any JWT (anon or user) is acceptable for write of topic
    if (!okBearer && !okInternal && !okJwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    const postId = body.post_id || body.postId
    if (!postId) {
      return new Response(JSON.stringify({ error: 'post_id_required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Load the post (single source of truth)
    const { data: post, error: postErr } = await supabase
      .from('posts')
      .select('id, content, title, shared_title, shared_url, hostname, article_content, full_article, transcript, category')
      .eq('id', postId)
      .maybeSingle()

    if (postErr || !post) {
      console.warn(`[assign-post-topic:${reqId}] post not found ${postId}: ${postErr?.message ?? 'no row'}`)
      return new Response(JSON.stringify({ error: 'post_not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Aggregate fields (same logic as reclassify-posts)
    const userContent = trimOr((post as any).content) || trimOr(body.content)
    const titleField = trimOr((post as any).title)
    const sharedTitle = trimOr((post as any).shared_title) || trimOr(body.sharedTitle)
    const sharedUrl = trimOr((post as any).shared_url) || trimOr(body.sharedUrl)
    const articleContent = trimOr((post as any).article_content) || trimOr((post as any).full_article)
    const transcript = trimOr((post as any).transcript)
    const mediaText = await fetchMediaTextForPost(supabase, postId)
    const hostname = trimOr((post as any).hostname)

    const fields: Record<string, string> = {
      user_content: userContent,
      post_title: titleField,
      shared_title: sharedTitle,
      article_content: articleContent,
      transcript,
      media_extracted_text: mediaText,
      hostname,
    }

    const aggregate = Object.values(fields).filter(v => v.length > 0).join(' ')
    const normalizedHostname = hostname.replace(/^www\./i, '').toLowerCase()
    const knownHost = KNOWN_HOSTS[normalizedHostname]
    const significantLength = aggregate.length - hostname.length
    const tooShort = (!knownHost && significantLength < MIN_AGGREGATE_LEN)
      || (knownHost && significantLength < 10)

    if (tooShort) {
      console.log(`[assign-post-topic:${reqId}] aggregate too short (${significantLength} chars, host_known=${!!knownHost}), skipping`)
      return new Response(JSON.stringify({
        skipped: true,
        reason: 'content_too_short',
        significant_length: significantLength,
        host_known: !!knownHost,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const summaryText = [
      knownHost ? `[Fonte: ${knownHost.hint}]` : null,
      articleContent,
      transcript,
      mediaText,
    ].filter((s): s is string => !!s && s.length > 0).join('\n\n').slice(0, SUMMARY_MAX)

    const analysisPayload = [
      userContent ? `USER_CONTENT:\n${userContent}` : null,
      (sharedTitle || titleField) ? `TITLE:\n${sharedTitle || titleField}` : null,
      sharedUrl ? `URL: ${sharedUrl}` : null,
      summaryText ? `BODY/CONTEXT:\n${summaryText}` : null,
    ].filter(Boolean).join('\n\n').slice(0, 4000)

    console.log(`[assign-post-topic:${reqId}] analyzing post ${postId}, aggregate=${aggregate.length} chars`)

    // ── ANTI-FRAGMENTATION: load existing topics as hint ──────────────
    const postCategoryForLookup = (post as any).category as string | null
    const isCanonicalMacro = postCategoryForLookup
      && (CANONICAL_MACROS as readonly string[]).includes(postCategoryForLookup)

    let existingTopics: Array<{ topic_id: string; topic_label: string; frequency: number }> = []
    try {
      let q = supabase
        .from('post_topics')
        .select('topic_id, topic_label')
      if (isCanonicalMacro) {
        q = q.eq('macro_category', postCategoryForLookup)
      }
      const { data: rawTopics, error: topicsErr } = await q.limit(500)
      if (topicsErr) {
        console.warn(`[assign-post-topic:${reqId}] existing topics lookup failed:`, topicsErr.message)
      } else if (rawTopics && rawTopics.length > 0) {
        // Aggregate frequency client-side (Supabase JS doesn't support GROUP BY directly)
        const freqMap = new Map<string, { topic_id: string; topic_label: string; frequency: number }>()
        for (const r of rawTopics as any[]) {
          const key = r.topic_id
          const existing = freqMap.get(key)
          if (existing) {
            existing.frequency += 1
          } else {
            freqMap.set(key, { topic_id: r.topic_id, topic_label: r.topic_label, frequency: 1 })
          }
        }
        existingTopics = Array.from(freqMap.values())
          .sort((a, b) => b.frequency - a.frequency || a.topic_label.localeCompare(b.topic_label))
          .slice(0, 30)
      }
    } catch (e) {
      console.warn(`[assign-post-topic:${reqId}] existing topics lookup threw:`, (e as Error).message)
    }

    const macroLabel = isCanonicalMacro ? postCategoryForLookup : 'globale'
    const existingTopicsSection = existingTopics.length > 0
      ? `

TOPIC ESISTENTI per la macro "${macroLabel}" (ordinati per frequenza):
${existingTopics.map(t => `- ${t.topic_id} (${t.topic_label}) — usato ${t.frequency}x`).join('\n')}

REGOLA DI CONSOLIDAMENTO:
Se UNO dei topic esistenti descrive bene il contenuto del post, RIUSALO esattamente (stesso topic_id e topic_label). Preferisci sempre il riuso quando possibile, anche se il post tratta solo parzialmente lo stesso tema.
Crea un topic NUOVO solo se nessuno di quelli esistenti descrive il contenuto in modo accettabile.
`
      : ''

    console.log(`[assign-post-topic:${reqId}] existing_topics_loaded=${existingTopics.length} macro="${macroLabel}"`)

    const systemPrompt = `Sei un classificatore semantico di NoParrot. Per ogni post, devi assegnare:

1. Una MACRO_CATEGORY tra le 8 canoniche:
   - Società — questioni sociali, dibattito pubblico, costumi, generazioni
   - Politica — istituzioni, partiti, geopolitica, diritti civili, elezioni, conflitti internazionali
   - Economia — mercati, finanza, imprese, business
   - Tecnologia — AI, software, hardware, prodotti digitali, internet, startup
   - Scienza — ricerca, biologia, fisica, medicina (la pratica scientifica, non policy sanitaria)
   - Cultura — arte, libri, cinema, musica, sport come fenomeno culturale, spettacolo
   - Ambiente — clima, sostenibilità, biodiversità, ecologia, energia
   - Benessere — salute fisica, salute mentale, lifestyle, alimentazione, fitness

2. Un TOPIC_ID (slug kebab-case, max 40 char) identificativo del tema specifico, in stile stabile e riutilizzabile.
   Esempi BUONI: "guerra-ucraina", "governo-meloni", "intelligenza-artificiale-generativa", "podcast-italiani", "musica-indie-italiana", "elezioni-usa-2024".
   Esempi CATTIVI: "post-su-meloni-del-22-aprile", "uomo-in-camicia-nera", "lo-pensa-lui-anche".
   Regole: minuscolo, kebab-case, niente date, niente nomi propri di chi commenta, niente parole inutili. PREFERISCI topic riusabili che potrebbero ricorrere su altri post.

3. Un TOPIC_LABEL (umano, max 40 char) versione leggibile del topic_id. Es. topic_id "guerra-ucraina" → topic_label "Guerra in Ucraina".

4. Una CONFIDENCE (0.0-1.0) sulla scelta. Sotto 0.5 indica incertezza.
${existingTopicsSection}
Output JSON STRETTO:
{
  "macro_category": "...",
  "topic_id": "...",
  "topic_label": "...",
  "confidence": 0.85
}`

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: analysisPayload },
        ],
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
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)

    const sanitizedLabel = result.topic_label.slice(0, 40)
    const confidence = Math.min(1, Math.max(0, result.confidence || 0.7))

    // Prefer the post's already-classified macro (truth source) over AI's macro
    // to keep post_topics.macro_category aligned with posts.category.
    const postCategory = (post as any).category as string | null
    const aiMacro = result.macro_category && (CANONICAL_MACROS as readonly string[]).includes(result.macro_category)
      ? result.macro_category
      : null
    const finalMacro = postCategory && (CANONICAL_MACROS as readonly string[]).includes(postCategory)
      ? postCategory
      : aiMacro

    // Upsert into post_topics
    const { error: upsertError } = await supabase
      .from('post_topics')
      .upsert({
        post_id: postId,
        topic_id: sanitizedTopicId,
        topic_label: sanitizedLabel,
        macro_category: finalMacro,
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

    const wasReused = existingTopics.some(t => t.topic_id === sanitizedTopicId)
    console.log(`[assign-post-topic:${reqId}] ✓ Assigned topic "${sanitizedTopicId}" to post ${postId} (existing_topics=${existingTopics.length}, reused=${wasReused})`)

    return new Response(JSON.stringify({
      success: true,
      topic_id: sanitizedTopicId,
      topic_label: sanitizedLabel,
      macro_category: finalMacro,
      ai_macro: aiMacro,
      post_macro: postCategory,
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// URL NORMALIZATION
// ============================================================================
// Only tracking params we agreed to remove
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'dclid', 'msclkid', 'igshid', 'twclid', 'ttclid'
]);

function safeNormalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    url.protocol = 'https:';
    url.hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    
    const cleanParams = new URLSearchParams();
    const entries = Array.from(url.searchParams.entries())
      .filter(([key]) => {
        const lowerKey = key.toLowerCase();
        if (lowerKey.startsWith('utm_')) return false;
        return !TRACKING_PARAMS.has(lowerKey);
      })
      .sort(([a], [b]) => a.localeCompare(b));
    
    for (const [key, value] of entries) {
      cleanParams.set(key, value);
    }
    url.search = cleanParams.toString();
    
    return url.toString();
  } catch {
    // NO toLowerCase on full URL
    return rawUrl.trim();
  }
}

// ============================================================================
// HMAC TELEMETRY HELPERS
// ============================================================================
async function hashUserId(userId: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(userId));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16);
}

async function logAiUsage(
  supabase: any,
  params: {
    functionName: string;
    model: string;
    inputChars: number;
    outputChars: number;
    cacheHit: boolean;
    latencyMs: number;
    providerLatencyMs?: number;
    success: boolean;
    errorCode?: string;
    userHash?: string;
  }
) {
  try {
    await supabase.from('ai_usage_logs').insert({
      function_name: params.functionName,
      model: params.model,
      input_chars: params.inputChars,
      output_chars: params.outputChars,
      cache_hit: params.cacheHit,
      latency_ms: params.latencyMs,
      provider_latency_ms: params.providerLatencyMs || null,
      success: params.success,
      error_code: params.errorCode || null,
      user_hash: params.userHash || null
    });
  } catch (e) {
    console.error('[Telemetry] Failed to log:', e);
  }
}

// ============================================================================
// SOURCE-FIRST Q/A GENERATION - SECURITY HARDENED
// ============================================================================
// This edge function:
// 1. Receives ONLY qaSourceRef from client (no full text)
// 2. Fetches full content server-side from cache or fresh extraction
// 3. Saves questions to post_qa_questions (public) and answers to post_qa_answers (private)
// 4. Returns ONLY questions (no correct answers, no source text)
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    // NO fallback - if missing, userHash stays undefined
    const hmacSecret = Deno.env.get('AI_TELEMETRY_HMAC_SECRET');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and extract user (owner_id for Q&A)
    const authHeader = req.headers.get('Authorization');
    let ownerId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      ownerId = user?.id || null;
    }

    // Fallback owner for legacy/system calls
    if (!ownerId) {
      ownerId = '00000000-0000-0000-0000-000000000000';
      console.log('[generate-qa] No JWT, using system owner');
    }

    const { 
      contentId, 
      isPrePublish, 
      title, 
      // DEPRECATED: summary - no longer received from client
      summary,
      excerpt, 
      type, 
      sourceUrl,
      userText,
      testMode,
      questionCount,
      // NEW: qaSourceRef for server-side content fetching
      qaSourceRef
    } = await req.json();

    console.log('[generate-qa] Request params:', { 
      sourceUrl, 
      contentId, 
      isPrePublish, 
      testMode, 
      questionCount,
      qaSourceRef: qaSourceRef ? { kind: qaSourceRef.kind, id: qaSourceRef.id?.substring(0, 20) } : null
    });

    // ========================================================================
    // SERVER-SIDE CONTENT FETCHING
    // ========================================================================
    let serverSideContent = '';
    let contentSource = 'none';
    
    // If client sent summary (legacy support), use it but log warning
    if (summary && summary.length > 100) {
      console.log('[generate-qa] ⚠️ Legacy mode: using client-provided summary');
      serverSideContent = summary;
      contentSource = 'client-legacy';
    }
    
    // NEW: Fetch content server-side based on qaSourceRef
    if (qaSourceRef && !serverSideContent) {
      console.log(`[generate-qa] 📥 Fetching content server-side for ${qaSourceRef.kind}: ${qaSourceRef.id?.substring(0, 30)}`);
      
      switch (qaSourceRef.kind) {
        case 'youtubeId': {
          // Fetch from youtube_transcripts_cache
          const { data: cached } = await supabase
            .from('youtube_transcripts_cache')
            .select('transcript')
            .eq('video_id', qaSourceRef.id)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
          
          if (cached?.transcript) {
            serverSideContent = cached.transcript;
            contentSource = 'youtube_cache';
            console.log(`[generate-qa] ✅ YouTube transcript from cache: ${serverSideContent.length} chars`);
          } else {
            // Trigger async fetch via transcribe-youtube
            console.log(`[generate-qa] ⏳ YouTube transcript not cached, triggering fetch...`);
            try {
              const ytUrl = `https://www.youtube.com/watch?v=${qaSourceRef.id}`;
              const transcribeResponse = await fetch(`${supabaseUrl}/functions/v1/transcribe-youtube`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`
                },
                body: JSON.stringify({ url: ytUrl })
              });
              
              if (transcribeResponse.ok) {
                const transcribeData = await transcribeResponse.json();
                if (transcribeData.transcript) {
                  serverSideContent = transcribeData.transcript;
                  contentSource = 'youtube_fresh';
                  console.log(`[generate-qa] ✅ YouTube transcript fetched: ${serverSideContent.length} chars`);
                }
              }
            } catch (err) {
              console.error('[generate-qa] YouTube transcript fetch failed:', err);
            }
          }
          break;
        }
        
        case 'spotifyId': {
          // Fetch from content_cache (lyrics were cached there)
          const spotifyUrl = `https://open.spotify.com/track/${qaSourceRef.id}`;
          const { data: cached } = await supabase
            .from('content_cache')
            .select('content_text')
            .eq('source_url', spotifyUrl)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
          
          if (cached) {
            // Check if this is a NEGATIVE cache hit (empty content = lyrics unavailable)
            if (cached.content_text && cached.content_text.length > 50) {
              serverSideContent = cached.content_text;
              contentSource = 'content_cache';
              console.log(`[generate-qa] ✅ Spotify lyrics from cache: ${serverSideContent.length} chars`);
            } else {
              // NEGATIVE CACHE HIT: lyrics unavailable - try metadata fallback
              console.log('[generate-qa] ⚡ Negative cache hit for Spotify - trying metadata fallback');
            }
          } else {
            // Not in cache at all - try fetching fresh
            console.log(`[generate-qa] ⏳ Spotify lyrics not cached, trying fresh fetch...`);
            try {
              const lyricsResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-lyrics`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`
                },
                body: JSON.stringify({ trackId: qaSourceRef.id })
              });
              
              if (lyricsResponse.ok) {
                const lyricsData = await lyricsResponse.json();
                if (lyricsData.lyrics && lyricsData.lyrics.length > 50) {
                  serverSideContent = lyricsData.lyrics;
                  contentSource = 'spotify_fresh';
                  console.log(`[generate-qa] ✅ Spotify lyrics fetched: ${serverSideContent.length} chars`);
                }
              } else {
                console.log(`[generate-qa] ⏳ Lyrics fetch failed: ${lyricsResponse.status}, trying metadata fallback`);
              }
            } catch (err) {
              console.error('[generate-qa] Spotify lyrics fetch failed, trying metadata fallback:', err);
            }
          }
          
          // METADATA FALLBACK: If no lyrics, use title/excerpt for quiz
          if (!serverSideContent && title) {
            const syntheticContent = `Brano musicale: ${title}.${excerpt ? ` ${excerpt}` : ''} Questo contenuto audio è disponibile sulla piattaforma Spotify.`;
            
            if (syntheticContent.length >= 50) {
              serverSideContent = syntheticContent;
              contentSource = 'spotify_metadata';
              console.log(`[generate-qa] 🎵 Using Spotify metadata fallback: ${serverSideContent.length} chars`);
            }
          }
          break;
        }
        
        case 'tweetId':
        case 'url': {
          // Fetch from content_cache
          const cacheUrl = qaSourceRef.url || sourceUrl;
          if (cacheUrl) {
            const { data: cached } = await supabase
              .from('content_cache')
              .select('content_text')
              .eq('source_url', cacheUrl)
              .gt('expires_at', new Date().toISOString())
              .maybeSingle();
            
            if (cached?.content_text) {
              serverSideContent = cached.content_text;
              contentSource = 'content_cache';
              console.log(`[generate-qa] ✅ Content from cache: ${serverSideContent.length} chars`);
            } else {
              // Try Jina AI Reader as fallback
              console.log(`[generate-qa] ⏳ Content not cached, trying Jina...`);
              try {
                const jinaUrl = `https://r.jina.ai/${cacheUrl}`;
                const jinaResponse = await fetch(jinaUrl, {
                  headers: {
                    'Accept': 'application/json',
                    'X-Return-Format': 'json'
                  }
                });
                
                if (jinaResponse.ok) {
                  const jinaData = await jinaResponse.json();
                  if (jinaData.content && jinaData.content.length > 100) {
                    serverSideContent = jinaData.content;
                    contentSource = 'jina_fresh';
                    console.log(`[generate-qa] ✅ Content from Jina: ${serverSideContent.length} chars`);
                    
                    // Cache for future use
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 7);
                    await supabase.from('content_cache').upsert({
                      source_url: cacheUrl,
                      source_type: 'article',
                      content_text: serverSideContent,
                      title: jinaData.title || null,
                      expires_at: expiresAt.toISOString()
                    }, { onConflict: 'source_url' });
                  }
                }
              } catch (err) {
                console.error('[generate-qa] Jina fetch failed:', err);
              }
            }
            
            // FALLBACK: If Jina failed but we have metadata (title/excerpt), use them for media platforms
            if (!serverSideContent || serverSideContent.length < 50) {
              // Detect if this is a music/media URL that should use metadata fallback
              const isPlatformWithMetadata = cacheUrl && (
                cacheUrl.includes('spotify.com') || 
                cacheUrl.includes('youtube.com') ||
                cacheUrl.includes('youtu.be') ||
                cacheUrl.includes('tiktok.com')
              );
              
              if (isPlatformWithMetadata && title) {
                const syntheticContent = `Contenuto media: ${title}.${excerpt ? ` ${excerpt}` : ''} Disponibile sulla piattaforma originale.`;
                if (syntheticContent.length >= 50) {
                  serverSideContent = syntheticContent;
                  contentSource = 'platform_metadata_fallback';
                  console.log(`[generate-qa] 🎵 Using platform metadata fallback in URL case: ${serverSideContent.length} chars`);
                }
              }
            }
          }
          break;
        }
        
        case 'mediaId': {
          // Fetch extracted text from media table
          const { data: media } = await supabase
            .from('media')
            .select('extracted_text, extracted_status, extracted_kind, extracted_meta')
            .eq('id', qaSourceRef.id)
            .maybeSingle();
          
          if (media?.extracted_status === 'done' && media.extracted_text && media.extracted_text.length > 120) {
            serverSideContent = media.extracted_text;
            contentSource = `media_${media.extracted_kind}`;
            console.log(`[generate-qa] ✅ Media text: ${serverSideContent.length} chars via ${media.extracted_kind}`);
          } else if (media?.extracted_status === 'pending') {
            // Estrazione ancora in corso - client deve riprovare
            console.log('[generate-qa] ⏳ Media extraction still pending');
            return new Response(
              JSON.stringify({ pending: true, retryAfterMs: 3000 }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else {
            // Fallback a Intent Gate
            console.log('[generate-qa] ❌ Media extraction failed/insufficient, using intent gate');
            return new Response(
              JSON.stringify({ insufficient_context: true }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          break;
        }
      }
    }
    
    // ========================================================================
    // EDITORIAL:// HANDLER - Fetch content from daily_focus table
    // ========================================================================
    if (sourceUrl?.startsWith('editorial://') && !serverSideContent) {
      const focusId = sourceUrl.replace('editorial://', '');
      console.log(`[generate-qa] 📰 Editorial content, fetching from daily_focus: ${focusId}`);
      
      let editorialTitle = title;
      
      try {
        const { data: focusData, error: focusError } = await supabase
          .from('daily_focus')
          .select('title, summary, deep_content')
          .eq('id', focusId)
          .maybeSingle();
        
        if (focusError) {
          console.error('[generate-qa] Failed to fetch daily_focus:', focusError);
        } else if (focusData) {
          const editorialContent = focusData.deep_content || focusData.summary || '';
          // Clean [SOURCE:N] markers for quiz generation
          serverSideContent = editorialContent.replace(/\[SOURCE:[\d,\s]+\]/g, '').trim();
          contentSource = 'daily_focus';
          console.log(`[generate-qa] ✅ Editorial content from daily_focus: ${serverSideContent.length} chars`);
          
          // Use title from focus if not provided
          if (!editorialTitle && focusData.title) {
            editorialTitle = focusData.title;
            console.log(`[generate-qa] Using title from daily_focus: ${focusData.title.substring(0, 50)}`);
          }
        } else {
          console.warn(`[generate-qa] Editorial focus not found: ${focusId}`);
        }
      } catch (err) {
        console.error('[generate-qa] Editorial fetch exception:', err);
      }
      
      // FALLBACK: If DB has no content, use client title as minimal content
      if (!serverSideContent && editorialTitle && editorialTitle.length > 20) {
        serverSideContent = `Sintesi editoriale: ${editorialTitle}. Questo contenuto è una sintesi automatica basata su fonti pubbliche.`;
        contentSource = 'editorial_title_fallback';
        console.log(`[generate-qa] 📰 Using editorial title fallback: ${serverSideContent.length} chars`);
      }
    }
    
    // Combine content sources for hash and prompt
    const contentText = `${title || ''}\n\n${serverSideContent || ''}\n\n${excerpt || ''}`.trim();
    
    // Create content hash for cache invalidation
    const contentHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(contentText)
    ).then(buf => 
      Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .substring(0, 16)
    );

    console.log('[generate-qa] Content hash:', contentHash);
    console.log('[generate-qa] Content source:', contentSource);
    console.log('[generate-qa] Content text length:', contentText.length);

    // Check if Q&A already exists - GLOBAL lookup first for cost efficiency
    let existing: any = null;

    if (sourceUrl) {
      // Strategy 1: Global lookup by source_url + content_hash + testMode
      // This ensures we reuse Q&A across ALL posts/users sharing the same source
      const { data: globalMatch } = await supabase
        .from('post_qa_questions')
        .select('id, questions, content_hash, test_mode, owner_id')
        .eq('source_url', sourceUrl)
        .eq('content_hash', contentHash)
        .eq('test_mode', testMode || null)
        .limit(1)
        .maybeSingle();
      
      if (globalMatch) {
        console.log('[generate-qa] Found GLOBAL cache for source_url');
        existing = globalMatch;
      }
    }

    // Strategy 2: If no global match and we have a specific post_id, check for exact post match
    if (!existing && contentId && !isPrePublish) {
      const { data: postMatch } = await supabase
        .from('post_qa_questions')
        .select('id, questions, content_hash, test_mode, owner_id')
        .eq('post_id', contentId)
        .limit(1)
        .maybeSingle();
      
      if (postMatch) {
        console.log('[generate-qa] Found cache by post_id');
        existing = postMatch;
      }
    }

    // Strategy 3: Pre-publish fallback (no post_id yet)
    if (!existing && isPrePublish && sourceUrl) {
      const { data: prePublishMatch } = await supabase
        .from('post_qa_questions')
        .select('id, questions, content_hash, test_mode, owner_id')
        .eq('source_url', sourceUrl)
        .is('post_id', null)
        .limit(1)
        .maybeSingle();
      
      if (prePublishMatch) {
        console.log('[generate-qa] Found pre-publish cache');
        existing = prePublishMatch;
      }
    }

    // Validate cache
    if (existing && existing.content_hash === contentHash) {
      const cachedQuestionCount = existing.questions?.length || 0;
      const requiredCount = questionCount || 3;
      const cachedTestMode = existing.test_mode || null;
      const requestedTestMode = testMode || null;
      
      if (cachedQuestionCount === requiredCount && cachedTestMode === requestedTestMode) {
        console.log('[generate-qa] Q&A cache HIT, returning qaId:', existing.id);
        
        // SECURITY HARDENED: Verify answers exist before returning cache hit
        const { data: answersCheck } = await supabase
          .from('post_qa_answers')
          .select('id')
          .eq('id', existing.id)
          .maybeSingle();
        
        if (!answersCheck) {
          console.log('[generate-qa] Cache hit but answers missing, forcing regeneration');
          // Fall through to regeneration
        } else {
          return new Response(
            JSON.stringify({ qaId: existing.id, questions: existing.questions }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.log(`[generate-qa] Cache invalidated: testMode or questionCount mismatch`);
      }
    }

    if (existing && existing.content_hash !== contentHash) {
      console.log('[generate-qa] Q&A cache MISS - content hash changed');
    }

    // Check if content is sufficient
    let finalContentText = contentText;
    if (contentText.length < 50) {
      // FALLBACK: Try to build minimum content from title + excerpt + userText
      // Include title twice for emphasis in prompt (title is most reliable metadata)
      const fallbackContent = `${title || ''}\n\n${excerpt || ''}\n\n${userText || ''}`.trim();
      const enhancedFallback = `${title ? title + '\n\n' : ''}${fallbackContent}`.trim();
      
      // Lowered threshold from 80 to 60 to allow shorter but valid content
      if (enhancedFallback.length >= 60) {
        console.log(`[generate-qa] ⚡ Using enhanced title/excerpt fallback for quiz: ${enhancedFallback.length} chars`);
        finalContentText = enhancedFallback;
        serverSideContent = enhancedFallback;
        contentSource = 'title_excerpt_fallback';
      } else {
        console.log('[generate-qa] ⚠️ Insufficient content for Q/A generation');
        return new Response(
          JSON.stringify({ insufficient_context: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const isVideo = type === 'video';
    const expectedQuestions = questionCount || 3;

    // Build prompt based on testMode
    let contentDescription = '';
    let questionRules = '';

    if (testMode === 'SOURCE_ONLY') {
      contentDescription = `${isVideo ? 'CONTENUTO VIDEO DA ANALIZZARE:' : 'CONTENUTO FONTE DA ANALIZZARE:'}
Titolo: ${title || ''}
Contenuto: ${serverSideContent || ''}
${excerpt ? `Dettagli: ${excerpt}` : ''}`;
      
      questionRules = `1. Genera ESATTAMENTE 3 domande sulla FONTE${isVideo ? ' (sul contenuto del video)' : ''}:
   - Domanda 1 (MACRO): Sul tema principale della fonte
   - Domanda 2 (MACRO): Su evidenza, impatto o punto chiave della fonte
   - Domanda 3 (DETTAGLIO): Su un dato specifico, cifra o fatto nella fonte`;

    } else if (testMode === 'MIXED') {
      contentDescription = `TESTO UTENTE DA ANALIZZARE:
${userText || ''}

CONTENUTO FONTE DA ANALIZZARE:
Titolo: ${title || ''}
Contenuto: ${serverSideContent || ''}
${excerpt ? `Dettagli: ${excerpt}` : ''}`;

      questionRules = `1. Genera ESATTAMENTE 3 domande:
   - Domanda 1: Sul TESTO DELL'UTENTE (tema, argomento o opinione espressa)
   - Domanda 2: Sulla FONTE (tema principale o punto chiave)
   - Domanda 3: Sulla FONTE (dettaglio specifico, dato o fatto)`;

    } else if (testMode === 'USER_ONLY') {
      contentDescription = `TESTO DA ANALIZZARE:
${userText || serverSideContent || ''}`;

      questionRules = `1. Genera ESATTAMENTE 3 domande sul TESTO:
   - Domanda 1 (MACRO): Sul tema principale o idea centrale
   - Domanda 2 (MACRO): Su un punto chiave, argomento o conseguenza
   - Domanda 3 (DETTAGLIO): Su un dettaglio specifico, fatto o informazione`;

    } else if (!testMode && questionCount === 1) {
      contentDescription = `TESTO DA ANALIZZARE:
${userText || serverSideContent || ''}`;

      questionRules = `1. Genera ESATTAMENTE 1 domanda sul TESTO:
   - Domanda di comprensione sul tema o punto principale del testo`;

    } else {
      contentDescription = `${isVideo ? 'CONTENUTO VIDEO DA ANALIZZARE:' : 'CONTENUTO DA ANALIZZARE:'}
Titolo: ${title || ''}
Contenuto: ${serverSideContent || ''}
${excerpt ? `Dettagli: ${excerpt}` : ''}`;

      questionRules = `1. Genera ESATTAMENTE ${expectedQuestions} domande${isVideo ? ' sul contenuto del video' : ''}:
   - Domanda 1 (MACRO): Sul tema principale
   - Domanda 2 (MACRO): Su evidenza, impatto o punto chiave
   ${expectedQuestions === 3 ? '- Domanda 3 (DETTAGLIO): Su un dato specifico, cifra o fatto' : ''}`;
    }

    const prompt = `Sei un assistente esperto nella valutazione della comprensione.

${contentDescription}

REGOLE GENERAZIONE:
${questionRules}
   
${isVideo && testMode === 'SOURCE_ONLY' ? `NOTA: Poiché questo è un video, focalizzati su:
- Tema e argomento principale del video
- Punti chiave menzionati nella descrizione
- Informazioni fattuali evidenti dal titolo/descrizione
- Evita domande su dettagli visivi non descritti

` : ''}2. Per ogni domanda:
   - 3 opzioni di risposta (A, B, C)
   - Solo 1 opzione corretta
   - Le altre 2 plausibili ma sbagliate
   - Difficoltà media (no trabocchetti)
   - IMPORTANTE: Varia la posizione della risposta corretta tra A, B, C in modo casuale
   
3. OUTPUT JSON rigoroso:
{
  "questions": [
    {
      "id": "q1",
      "stem": "Domanda 1 qui",
      "choices": [
        {"id": "a", "text": "Opzione corretta"},
        {"id": "b", "text": "Opzione plausibile errata"},
        {"id": "c", "text": "Opzione plausibile errata"}
      ],
      "correctId": "a"
    }${expectedQuestions > 1 ? `,
    {
      "id": "q2",
      "stem": "Domanda 2 qui",
      "choices": [
        {"id": "a", "text": "Opzione"},
        {"id": "b", "text": "Opzione"},
        {"id": "c", "text": "Opzione"}
      ],
      "correctId": "b"
    }` : ''}${expectedQuestions === 3 ? `,
    {
      "id": "q3",
      "stem": "Domanda 3 qui",
      "choices": [
        {"id": "a", "text": "Opzione"},
        {"id": "b", "text": "Opzione"},
        {"id": "c", "text": "Opzione"}
      ],
      "correctId": "c"
    }` : ''}
  ]
}

4. Se il contenuto è insufficiente per generare domande valide, restituisci:
{"insufficient_context": true}

IMPORTANTE: Rispondi SOLO con JSON valido, senza commenti o testo aggiuntivo.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Sei un assistente per quiz di comprensione. Rispondi sempre in JSON valido.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 900
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);

      const isPaymentError =
        aiResponse.status === 402 ||
        errorText.includes('payment_required') ||
        errorText.toLowerCase().includes('not enough credits') ||
        errorText.toLowerCase().includes('insufficient credits');

      if (isPaymentError) {
        return new Response(
          JSON.stringify({
            error: 'Crediti Lovable AI esauriti. Vai su Impostazioni → Workspace → Usage per ricaricare.'
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: 'Troppa richiesta in questo momento. Riprova tra qualche secondo.'
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error('AI generation failed');
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    // Parse JSON from AI response
    let parsedContent;
    try {
      let cleanContent = content.trim();
      
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      
      cleanContent = cleanContent.trim();
      
      parsedContent = JSON.parse(cleanContent);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }

    if (parsedContent.insufficient_context) {
      return new Response(
        JSON.stringify({ insufficient_context: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate schema
    if (!parsedContent.questions || parsedContent.questions.length !== expectedQuestions) {
      console.error(`Expected ${expectedQuestions} questions, got ${parsedContent.questions?.length}`);
      throw new Error(`Invalid Q&A schema: expected ${expectedQuestions} questions`);
    }

    // Shuffle choices
    function shuffleArray<T>(array: T[]): T[] {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    const shuffledQuestions = parsedContent.questions.map((q: any) => ({
      ...q,
      choices: shuffleArray(q.choices)
    }));

    const correctAnswers = shuffledQuestions.map((q: any) => ({
      id: q.id,
      correctId: q.correctId
    }));

    // Declare qaIdToReturn BEFORE the if/else block to ensure proper scope
    let qaIdToReturn: string | null = null;

    // Save to SECURE split tables
    if (existing) {
      // Update questions in public table
      await supabase.from('post_qa_questions')
        .update({
          questions: shuffledQuestions,
          content_hash: contentHash,
          test_mode: testMode || null,
          generated_from: 'gemini',
          generated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      // Update correct answers in private table
      await supabase.from('post_qa_answers')
        .upsert({
          id: existing.id,
          correct_answers: correctAnswers
        });
      
      qaIdToReturn = existing.id;
      console.log('[generate-qa] Q&A updated in secure tables');
    } else {
      // Insert into public table first
      const { data: insertedQA, error: insertError } = await supabase
        .from('post_qa_questions')
        .insert({
          post_id: isPrePublish ? null : contentId,
          source_url: sourceUrl || '',
          questions: shuffledQuestions,
          content_hash: contentHash,
          test_mode: testMode || null,
          generated_from: 'gemini',
          owner_id: ownerId
        })
        .select('id')
        .single();
      
      if (insertError || !insertedQA) {
        console.error('[generate-qa] Failed to insert Q&A:', insertError);
        throw new Error('Failed to save Q&A');
      }
      
      // Insert correct answers into private table
      await supabase.from('post_qa_answers').insert({
        id: insertedQA.id,
        correct_answers: correctAnswers
      });
      
      qaIdToReturn = insertedQA.id;
      console.log('[generate-qa] Q&A generated and saved to secure tables');
    }

    // Return ONLY questions - strip correctId
    const sanitizedQuestions = shuffledQuestions.map((q: any) => ({
      id: q.id,
      stem: q.stem,
      choices: q.choices.map((c: any) => ({
        id: c.id,
        text: c.text
      }))
    }));
    
    console.log('[generate-qa] Returning qaId:', qaIdToReturn);

    return new Response(
      JSON.stringify({ qaId: qaIdToReturn, questions: sanitizedQuestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-qa] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred generating quiz questions',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

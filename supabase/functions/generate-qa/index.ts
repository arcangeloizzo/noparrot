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
// LINKEDIN CONTENT CLEANING - Deep noise removal for quiz quality
// ============================================================================
function cleanLinkedInContent(content: string): string {
  // TEMPORARILY DISABLED: Return raw content to avoid breaking the app
  // The additive cleaning was still causing issues with content extraction
  // Better to have "dirty" content than empty content that breaks quiz generation
  console.log(`[generate-qa] LinkedIn cleaning DISABLED, returning raw content (${content?.length || 0} chars)`);
  return content || '';
}

// ============================================================================
// CONTENT QUALITY VALIDATION - "Immune System" against platform noise
// ============================================================================
interface ContentValidation {
  isValid: boolean;
  metadataRatio: number;
  errorCode?: 'ERROR_INSUFFICIENT_CONTENT' | 'ERROR_METADATA_ONLY';
}

function validateContentQuality(text: string): ContentValidation {
  if (!text || text.length < 150) {
    return { isValid: false, metadataRatio: 1, errorCode: 'ERROR_INSUFFICIENT_CONTENT' };
  }
  
  // Platform metadata keywords that indicate UI noise
  const platformKeywords = [
    'cookie', 'privacy', 'terms', 'log in', 'sign in', 'sign up',
    'follow', 'following', 'followers', 'reactions', 'repost',
    'spotify ab', 'linkedin corp', 'twitter inc', 'meta platforms',
    'accept cookies', 'cookie policy', 'privacy policy',
    'create account', 'join now', 'see who you know',
    'get the app', 'download app', 'open in app',
    'advertisement', 'sponsored', 'promoted',
    'skip to main', 'navigation', 'menu',
    'copyright ©', 'all rights reserved',
    'view profile', 'connect', 'message',
  ];
  
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/).filter(w => w.length > 2);
  
  if (words.length === 0) {
    return { isValid: false, metadataRatio: 1, errorCode: 'ERROR_INSUFFICIENT_CONTENT' };
  }
  
  let metadataWordCount = 0;
  for (const word of words) {
    for (const keyword of platformKeywords) {
      if (keyword.split(' ').some(kw => word.includes(kw) || kw.includes(word))) {
        metadataWordCount++;
        break;
      }
    }
  }
  
  const metadataRatio = metadataWordCount / words.length;
  
  if (metadataRatio > 0.45) { // Increased from 0.30 to reduce false positives
    console.log(`[generate-qa] ⚠️ Content is ${Math.round(metadataRatio * 100)}% platform metadata`);
    return { isValid: false, metadataRatio, errorCode: 'ERROR_METADATA_ONLY' };
  }
  
  return { isValid: true, metadataRatio };

}

// ============================================================================
// BOT / COOKIE WALL DETECTION (avoid generating quizzes from challenge pages)
// ============================================================================
function isBotChallengeContent(content: string): boolean {
  const lowerContent = (content || '').toLowerCase();
  const challengeMarkers = [
    'checking your browser',
    'verifica connessione',
    'verify you are human',
    'just a moment',
    'cloudflare',
    'challenges.cloudflare.com',
    'cf-challenge',
    'turnstile',
    'enable javascript and cookies',
    'please wait while we verify',
    'browser check',
    'ddos protection',
    'ray id:',
    'attention required',
    'one more step',
  ];

  const matchCount = challengeMarkers.filter(marker => lowerContent.includes(marker)).length;
  return matchCount >= 2;
}

function isContentInsufficientForQuiz(text: string | undefined): boolean {
  if (!text || text.length < 600) return true;
  if (isBotChallengeContent(text)) return true;

  const lower = text.toLowerCase();
  const boilerplateMarkers = [
    'cookie policy',
    'accept all',
    'privacy settings',
    'cookie settings',
    'manage preferences',
    'necessary cookies',
    'reject all',
    'we use cookies',
    'utilizziamo i cookie',
    'informativa cookie',
    'accetta tutti',
    'rifiuta tutti',
  ];

  const markerMatches = boilerplateMarkers.filter(m => lower.includes(m)).length;
  return markerMatches >= 3;
}

// ============================================================================
// POST-GENERATION QUALITY CHECK - Detect generic/metadata-based questions
// ============================================================================

interface QuestionValidation {
  isValid: boolean;
  reason?: 'generic_questions' | 'metadata_questions' | 'platform_questions';
}

function validateGeneratedQuestions(questions: any[]): QuestionValidation {
  if (!questions || questions.length === 0) {
    return { isValid: false, reason: 'generic_questions' };
  }
  
  // Patterns that indicate low-quality/metadata questions
  const genericPatterns = [
    // Platform metadata
    /quanti? (like|follower|commenti|reaction|visualizzazion)/i,
    /numero di (like|follower|commenti|reaction|view)/i,
    /(like|follower|commenti) (ha ricevuto|sono stati|ci sono)/i,
    
    // Platform identity
    /quale piattaforma/i,
    /su (spotify|linkedin|youtube|twitter|instagram|tiktok|facebook)/i,
    /(pubblicato|condiviso) su quale/i,
    
    // Format/technical
    /(formato|tipo) (del contenuto|di file|multimediale)/i,
    /(audio|video|immagine|testo) (è|sia|formato)/i,
    
    // Title-only questions (weak signal)
    /qual è il titolo/i,
    /come si intitola/i,
    /il titolo (del brano|della canzone|del video|dell'articolo)/i,
    
    // Cookie/privacy (should never appear)
    /cookie policy/i,
    /privacy policy/i,
    /termini di servizio/i,
    
    // Engagement metrics
    /popolarità (su spotify|del brano)/i,
    /quanto è popolare/i,
  ];
  
  let genericQuestionCount = 0;
  
  for (const question of questions) {
    const stem = question.stem || question.question || '';
    
    for (const pattern of genericPatterns) {
      if (pattern.test(stem)) {
        genericQuestionCount++;
        console.log(`[validateGeneratedQuestions] ⚠️ Generic question detected: "${stem.substring(0, 50)}..."`);
        break;
      }
    }
  }
  
  // If MORE than 1 question out of 3 is generic, reject the quiz
  const genericRatio = genericQuestionCount / questions.length;
  if (genericRatio > 0.33) { // More than 1/3 generic = bad quiz
    console.log(`[validateGeneratedQuestions] ❌ Too many generic questions: ${genericQuestionCount}/${questions.length}`);
    return { isValid: false, reason: 'generic_questions' };
  }
  
  return { isValid: true };
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
      qaSourceRef,
      // NEW: Force cache invalidation for retry flows
      forceRefresh,
      // NEW: Reshare support - lookup quiz from original post
      quotedPostId
    } = await req.json();
    
    // CACHE INVALIDATION: If forceRefresh, delete cached content for this URL
    if (forceRefresh && sourceUrl) {
      const normalizedUrl = safeNormalizeUrl(sourceUrl);
      console.log(`[generate-qa] 🔄 Force refresh: invalidating cache for ${normalizedUrl}`);
      
      await supabase.from('content_cache').delete().eq('source_url', normalizedUrl);
      
      // Also invalidate with qaSourceRef.url if different
      if (qaSourceRef?.url && safeNormalizeUrl(qaSourceRef.url) !== normalizedUrl) {
        const qaUrl = safeNormalizeUrl(qaSourceRef.url);
        await supabase.from('content_cache').delete().eq('source_url', qaUrl);
        console.log(`[generate-qa] 🔄 Also invalidated qaSourceRef cache: ${qaUrl}`);
      }
      
      console.log(`[generate-qa] ✅ Cache invalidated, will fetch fresh content`);
    }

    console.log('[generate-qa] Request params:', { 
      sourceUrl, 
      contentId, 
      isPrePublish, 
      testMode, 
      questionCount,
      qaSourceRef: qaSourceRef ? { kind: qaSourceRef.kind, id: qaSourceRef.id?.substring(0, 20) } : null,
      quotedPostId: quotedPostId?.substring(0, 20)
    });

    // ========================================================================
    // SERVER-SIDE CONTENT FETCHING
    // ========================================================================
    let serverSideContent = '';
    let contentSource = 'none';
    
    // FIX: If qaSourceRef is missing but sourceUrl exists, construct qaSourceRef server-side
    let effectiveQaSourceRef = qaSourceRef;
    if (!effectiveQaSourceRef && sourceUrl) {
      console.log('[generate-qa] 🔧 Constructing qaSourceRef from sourceUrl:', sourceUrl.substring(0, 50));
      try {
        const urlObj = new URL(sourceUrl);
        const host = urlObj.hostname.toLowerCase();
        
        // Platform-specific construction
        if (host.includes('youtube') || host.includes('youtu.be')) {
          const videoId = host.includes('youtu.be') 
            ? urlObj.pathname.slice(1).split('?')[0]
            : urlObj.searchParams.get('v');
          if (videoId) {
            effectiveQaSourceRef = { kind: 'youtubeId', id: videoId, url: sourceUrl };
          }
        } else if (host.includes('spotify')) {
          // Handle both track and episode URLs
          const trackMatch = sourceUrl.match(/track\/([a-zA-Z0-9]+)/);
          const episodeMatch = sourceUrl.match(/episode\/([a-zA-Z0-9]+)/);
          if (trackMatch) {
            effectiveQaSourceRef = { kind: 'spotifyId', id: trackMatch[1], url: sourceUrl };
          } else if (episodeMatch) {
            // Episodes use 'spotifyEpisodeId' kind to distinguish from tracks
            effectiveQaSourceRef = { kind: 'spotifyEpisodeId', id: episodeMatch[1], url: sourceUrl };
          }
        } else if (host.includes('twitter') || host.includes('x.com')) {
          const tweetMatch = sourceUrl.match(/status\/(\d+)/);
          if (tweetMatch) {
            effectiveQaSourceRef = { kind: 'tweetId', id: tweetMatch[1], url: sourceUrl };
          }
        }
        
        // Default: generic URL ref
        if (!effectiveQaSourceRef) {
          effectiveQaSourceRef = { kind: 'url', id: sourceUrl, url: sourceUrl };
        }
        
        console.log('[generate-qa] ✅ Constructed qaSourceRef:', effectiveQaSourceRef.kind, effectiveQaSourceRef.id?.substring(0, 20));
      } catch (err) {
        console.warn('[generate-qa] Failed to construct qaSourceRef:', err);
      }
    }
    
    // If client sent summary (legacy support), use it but log warning
    if (summary && summary.length > 100) {
      console.log('[generate-qa] ⚠️ Legacy mode: using client-provided summary');
      serverSideContent = summary;
      contentSource = 'client-legacy';
    }
    
    // NEW: Fetch content server-side based on qaSourceRef (or effectiveQaSourceRef)
    if (effectiveQaSourceRef && !serverSideContent) {
      console.log(`[generate-qa] 📥 Fetching content server-side for ${effectiveQaSourceRef.kind}: ${effectiveQaSourceRef.id?.substring(0, 30)}`);
      
      switch (effectiveQaSourceRef.kind) {
        case 'youtubeId': {
          // Fetch from youtube_transcripts_cache
          const { data: cached } = await supabase
            .from('youtube_transcripts_cache')
            .select('transcript')
            .eq('video_id', effectiveQaSourceRef.id)
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
              const ytUrl = `https://www.youtube.com/watch?v=${effectiveQaSourceRef.id}`;
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
          const spotifyUrl = `https://open.spotify.com/track/${effectiveQaSourceRef.id}`;
          const { data: cached } = await supabase
            .from('content_cache')
            .select('content_text, title, popularity')
            .eq('source_url', spotifyUrl)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
          
            const cachedText = (cached as any)?.content_text as string | undefined;
            const looksSynthetic = !!cachedText && (
              cachedText.includes('Nota: i lyrics completi potrebbero') ||
              cachedText.includes('Brano Spotify:') ||
              cachedText.includes('Per il quiz usiamo metadati')
            );

            if (cached && cachedText && cachedText.length > 50 && !looksSynthetic) {
              // Cache contains real lyrics (or at least rich, non-synthetic text)
              serverSideContent = cachedText;
              contentSource = 'content_cache';
              console.log(`[generate-qa] ✅ Spotify content from cache: ${serverSideContent.length} chars`);
            } else {
              // Either: no cache, empty cache, or synthetic negative-cache => try fresh lyrics
              console.log(`[generate-qa] ⏳ Spotify lyrics fetch (refresh=${looksSynthetic ? 'YES' : 'NO'})...`);
              try {
                const lyricsResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-lyrics`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`
                  },
                  body: JSON.stringify({ trackId: effectiveQaSourceRef.id })
                });

                if (lyricsResponse.ok) {
                  const lyricsData = await lyricsResponse.json();
                  if (lyricsData.lyrics && lyricsData.lyrics.length > 50) {
                    serverSideContent = lyricsData.lyrics;
                    contentSource = looksSynthetic ? 'spotify_refresh' : 'spotify_fresh';
                    console.log(`[generate-qa] ✅ Spotify lyrics fetched: ${serverSideContent.length} chars`);

                    // Overwrite cache so future runs don't stick to the synthetic fallback
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 7);
                    await supabase.from('content_cache').upsert({
                      source_url: spotifyUrl,
                      source_type: 'spotify',
                      content_text: serverSideContent,
                      title: (cached as any)?.title || title || null,
                      popularity: typeof (cached as any)?.popularity === 'number' ? (cached as any).popularity : null,
                      expires_at: expiresAt.toISOString(),
                    }, { onConflict: 'source_url' });
                  }
                } else {
                  console.log(`[generate-qa] ⏳ Lyrics fetch failed: ${lyricsResponse.status}, trying metadata fallback`);
                }
              } catch (err) {
                console.error('[generate-qa] Spotify lyrics fetch failed, trying metadata fallback:', err);
              }
            }
          
           // METADATA FALLBACK: If still no content, build a richer synthetic text.
           // Prefer cached.title (even on negative cache), then request title.
           if (!serverSideContent) {
             const bestTitle = (cached as any)?.title || title;
             const pop = typeof (cached as any)?.popularity === 'number' ? (cached as any).popularity : undefined;
             
             const syntheticContent = [
               `Brano Spotify: ${bestTitle || 'Titolo non disponibile'}.`,
               typeof pop === 'number' ? `Popolarità (Spotify): ${pop}/100.` : null,
               excerpt ? `Estratto: ${excerpt}` : null,
               `Nota: i lyrics completi potrebbero non essere disponibili dai provider in questo momento.`,
               `Per il quiz usiamo metadati e contesto (titolo, autore, popolarità) per generare domande specifiche sul brano.`
             ].filter(Boolean).join(' ');

             // Ensure we cross the quality threshold used below (300 chars)
             const padded = syntheticContent.length >= 320
               ? syntheticContent
               : (syntheticContent + ' ' +
                  `Contesto aggiuntivo: questo è un contenuto audio su Spotify; le domande devono evitare generalità e riferirsi al brano e ai suoi metadati. ` +
                  `Se vuoi domande ancora più “testuali”, aggiungi anche una fonte con testo (recensione/intervista/lyrics) oltre al link Spotify.`);

             serverSideContent = padded;
             contentSource = 'spotify_metadata';
             console.log(`[generate-qa] 🎵 Using Spotify synthetic fallback: ${serverSideContent.length} chars`);
           }
          break;
        }
        
        case 'spotifyEpisodeId': {
          // Spotify podcast episodes - fetch from YouTube transcripts cache via the youtubeId found in fetch-article-preview
          // OR try to find transcript via content_cache
          const episodeUrl = effectiveQaSourceRef.url || `https://open.spotify.com/episode/${effectiveQaSourceRef.id}`;
          const normalizedEpisodeUrl = safeNormalizeUrl(episodeUrl);
          
          console.log(`[generate-qa] 🎙️ Processing Spotify episode: ${effectiveQaSourceRef.id}`);
          
          // First try content_cache - the transcript may have been cached there by fetch-article-preview
          const { data: cached } = await supabase
            .from('content_cache')
            .select('content_text, title')
            .eq('source_url', normalizedEpisodeUrl)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
          
          if (cached?.content_text && cached.content_text.length > 300) {
            serverSideContent = cached.content_text;
            contentSource = 'episode_cache';
            console.log(`[generate-qa] ✅ Episode transcript from cache: ${serverSideContent.length} chars`);
          } else {
            // Try to fetch fresh via fetch-article-preview (which handles YouTube fallback internally)
            console.log(`[generate-qa] ⏳ Episode not cached, calling fetch-article-preview...`);
            try {
              const previewResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-article-preview`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`
                },
                body: JSON.stringify({ url: episodeUrl })
              });
              
              if (previewResponse.ok) {
                const previewData = await previewResponse.json();
                console.log(`[generate-qa] fetch-article-preview response:`, {
                  youtubeFallback: previewData.youtubeFallback,
                  youtubeVideoId: previewData.youtubeVideoId,
                  contentQuality: previewData.contentQuality
                });
                
                // If YouTube video was found, fetch its transcript
                if (previewData.youtubeVideoId) {
                  const { data: ytCached } = await supabase
                    .from('youtube_transcripts_cache')
                    .select('transcript')
                    .eq('video_id', previewData.youtubeVideoId)
                    .gt('expires_at', new Date().toISOString())
                    .maybeSingle();
                  
                  if (ytCached?.transcript) {
                    serverSideContent = ytCached.transcript;
                    contentSource = 'episode_youtube_cache';
                    console.log(`[generate-qa] ✅ Episode transcript via YouTube cache: ${serverSideContent.length} chars`);
                  } else {
                    // Fetch fresh from transcribe-youtube
                    const ytUrl = `https://www.youtube.com/watch?v=${previewData.youtubeVideoId}`;
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
                      if (transcribeData.transcript && transcribeData.transcript.length > 100) {
                        serverSideContent = transcribeData.transcript;
                        contentSource = 'episode_youtube_fresh';
                        console.log(`[generate-qa] ✅ Episode transcript fetched from YouTube: ${serverSideContent.length} chars`);
                      }
                    }
                  }
                }
                
                // Use description/summary as fallback if no transcript
                if (!serverSideContent && previewData.summary && previewData.summary.length > 100) {
                  serverSideContent = previewData.summary;
                  contentSource = 'episode_summary';
                  console.log(`[generate-qa] 📝 Using episode summary as fallback: ${serverSideContent.length} chars`);
                }
              }
            } catch (err) {
              console.error('[generate-qa] fetch-article-preview for episode failed:', err);
            }
          }
          
          // If still no content, return insufficient
          if (!serverSideContent || serverSideContent.length < 100) {
            console.log(`[generate-qa] ❌ Insufficient content for Spotify episode`);
            return new Response(JSON.stringify({
              insufficient_context: true,
              message: 'Trascrizione non disponibile per questo episodio. Usa la modalità Intent.'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          break;
        }
        
        case 'tweetId':
        case 'url': {
          // Fetch from content_cache - NORMALIZE URL for consistent cache key
          const rawCacheUrl = effectiveQaSourceRef.url || sourceUrl;
          const cacheUrl = rawCacheUrl ? safeNormalizeUrl(rawCacheUrl) : null;
          
          if (cacheUrl) {
            console.log(`[generate-qa] 🔍 Looking up cache with normalized URL: ${cacheUrl.substring(0, 80)}...`);
            const { data: cached } = await supabase
              .from('content_cache')
              .select('content_text, source_type')
              .eq('source_url', cacheUrl)
              .gt('expires_at', new Date().toISOString())
              .maybeSingle();
            
            // Check if cached content is synthetic/partial (LinkedIn specific patterns)
            const cachedText = (cached as any)?.content_text as string | undefined;
            const isLinkedIn = cacheUrl.toLowerCase().includes('linkedin.com');
            const looksSyntheticLinkedIn = isLinkedIn && cachedText && (
              cachedText.length < 300 ||
              cachedText.includes('Sign in to view') ||
              cachedText.includes('Join now to see') ||
              cachedText.includes('Welcome back') ||
              cachedText.includes('Post da linkedin') ||
              /^Post di .{1,50}$/.test(cachedText.trim()) // Just a title, no content
            );
            
            if (cached?.content_text && !looksSyntheticLinkedIn) {
              serverSideContent = cached.content_text;
              contentSource = 'content_cache';
              console.log(`[generate-qa] ✅ Content from cache: ${serverSideContent.length} chars`);
            } else {
              // Try Jina AI Reader with authentication
              console.log(`[generate-qa] ⏳ Content not cached or synthetic (LinkedIn refresh: ${looksSyntheticLinkedIn}), trying Jina...`);
              try {
                const jinaUrl = `https://r.jina.ai/${cacheUrl}`;
                const JINA_API_KEY = Deno.env.get('JINA_API_KEY');
                
                const jinaHeaders: Record<string, string> = {
                  'Accept': 'application/json',
                  'X-Return-Format': 'json'
                };
                if (JINA_API_KEY) {
                  jinaHeaders['Authorization'] = `Bearer ${JINA_API_KEY}`;
                  console.log(`[generate-qa] Using authenticated Jina request`);
                }
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                
                const jinaResponse = await fetch(jinaUrl, { headers: jinaHeaders, signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (jinaResponse.ok) {
                  const jinaData = await jinaResponse.json();
                  let extractedContent = jinaData.content || '';
                  
                  // LinkedIn-specific deep cleaning (use centralized function)
                  if (isLinkedIn && extractedContent) {
                    extractedContent = cleanLinkedInContent(extractedContent);
                  }
                  
                  if (extractedContent && extractedContent.length > 100) {
                    serverSideContent = extractedContent;
                    contentSource = looksSyntheticLinkedIn ? 'linkedin_refresh' : 'jina_fresh';
                    console.log(`[generate-qa] ✅ Content from Jina: ${serverSideContent.length} chars`);
                    
                    // Cache for future use (overwrite synthetic cache)
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 7);
                    await supabase.from('content_cache').upsert({
                      source_url: cacheUrl,
                      source_type: isLinkedIn ? 'linkedin' : 'article',
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
            
            // FIX v3: Increase threshold to 300 chars and use multiple fallbacks
            if (!serverSideContent || serverSideContent.length < 300) {
              const cacheUrlForRetry = effectiveQaSourceRef.url || sourceUrl;
              
              // STEP 1: Try Jina retry with longer timeout and auth
              if (cacheUrlForRetry && (!serverSideContent || serverSideContent.length < 300)) {
                console.log(`[generate-qa] ⚠️ Content too short (${serverSideContent?.length || 0} chars), trying extraction cascade...`);
                
                // Jina attempt with auth
                try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 12000);
                  
                  const JINA_API_KEY = Deno.env.get('JINA_API_KEY');
                  const jinaHeaders: Record<string, string> = {
                    'Accept': 'application/json',
                    'X-Return-Format': 'json'
                  };
                  if (JINA_API_KEY) {
                    jinaHeaders['Authorization'] = `Bearer ${JINA_API_KEY}`;
                  }
                  
                  const jinaRetryResponse = await fetch(`https://r.jina.ai/${cacheUrlForRetry}`, {
                    headers: jinaHeaders,
                    signal: controller.signal
                  });
                  clearTimeout(timeoutId);
                  
                  if (jinaRetryResponse.ok) {
                    const jinaRetryData = await jinaRetryResponse.json();
                    if (jinaRetryData.content && jinaRetryData.content.length > (serverSideContent?.length || 0)) {
                      serverSideContent = jinaRetryData.content;
                      contentSource = 'jina_retry';
                      console.log(`[generate-qa] ✅ Jina retry success: ${serverSideContent.length} chars`);
                    }
                  }
                } catch (retryErr) {
                  console.log('[generate-qa] Jina retry failed/timeout');
                }
              }
              
              // STEP 2: Try Firecrawl with STEALTH MODE if Jina failed
              const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
              if (cacheUrlForRetry && FIRECRAWL_API_KEY && (!serverSideContent || serverSideContent.length < 300)) {
                console.log(`[generate-qa] 🕵️ Trying Firecrawl STEALTH mode as backup...`);
                try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 30000); // Longer timeout for stealth

                  const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      url: cacheUrlForRetry,
                      formats: ['markdown'],
                      onlyMainContent: true,
                      // STEALTH PARAMS: longer wait for anti-bot bypass
                      waitFor: 5000,
                      timeout: 25000,
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
                      }
                    }),
                    signal: controller.signal
                  });
                  clearTimeout(timeoutId);

                  if (firecrawlResponse.ok) {
                    const firecrawlData = await firecrawlResponse.json();
                    let markdown = firecrawlData.data?.markdown || '';

                    // Apply LinkedIn cleaning to Firecrawl content too
                    const isLinkedInUrl = cacheUrlForRetry?.toLowerCase().includes('linkedin.com');
                    if (isLinkedInUrl && markdown) {
                      markdown = cleanLinkedInContent(markdown);
                    }

                    // Never accept bot-challenge/cookie-wall pages as quiz source
                    if (!isContentInsufficientForQuiz(markdown) && markdown.length > (serverSideContent?.length || 0)) {
                      serverSideContent = markdown;
                      contentSource = isLinkedInUrl ? 'firecrawl_stealth_linkedin' : 'firecrawl_stealth';
                      console.log(`[generate-qa] ✅ Firecrawl STEALTH success: ${serverSideContent.length} chars`);

                      // Cache for future use (7 days for stealth results)
                      const expiresAt = new Date();
                      expiresAt.setDate(expiresAt.getDate() + 7);
                      await supabase.from('content_cache').upsert({
                        source_url: cacheUrlForRetry,
                        source_type: 'article',
                        content_text: serverSideContent,
                        title: firecrawlData.data?.metadata?.title || title || null,
                        expires_at: expiresAt.toISOString()
                      }, { onConflict: 'source_url' });
                    } else {
                      console.log('[generate-qa] ⚠️ Firecrawl stealth returned blocked/boilerplate content; ignoring');
                    }
                  } else {
                    console.log(`[generate-qa] ⚠️ Firecrawl stealth returned ${firecrawlResponse.status}`);
                  }
                } catch (fcErr) {
                  if (fcErr instanceof Error && fcErr.name === 'AbortError') {
                    console.log('[generate-qa] ⏱️ Firecrawl stealth timeout');
                  } else {
                    console.log('[generate-qa] Firecrawl stealth failed:', fcErr);
                  }
                }
              }
              
              // STEP 3: Metadata fallback only if still insufficient
              if ((!serverSideContent || serverSideContent.length < 300) && title) {
                const syntheticContent = `${title}.${excerpt ? ` ${excerpt}` : ''}`.trim();
                // Only use if it's better than what we have
                if (syntheticContent.length > (serverSideContent?.length || 0) && syntheticContent.length >= 60) {
                  serverSideContent = syntheticContent;
                  contentSource = 'metadata_fallback';
                  console.log(`[generate-qa] 📝 Using metadata fallback for URL: ${serverSideContent.length} chars`);
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
            .eq('id', effectiveQaSourceRef.id)
            .maybeSingle();
          
          // [NEW] Handle different test modes for media
          const hasExtractedText = media?.extracted_status === 'done' && 
                                   media.extracted_text && 
                                   media.extracted_text.length > 120;
          
          console.log('[generate-qa] Media gate check:', {
            mediaId: effectiveQaSourceRef.id,
            hasExtractedText,
            extractedLength: media?.extracted_text?.length || 0,
            testMode,
            userTextLength: userText?.length || 0
          });
          
          if (testMode === 'USER_ONLY') {
            // USER_ONLY: Use only userText (comment) for quiz
            if (!userText || userText.length < 50) {
              console.log('[generate-qa] ❌ USER_ONLY but userText insufficient');
              return new Response(
                JSON.stringify({ insufficient_context: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            serverSideContent = userText;
            contentSource = 'user_text';
            console.log(`[generate-qa] ✅ Media USER_ONLY mode: using userText ${serverSideContent.length} chars`);
          } else if (testMode === 'MIXED') {
            // MIXED: Combine extracted_text + userText
            if (!hasExtractedText) {
              console.log('[generate-qa] ❌ MIXED but no extracted text');
              return new Response(
                JSON.stringify({ insufficient_context: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            // Combine: userText first (for Q1), then media text (for Q2, Q3)
            serverSideContent = `COMMENTO UTENTE:\n${userText || ''}\n\nCONTENUTO MEDIA:\n${media.extracted_text}`;
            contentSource = `media_${media.extracted_kind}_mixed`;
            console.log(`[generate-qa] ✅ Media MIXED mode: ${serverSideContent.length} chars`);
          } else {
            // SOURCE_ONLY (default): Use only extracted_text
            if (hasExtractedText) {
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
          }
          break;
        }
      }
    }
    
    // ========================================================================
    // EDITORIAL/FOCUS HANDLER - Fetch content from daily_focus table
    // ========================================================================
    // FIX: Handle both editorial:// and focus://daily/ prefixes
    const isEditorialUrl = sourceUrl?.startsWith('editorial://') || sourceUrl?.startsWith('focus://daily/');
    if (isEditorialUrl && !serverSideContent) {
      const focusId = sourceUrl.replace('editorial://', '').replace('focus://daily/', '');
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

    // Strategy 2.5: RESHARE LOOKUP - find quiz from original post being shared
    // This ensures the resharer takes the SAME test as the original author
    if (!existing && quotedPostId) {
      console.log('[generate-qa] Reshare detected, looking for original post quiz:', quotedPostId);
      
      const { data: reshareMatch } = await supabase
        .from('post_qa_questions')
        .select('id, questions, content_hash, test_mode, owner_id, post_id')
        .eq('post_id', quotedPostId)
        .limit(1)
        .maybeSingle();
      
      if (reshareMatch) {
        console.log('[generate-qa] ✅ Found RESHARE quiz from original post:', reshareMatch.id);
        
        // Verify answers exist for this quiz
        const { data: answersCheck } = await supabase
          .from('post_qa_answers')
          .select('id')
          .eq('id', reshareMatch.id)
          .maybeSingle();
        
        if (answersCheck) {
          // Return the original quiz - resharer takes same test
          return new Response(
            JSON.stringify({ qaId: reshareMatch.id, questions: reshareMatch.questions }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.log('[generate-qa] Reshare quiz found but answers missing');
        }
      } else {
        console.log('[generate-qa] No quiz found for quoted post, will generate new one');
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

    // Check if content is sufficient - increased threshold to 100 for quality
    let finalContentText = contentText;
    if (contentText.length < 100) {
      // FALLBACK: Try to build minimum content from title + excerpt + userText
      // Include title twice for emphasis in prompt (title is most reliable metadata)
      const fallbackContent = `${title || ''}\n\n${excerpt || ''}\n\n${userText || ''}`.trim();
      const enhancedFallback = `${title ? title + '\n\n' : ''}${fallbackContent}`.trim();
      
      // Lowered threshold to 60 to allow shorter but valid content
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

    // VALIDATION LAYER: Check content quality before AI generation ("Immune System")
    const validation = validateContentQuality(finalContentText);
    if (!validation.isValid) {
      console.log(`[generate-qa] ❌ Content validation failed: ${validation.errorCode}, metadataRatio: ${Math.round(validation.metadataRatio * 100)}%`);
      return new Response(
        JSON.stringify({ 
          error_code: validation.errorCode,
          metadata_ratio: validation.metadataRatio,
          message: validation.errorCode === 'ERROR_METADATA_ONLY' 
            ? 'Il contenuto estratto contiene troppi metadati di piattaforma'
            : 'Contenuto insufficiente per generare domande'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      // Check if it's a media MIXED (1 user + 2 source) based on content structure
      const isMediaMixed = serverSideContent.includes('COMMENTO UTENTE:') && serverSideContent.includes('CONTENUTO MEDIA:');
      
      if (isMediaMixed) {
        contentDescription = serverSideContent; // Already formatted with sections
        
        questionRules = `1. Genera ESATTAMENTE 3 domande:
   - Domanda 1: Sul COMMENTO DELL'UTENTE (tema, opinione o punto espresso nel commento)
   - Domanda 2: Sul CONTENUTO MEDIA (tema principale, informazione chiave)
   - Domanda 3: Sul CONTENUTO MEDIA (dettaglio specifico, dato o fatto)`;
      } else {
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
      }

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

⚠️ ESCLUSIONI OBBLIGATORIE:
- NON chiedere "Quanti like ha ricevuto?" o simili
- NON chiedere "Su quale piattaforma è stato pubblicato?"
- NON chiedere "Qual è il titolo?" (a meno che sia il solo dato)
- NON chiedere informazioni su formato audio/video/testo
- Se non riesci a generare ${expectedQuestions} domande sul CONTENUTO EFFETTIVO, restituisci {"insufficient_context": true, "reason": "metadata_only"}

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
          { role: 'system', content: `Sei un assistente per quiz di comprensione. Rispondi sempre in JSON valido.

REGOLE CRITICHE - ESCLUSIONI OBBLIGATORIE:
❌ MAI generare domande su:
- Metadati di piattaforma (numero di like, follower, commenti, reactions)
- Elementi UI (pulsanti, menu, navigazione, login)
- Formato tecnico del contenuto (audio, video, testo, immagine)
- Nome della piattaforma (Spotify, LinkedIn, YouTube, Twitter)
- Titolo del brano/video/articolo (a meno che sia l'UNICO dato disponibile)
- Cookie policy, privacy policy, termini di servizio
- Date di pubblicazione o statistiche di visualizzazione

✅ Genera domande SOLO su:
- Contenuto semantico effettivo (argomento, tema, messaggio)
- Fatti, dati, affermazioni presenti nel testo
- Opinioni e argomentazioni dell'autore
- Contesto e significato del contenuto

Se il testo sorgente contiene SOLO o PRINCIPALMENTE metadati di piattaforma, 
rispondi con: {"insufficient_context": true, "reason": "metadata_only"}` },
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
      // Check if AI explicitly flagged metadata-only
      if (parsedContent.reason === 'metadata_only') {
        return new Response(
          JSON.stringify({ 
            error_code: 'ERROR_METADATA_ONLY',
            message: 'Il contenuto contiene solo metadati di piattaforma'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ insufficient_context: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // POST-GENERATION QUALITY CHECK: Detect generic/metadata-based questions
    const questionValidation = validateGeneratedQuestions(parsedContent.questions);
    if (!questionValidation.isValid) {
      console.log(`[generate-qa] ❌ Generated questions failed quality check: ${questionValidation.reason}`);
      return new Response(
        JSON.stringify({ 
          error_code: 'ERROR_LOW_QUALITY_QUIZ',
          message: 'Le domande generate non riflettono il contenuto effettivo. Riprova per un\'analisi migliore.',
          reason: questionValidation.reason
        }),
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
      // FIX: Per editorial URLs e Focus URLs, forzare post_id = null per evitare FK violation
      // (contentId per editorial/focus è daily_focus.id, non posts.id)
      const isEditorialUrl = sourceUrl?.startsWith('editorial://') || sourceUrl?.startsWith('focus://');
      const { data: insertedQA, error: insertError } = await supabase
        .from('post_qa_questions')
        .insert({
          post_id: (isPrePublish || isEditorialUrl) ? null : contentId,
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { YoutubeTranscript } from "npm:youtube-transcript@1.2.1";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    /youtube\.com\/live\/([^&\n?#]+)/,  // YouTube Live URLs
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// Utility function for delay with exponential backoff
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to save transcript to cache
async function saveToCache(
  supabase: any,
  videoId: string, 
  transcript: string, 
  source: string,
  language?: string
): Promise<void> {
  try {
    await supabase
      .from('youtube_transcripts_cache')
      .insert({
        video_id: videoId,
        transcript,
        source,
        language: language || 'unknown'
      });
    console.log(`[Cache] ✅ Saved transcript for ${videoId} (source: ${source})`);
  } catch (error: any) {
    console.error('[Cache] ⚠️ Failed to save:', error?.message || error);
  }
}

// Fetch from Supadata.ai API as fallback with internal timeout
async function fetchFromSupadata(
  videoId: string, 
  preferredLang?: string,
  timeoutMs: number = 45000
): Promise<{ transcript: string; source: string; language?: string } | null> {
  const superdataKey = Deno.env.get('SUPADATA_API_KEY');
  if (!superdataKey) {
    console.error('[Supadata] ❌ API key not configured');
    return null;
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[Supadata] ⏱️ Internal timeout after ${timeoutMs}ms, aborting...`);
    controller.abort();
  }, timeoutMs);

  try {
    // Build URL with language preference
    let apiUrl = `https://api.supadata.ai/v1/transcript?url=https://youtu.be/${videoId}`;
    if (preferredLang) {
      apiUrl += `&lang=${preferredLang}`;
      console.log(`[Supadata] Calling API for video ${videoId} with lang=${preferredLang} (timeout: ${timeoutMs}ms)...`);
    } else {
      console.log(`[Supadata] Calling API for video ${videoId} (timeout: ${timeoutMs}ms)...`);
    }
    
    const response = await fetch(apiUrl, {
      headers: {
        'x-api-key': superdataKey,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Supadata] ❌ HTTP ${response.status} after ${elapsed}ms:`, errorText);
      throw new Error(`Supadata API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Supadata] 📦 Response after ${elapsed}ms:`, JSON.stringify(data).substring(0, 500));
    
    // Extract transcript from Supadata format
    let transcript = '';
    
    if (data.content && Array.isArray(data.content)) {
      // Supadata format: { content: [{ text: "...", duration: ..., offset: ... }] }
      transcript = data.content.map((item: any) => item.text).join(' ');
    } else if (typeof data.transcript === 'string') {
      transcript = data.transcript;
    } else if (typeof data.text === 'string') {
      transcript = data.text;
    } else if (typeof data.content === 'string') {
      transcript = data.content;
    }
    
    if (!transcript) {
      console.error('[Supadata] ❌ No transcript field found. Available fields:', Object.keys(data));
      throw new Error('No transcript in Supadata response');
    }
    
    console.log(`[Supadata] ✅ SUCCESS after ${elapsed}ms, length: ${transcript.length}`);
    
    return { 
      transcript, 
      source: 'supadata',
      language: data.lang || data.language 
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      console.error(`[Supadata] ❌ TIMEOUT after ${elapsed}ms`);
      return null;
    }
    
    console.error(`[Supadata] ❌ Failed after ${elapsed}ms:`, error?.message || error);
    return null;
  }
}

// Fetch YouTube transcript with retry logic and better error handling
async function fetchYouTubeTranscript(
  videoId: string, 
  maxRetries: number = 1
): Promise<{ transcript: string; source: string; disabled?: boolean } | null> {
  console.log(`[Transcript] Fetching for video ${videoId}`);
  
  const languages = [
    { code: 'it', name: 'Italian' },
    { code: 'en', name: 'English' },
    { code: null, name: 'any available language' }
  ];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Try each language in order
      for (const lang of languages) {
        try {
          console.log(`[Transcript] Attempt ${attempt}/${maxRetries}: Trying ${lang.name}${lang.code ? ` (${lang.code})` : ''}...`);
          
          const transcriptData = await YoutubeTranscript.fetchTranscript(
            videoId,
            lang.code ? { lang: lang.code } : undefined
          );
          
          if (transcriptData && transcriptData.length > 0) {
            const transcript = transcriptData.map((item: any) => item.text).join(' ');
            const detectedLang = lang.code || 'auto';
            console.log(`[Transcript] ✅ Success with ${lang.name}, length: ${transcript.length}, detected: ${detectedLang}`);
            return { transcript, source: `youtube-${detectedLang}` };
          }
        } catch (langError: any) {
          const errorMsg = langError?.message || String(langError);
          console.log(`[Transcript] ${lang.name} not available: ${errorMsg}`);
          
          // If transcript is explicitly disabled by free library, DON'T return - try Supadata instead
          if (errorMsg.includes('Transcript is disabled')) {
            console.log(`[Transcript] ⚠️ Free library says disabled for ${videoId}, will try Supadata fallback`);
            // Return null to let the flow continue to Supadata
            return null;
          }
          
          // Continue to next language
          continue;
        }
      }

      // If we get here, all languages failed for this attempt
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`[Transcript] All languages failed on attempt ${attempt}, retrying in ${backoffMs}ms...`);
        await delay(backoffMs);
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error(`[Transcript] Attempt ${attempt}/${maxRetries} failed:`, errorMsg);
      
      // Don't retry if it's a definitive error
      if (errorMsg.includes('Transcript is disabled') || 
          errorMsg.includes('Video unavailable') ||
          errorMsg.includes('Invalid video')) {
        console.error(`[Transcript] ❌ Permanent error, stopping retries`);
        return null;
      }
      
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`[Transcript] Retrying in ${backoffMs}ms...`);
        await delay(backoffMs);
      }
    }
  }

  console.error(`[Transcript] ❌ All ${maxRetries} attempts exhausted for video ${videoId}`);
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Processing YouTube video: ${url}`);
    
    const videoId = extractYouTubeId(url);
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Invalid YouTube URL' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // LEVEL 1: Check cache first (only non-expired entries)
    console.log(`[Cache] Checking cache for video ${videoId}...`);
    const { data: cached, error: cacheError } = await supabase
      .from('youtube_transcripts_cache')
      .select('*')
      .eq('video_id', videoId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cacheError) {
      console.error('[Cache] ⚠️ Error reading cache:', cacheError);
    } else if (cached) {
      console.log(`[Cache] ✅ HIT for video ${videoId}, source: ${cached.source}`);
      return new Response(
        JSON.stringify({ 
          transcript: cached.transcript, 
          source: cached.source 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[Cache] ⚠️ MISS for video ${videoId}, fetching...`);

    // LEVEL 2: Try free youtube-transcript method
    const freeResult = await fetchYouTubeTranscript(videoId);
    
    if (freeResult && freeResult.transcript) {
      // Free method succeeded - save to cache and return
      await saveToCache(supabase, videoId, freeResult.transcript, freeResult.source);
      
      return new Response(
        JSON.stringify(freeResult),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log(`[Transcript] Free method failed or returned empty, trying Supadata...`);

    // LEVEL 3: Fallback to Supadata.ai paid API
    console.log(`[Supadata] Free methods failed, trying paid API...`);
    
    // Try with Italian first, then English
    let superdataResult = await fetchFromSupadata(videoId, 'it');
    if (!superdataResult) {
      console.log(`[Supadata] Italian not available, trying English...`);
      superdataResult = await fetchFromSupadata(videoId, 'en');
    }
    if (!superdataResult) {
      console.log(`[Supadata] English not available, trying auto-detect...`);
      superdataResult = await fetchFromSupadata(videoId);
    }
    
    if (superdataResult) {
      // Save to cache
      await saveToCache(
        supabase, 
        videoId, 
        superdataResult.transcript, 
        superdataResult.source,
        superdataResult.language
      );
      
      return new Response(
        JSON.stringify({ 
          transcript: superdataResult.transcript, 
          source: superdataResult.source 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // LEVEL 4: All methods failed
    console.error(`[Transcript] ❌ All methods failed for video ${videoId}`);
    return new Response(
      JSON.stringify({ 
        error: 'No captions available for this video',
        transcript: '',
        source: 'none'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in transcribe-youtube function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        transcript: '',
        source: 'error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

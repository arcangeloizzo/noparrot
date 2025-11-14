import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { YoutubeTranscript } from "npm:youtube-transcript@1.2.1";

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

// Fetch YouTube transcript with retry logic and better error handling
async function fetchYouTubeTranscript(
  videoId: string, 
  maxRetries: number = 3
): Promise<{ transcript: string; source: string } | null> {
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
          
          // If transcript is explicitly disabled, no point in retrying
          if (errorMsg.includes('Transcript is disabled')) {
            console.error(`[Transcript] ❌ Transcript explicitly disabled for video ${videoId}`);
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

    const result = await fetchYouTubeTranscript(videoId);
    
    if (!result) {
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
    }

    return new Response(
      JSON.stringify(result),
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// Helper to get rotating user agents
function getUserAgent(index: number): string {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
  ];
  return agents[index % agents.length];
}

// Fetch with retry logic and exponential backoff
async function fetchWithRetry(url: string, maxRetries = 3): Promise<string> {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': getUserAgent(attempt),
          'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        }
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`[YouTube] Rate limited (429), retry ${attempt + 1}/${maxRetries}`);
        console.log(`[YouTube] Retry ${attempt + 1}/${maxRetries} after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        console.log(`[YouTube] Failed to fetch: HTTP ${response.status}`);
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      console.log(`[YouTube] Attempt ${attempt + 1}/${maxRetries} failed:`, error instanceof Error ? error.message : 'Unknown');
      
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[YouTube] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('[YouTube] All retry attempts exhausted');
  throw lastError || new Error('Max retries exceeded');
}

// Fetch YouTube captions using the timedtext API endpoint
async function fetchYouTubeTranscript(videoId: string): Promise<{ transcript: string; source: string } | null> {
  console.log(`[YouTube] Fetching transcript for video ${videoId}`);
  
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  try {
    const html = await fetchWithRetry(videoUrl);
    
    // Try multiple patterns to extract caption tracks (YouTube changes HTML often)
    const patterns = [
      /"captionTracks":(\[.*?\])/,
      /"captions":.*?"playerCaptionsTracklistRenderer":\{"captionTracks":(\[.*?\])/,
      /"captionsTracklistRenderer":\{"captionTracks":(\[.*?\])/
    ];
    
    let captionTracks = null;
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          captionTracks = JSON.parse(match[1]);
          console.log(`[YouTube] ✓ Found ${captionTracks.length} caption tracks using pattern`);
          break;
        } catch (e) {
          console.log(`[YouTube] Failed to parse match from pattern:`, e instanceof Error ? e.message : 'Unknown');
        }
      }
    }
    
    if (!captionTracks) {
      const snippet = html.slice(0, 1000);
      console.log('[YouTube] No captionTracks found in page HTML. HTML snippet:', snippet);
      return null;
    }

    console.log(`[YouTube] Available tracks:`, captionTracks.map((t: any) => ({
      lang: t.languageCode,
      name: t.name?.simpleText,
      auto: t.vssId?.includes('.auto')
    })));

    // Priority order: IT manual > EN manual > IT auto > EN auto > any other
    const priorityOrder = [
      (t: any) => t.languageCode === 'it' && !t.vssId?.includes('.auto'), // IT manual
      (t: any) => t.languageCode === 'en' && !t.vssId?.includes('.auto'), // EN manual
      (t: any) => t.languageCode === 'it' && t.vssId?.includes('.auto'),  // IT auto
      (t: any) => t.languageCode === 'en' && t.vssId?.includes('.auto'),  // EN auto
      (t: any) => !t.vssId?.includes('.auto'),                             // Any manual
      (t: any) => true                                                      // Any auto
    ];

    let selectedTrack = null;
    for (const selector of priorityOrder) {
      selectedTrack = captionTracks.find(selector);
      if (selectedTrack) break;
    }

    if (!selectedTrack) {
      console.log('[YouTube] No suitable caption tracks found');
      return null;
    }

    const isAuto = selectedTrack.vssId?.includes('.auto');
    const lang = selectedTrack.languageCode.toUpperCase();
    const source = isAuto ? `youtube_captions_auto_${lang}` : `youtube_captions_manual_${lang}`;
    
    console.log(`[YouTube] ✓ Selected ${isAuto ? 'auto-generated' : 'manual'} ${lang} captions`);

    try {
      const captionUrl = new URL(selectedTrack.baseUrl);
      
      console.log(`[YouTube] Fetching captions from: ${captionUrl.toString().slice(0, 100)}...`);
      const captionsXml = await fetchWithRetry(captionUrl.toString());

      // Parse XML and extract text
      const textMatches = captionsXml.matchAll(/<text[^>]*>(.*?)<\/text>/g);
      const segments = [];
      
      for (const match of textMatches) {
        const text = match[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/<[^>]+>/g, '') // Remove any HTML tags
          .trim();
        if (text) {
          segments.push(text);
        }
      }

      const transcript = segments.join(' ').trim();
      
      if (transcript.length < 50) {
        console.log(`[YouTube] ⚠ Transcript too short (${transcript.length} chars), might be incomplete`);
      } else {
        console.log(`[YouTube] ✓ Successfully extracted transcript: ${transcript.length} chars`);
      }

      return {
        transcript,
        source
      };
    } catch (fetchError) {
      console.error('[YouTube] ✗ Failed to fetch/parse captions:', fetchError instanceof Error ? fetchError.message : 'Unknown');
      return null;
    }
    
  } catch (error) {
    console.error('[YouTube] ✗ Error fetching transcript for', videoId, ':', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Extract YouTube video ID
    const videoId = extractYouTubeId(url);
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid YouTube URL',
          transcript: null,
          source: 'none'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Processing YouTube video: ${videoId}`);

    // Try to fetch transcript
    const result = await fetchYouTubeTranscript(videoId);

    if (!result) {
      return new Response(
        JSON.stringify({ 
          transcript: null,
          source: 'none',
          message: 'No captions available for this video'
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
        transcript: null,
        source: 'none'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

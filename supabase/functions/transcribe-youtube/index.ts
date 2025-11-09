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
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    const delay = Math.min(1000 * Math.pow(2, i), 5000);
    if (i > 0) {
      console.log(`[YouTube] Retry ${i}/${maxRetries} after ${delay}ms delay`);
      await new Promise(r => setTimeout(r, delay));
    }
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': getUserAgent(i),
        'Accept-Language': 'it,en;q=0.9'
      }
    });
    
    if (response.status !== 429) {
      return response;
    }
    console.log(`[YouTube] Rate limited (429), retry ${i + 1}/${maxRetries}`);
  }
  throw new Error('Max retries exceeded due to rate limiting');
}

// Fetch YouTube captions using the timedtext API endpoint
async function fetchYouTubeTranscript(videoId: string): Promise<{ transcript: string; source: string } | null> {
  try {
    console.log(`[YouTube] Fetching transcript for video ${videoId}`);
    
    // First, get the video page to find available caption tracks
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const videoResponse = await fetchWithRetry(videoUrl);
    
    if (!videoResponse.ok) {
      console.log(`[YouTube] Failed to fetch video page: ${videoResponse.status}`);
      return null;
    }
    
    const html = await videoResponse.text();
    
    // Extract captionTracks from the page
    const captionTracksMatch = html.match(/"captionTracks":(\[.*?\])/);
    if (!captionTracksMatch) {
      console.log('No captionTracks found in page HTML');
      return null;
    }
    
    let captionTracks;
    try {
      captionTracks = JSON.parse(captionTracksMatch[1]);
      console.log(`[YouTube] Found ${captionTracks.length} caption tracks:`, 
        captionTracks.map((t: any) => ({
          lang: t.languageCode,
          name: t.name?.simpleText,
          auto: t.vssId?.includes('.auto') || t.kind === 'asr'
        }))
      );
    } catch (e) {
      console.log(`[YouTube] Failed to parse captionTracks: ${e instanceof Error ? e.message : 'Unknown error'}`);
      return null;
    }
    
    // Priority: IT manual > EN manual > IT auto > EN auto > any available
    const languagePriority = ['it', 'en'];
    let selectedTrack = null;
    
    // First try to find manual captions in priority order
    for (const lang of languagePriority) {
      selectedTrack = captionTracks.find((t: any) => 
        t.languageCode === lang && !t.vssId?.includes('.auto') && t.kind !== 'asr'
      );
      if (selectedTrack) {
        console.log(`[YouTube] Selected manual ${lang.toUpperCase()} captions`);
        break;
      }
    }
    
    // Then try auto-generated captions in priority order
    if (!selectedTrack) {
      for (const lang of languagePriority) {
        selectedTrack = captionTracks.find((t: any) => 
          t.languageCode === lang || t.vssId?.includes(`.${lang}`)
        );
        if (selectedTrack) {
          console.log(`[YouTube] Selected auto-generated ${lang.toUpperCase()} captions`);
          break;
        }
      }
    }
    
    // Fallback to any available track
    if (!selectedTrack && captionTracks.length > 0) {
      selectedTrack = captionTracks[0];
      console.log(`[YouTube] Fallback to first available track: ${selectedTrack.languageCode}`);
    }
    
    if (!selectedTrack || !selectedTrack.baseUrl) {
      console.log('[YouTube] No valid caption track found');
      return null;
    }
    
    const isAuto = selectedTrack.vssId?.includes('.auto') || selectedTrack.kind === 'asr';
    console.log(`[YouTube] Using ${selectedTrack.languageCode} captions (${isAuto ? 'auto-generated' : 'manual'}): ${selectedTrack.name?.simpleText || 'unnamed'}`);
    
    // Fetch the captions using the baseUrl
    const captionUrl = selectedTrack.baseUrl;
    const captionResponse = await fetchWithRetry(captionUrl);
    
    if (!captionResponse.ok) {
      console.log(`[YouTube] Failed to fetch captions: ${captionResponse.status}`);
      return null;
    }
    
    const captionXml = await captionResponse.text();
    
    // Parse XML to extract text
    const textMatches = Array.from(captionXml.matchAll(/<text[^>]*>(.*?)<\/text>/gs));
    
    if (textMatches.length === 0) {
      console.log('[YouTube] No text segments found in caption XML');
      return null;
    }
    
    const transcriptParts = textMatches.map(match => {
      // Decode HTML entities and clean up
      return match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]+>/g, '') // Remove any inner tags
        .replace(/\n/g, ' ')
        .trim();
    }).filter(text => text.length > 0);
    
    if (transcriptParts.length === 0) {
      console.log('[YouTube] No text content after parsing');
      return null;
    }
    
    const transcript = transcriptParts
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`[YouTube] ✓ Successfully extracted transcript: ${transcript.length} chars from ${transcriptParts.length} segments (${selectedTrack.languageCode}, ${isAuto ? 'auto' : 'manual'})`);
    
    return {
      transcript,
      source: isAuto ? 'youtube_captions_auto' : 'youtube_captions_manual'
    };
    
  } catch (error) {
    console.error(`[YouTube] ✗ Error fetching transcript for ${videoId}:`, error instanceof Error ? error.message : 'Unknown error');
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

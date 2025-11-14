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

// Fetch YouTube transcript using youtube-transcript package
async function fetchYouTubeTranscript(videoId: string): Promise<{ transcript: string; source: string } | null> {
  console.log(`[Transcript] Fetching for video ${videoId}`);
  
  try {
    // Try Italian first
    console.log(`[Transcript] Attempting Italian (it)...`);
    try {
      const transcriptData = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'it',
      });
      
      if (transcriptData && transcriptData.length > 0) {
        const transcript = transcriptData.map((item: any) => item.text).join(' ');
        console.log(`[Transcript] ✅ Success with Italian, length: ${transcript.length}`);
        return { transcript, source: 'youtube-it' };
      }
    } catch (itError) {
      console.log(`[Transcript] Italian not available, trying English...`);
    }

    // Try English
    console.log(`[Transcript] Attempting English (en)...`);
    try {
      const transcriptData = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'en',
      });
      
      if (transcriptData && transcriptData.length > 0) {
        const transcript = transcriptData.map((item: any) => item.text).join(' ');
        console.log(`[Transcript] ✅ Success with English, length: ${transcript.length}`);
        return { transcript, source: 'youtube-en' };
      }
    } catch (enError) {
      console.log(`[Transcript] English not available, trying any language...`);
    }

    // Try any available language
    console.log(`[Transcript] Attempting any available language...`);
    const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (transcriptData && transcriptData.length > 0) {
      const transcript = transcriptData.map((item: any) => item.text).join(' ');
      console.log(`[Transcript] ✅ Success with auto-detected language, length: ${transcript.length}`);
      return { transcript, source: 'youtube-auto' };
    }

    console.log(`[Transcript] ❌ No transcript available for video ${videoId}`);
    return null;
  } catch (error) {
    console.error(`[Transcript] ❌ Error fetching transcript:`, error);
    return null;
  }
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

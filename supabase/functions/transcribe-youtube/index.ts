import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { YoutubeTranscript } from "https://esm.sh/youtube-transcript@1.0.6";

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

// Fetch YouTube captions using youtube-transcript library
async function fetchYouTubeTranscript(videoId: string): Promise<{ transcript: string; source: string } | null> {
  try {
    console.log(`Fetching transcript for video ${videoId}`);
    
    // Try Italian first
    try {
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'it',
      });
      
      if (transcriptItems && transcriptItems.length > 0) {
        const transcript = transcriptItems
          .map((item: any) => item.text)
          .join(' ')
          .replace(/\s+/g, ' ') // Normalize multiple spaces
          .trim();
        
        console.log(`Successfully extracted Italian transcript for video ${videoId} (${transcript.length} chars, ${transcriptItems.length} segments)`);
        
        return {
          transcript,
          source: 'youtube_captions'
        };
      }
    } catch (italianError) {
      console.log(`Italian transcript not available for video ${videoId}, trying English fallback`);
    }
    
    // Fallback to English
    try {
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'en',
      });
      
      if (transcriptItems && transcriptItems.length > 0) {
        const transcript = transcriptItems
          .map((item: any) => item.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        console.log(`Successfully extracted English transcript for video ${videoId} (${transcript.length} chars, ${transcriptItems.length} segments)`);
        
        return {
          transcript,
          source: 'youtube_captions'
        };
      }
    } catch (englishError) {
      console.log(`English transcript not available for video ${videoId}`);
    }
    
    // Try without language specification (auto-detect)
    try {
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      
      if (transcriptItems && transcriptItems.length > 0) {
        const transcript = transcriptItems
          .map((item: any) => item.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        console.log(`Successfully extracted auto-detected transcript for video ${videoId} (${transcript.length} chars, ${transcriptItems.length} segments)`);
        
        return {
          transcript,
          source: 'youtube_captions'
        };
      }
    } catch (autoError) {
      console.log(`Auto-detect transcript failed for video ${videoId}`);
    }
    
    console.log(`No captions available for video ${videoId}`);
    return null;
    
  } catch (error) {
    console.error(`Error fetching YouTube transcript for ${videoId}:`, error);
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
        error: error.message,
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

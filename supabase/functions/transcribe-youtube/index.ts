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

// Fetch YouTube captions using youtube-transcript-api
async function fetchYouTubeTranscript(videoId: string): Promise<{ transcript: string; source: string } | null> {
  try {
    // Use youtube-transcript API (free, no API key needed)
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    
    if (!response.ok) {
      console.log(`Failed to fetch YouTube page for video ${videoId}`);
      return null;
    }

    const html = await response.text();
    
    // Extract captions from YouTube's player response
    const captionsMatch = html.match(/"captions":(\{[^}]+\})/);
    if (!captionsMatch) {
      console.log(`No captions found for video ${videoId}`);
      return null;
    }

    // Try to find caption tracks
    const captionTracksMatch = html.match(/"captionTracks":(\[[^\]]+\])/);
    if (!captionTracksMatch) {
      console.log(`No caption tracks found for video ${videoId}`);
      return null;
    }

    try {
      const captionTracks = JSON.parse(captionTracksMatch[1]);
      
      // Prefer English captions, fallback to first available
      let captionUrl = captionTracks[0]?.baseUrl;
      for (const track of captionTracks) {
        if (track.languageCode?.startsWith('en')) {
          captionUrl = track.baseUrl;
          break;
        }
      }

      if (!captionUrl) {
        console.log(`No caption URL found for video ${videoId}`);
        return null;
      }

      // Fetch the actual captions
      const captionResponse = await fetch(captionUrl);
      if (!captionResponse.ok) {
        console.log(`Failed to fetch captions from ${captionUrl}`);
        return null;
      }

      const captionXml = await captionResponse.text();
      
      // Parse XML and extract text content
      const textMatches = captionXml.matchAll(/<text[^>]*>([^<]+)<\/text>/g);
      const transcriptParts: string[] = [];
      
      for (const match of textMatches) {
        if (match[1]) {
          // Decode HTML entities
          const decoded = match[1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');
          transcriptParts.push(decoded.trim());
        }
      }

      if (transcriptParts.length === 0) {
        console.log(`No transcript text extracted for video ${videoId}`);
        return null;
      }

      const transcript = transcriptParts.join(' ');
      console.log(`Successfully extracted transcript for video ${videoId} (${transcript.length} chars)`);
      
      return {
        transcript,
        source: 'youtube_captions'
      };
    } catch (parseError) {
      console.error(`Error parsing captions for video ${videoId}:`, parseError);
      return null;
    }
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

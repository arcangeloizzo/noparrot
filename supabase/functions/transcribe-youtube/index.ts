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

// Fetch YouTube captions using the timedtext API endpoint
async function fetchYouTubeTranscript(videoId: string): Promise<{ transcript: string; source: string } | null> {
  try {
    console.log(`Fetching transcript for video ${videoId}`);
    
    // First, get the video page to find available caption tracks
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const videoResponse = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (!videoResponse.ok) {
      console.log(`Failed to fetch video page: ${videoResponse.status}`);
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
      console.log(`Found ${captionTracks.length} caption tracks`);
    } catch (e) {
      console.log(`Failed to parse captionTracks: ${e.message}`);
      return null;
    }
    
    // Find English track (prefer auto-generated)
    let selectedTrack = captionTracks.find((track: any) => 
      track.languageCode === 'en' || track.vssId?.includes('.en')
    );
    
    // Fallback to any available track
    if (!selectedTrack && captionTracks.length > 0) {
      selectedTrack = captionTracks[0];
    }
    
    if (!selectedTrack || !selectedTrack.baseUrl) {
      console.log('No valid caption track found');
      return null;
    }
    
    console.log(`Using caption track: ${selectedTrack.languageCode || selectedTrack.vssId} (${selectedTrack.name?.simpleText || 'auto-generated'})`);
    
    // Fetch the captions using the baseUrl
    const captionUrl = selectedTrack.baseUrl;
    const captionResponse = await fetch(captionUrl);
    
    if (!captionResponse.ok) {
      console.log(`Failed to fetch captions: ${captionResponse.status}`);
      return null;
    }
    
    const captionXml = await captionResponse.text();
    
    // Parse XML to extract text
    const textMatches = Array.from(captionXml.matchAll(/<text[^>]*>(.*?)<\/text>/gs));
    
    if (textMatches.length === 0) {
      console.log('No text segments found in caption XML');
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
      console.log('No text content after parsing');
      return null;
    }
    
    const transcript = transcriptParts
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`Successfully extracted transcript: ${transcript.length} chars from ${transcriptParts.length} segments`);
    
    return {
      transcript,
      source: 'youtube_captions'
    };
    
  } catch (error) {
    console.error(`Error fetching YouTube transcript for ${videoId}:`, error.message);
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

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

// Fetch YouTube captions by extracting from innertube API
async function fetchYouTubeTranscript(videoId: string): Promise<{ transcript: string; source: string } | null> {
  try {
    console.log(`Fetching transcript for video ${videoId}`);
    
    // Step 1: Get video page to extract innertube API key
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const videoResponse = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    
    if (!videoResponse.ok) {
      console.log(`Failed to fetch video page: ${videoResponse.status}`);
      return null;
    }
    
    const html = await videoResponse.text();
    
    // Extract innertube API key
    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    if (!apiKeyMatch) {
      console.log('Could not extract API key');
      return null;
    }
    const apiKey = apiKeyMatch[1];
    
    // Extract initial player response to get caption tracks
    const playerResponseMatch = html.match(/var ytInitialPlayerResponse = ({.+?});/);
    if (!playerResponseMatch) {
      console.log('Could not extract player response');
      return null;
    }
    
    const playerResponse = JSON.parse(playerResponseMatch[1]);
    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    
    if (!captionTracks || captionTracks.length === 0) {
      console.log('No caption tracks found in player response');
      return null;
    }
    
    // Find Italian or English caption track (prefer auto-generated)
    let selectedTrack = captionTracks.find((track: any) => 
      track.languageCode === 'it' || track.languageCode === 'it-IT'
    ) || captionTracks.find((track: any) => 
      track.languageCode === 'en' || track.languageCode === 'en-US'
    ) || captionTracks[0];
    
    if (!selectedTrack?.baseUrl) {
      console.log('No valid caption track URL found');
      return null;
    }
    
    console.log(`Found caption track: ${selectedTrack.languageCode} (${selectedTrack.name?.simpleText || 'auto-generated'})`);
    
    // Step 2: Fetch the caption XML
    const captionUrl = selectedTrack.baseUrl;
    const captionResponse = await fetch(captionUrl);
    
    if (!captionResponse.ok) {
      console.log(`Failed to fetch captions: ${captionResponse.status}`);
      return null;
    }
    
    const captionXml = await captionResponse.text();
    
    // Step 3: Parse XML and extract text
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
          .replace(/&nbsp;/g, ' ')
          .replace(/\n/g, ' ')
          .trim();
        
        if (decoded) {
          transcriptParts.push(decoded);
        }
      }
    }
    
    if (transcriptParts.length === 0) {
      console.log('No text found in captions');
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

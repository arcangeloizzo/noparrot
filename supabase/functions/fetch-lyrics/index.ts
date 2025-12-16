import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Search Genius for a song and get lyrics URL
async function searchGenius(query: string, apiKey: string): Promise<{ url: string; title: string; artist: string } | null> {
  console.log(`[Genius] Searching for: "${query}"`);
  
  try {
    const response = await fetch(
      `https://api.genius.com/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );
    
    if (!response.ok) {
      console.error(`[Genius] Search API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const hits = data.response?.hits || [];
    
    if (hits.length === 0) {
      console.log('[Genius] No results found');
      return null;
    }
    
    const firstHit = hits[0].result;
    console.log(`[Genius] Found: "${firstHit.title}" by ${firstHit.primary_artist?.name}`);
    
    return {
      url: firstHit.url,
      title: firstHit.title,
      artist: firstHit.primary_artist?.name || 'Unknown Artist',
    };
  } catch (error) {
    console.error('[Genius] Search error:', error);
    return null;
  }
}

// Extract lyrics from Genius page HTML
function extractLyricsFromHtml(html: string): string {
  console.log(`[Genius] Extracting lyrics from HTML (${html.length} chars)`);
  
  // Find lyrics container - Genius uses data-lyrics-container attribute
  const lyricsContainerRegex = /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi;
  const matches = [...html.matchAll(lyricsContainerRegex)];
  
  if (matches.length === 0) {
    console.log('[Genius] No lyrics container found, trying fallback patterns');
    
    // Fallback: Look for Lyrics__Container class
    const fallbackRegex = /<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    const fallbackMatches = [...html.matchAll(fallbackRegex)];
    
    if (fallbackMatches.length === 0) {
      console.log('[Genius] No lyrics found with fallback pattern either');
      return '';
    }
    
    matches.push(...fallbackMatches);
  }
  
  // Combine all lyrics sections
  let rawLyrics = matches.map(m => m[1]).join('\n');
  
  // Clean up HTML
  let lyrics = rawLyrics
    // Convert <br> to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove <a> tags but keep content
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    // Remove <span> tags but keep content
    .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    // Remove <i> and <b> tags but keep content
    .replace(/<\/?(i|b)>/gi, '')
    // Remove any remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  console.log(`[Genius] Extracted ${lyrics.length} chars of lyrics`);
  return lyrics;
}

// Fetch lyrics from Genius page
async function fetchLyricsFromPage(url: string): Promise<string> {
  console.log(`[Genius] Fetching lyrics page: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    
    if (!response.ok) {
      console.error(`[Genius] Page fetch failed: ${response.status}`);
      return '';
    }
    
    const html = await response.text();
    return extractLyricsFromHtml(html);
  } catch (error) {
    console.error('[Genius] Page fetch error:', error);
    return '';
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artist, title } = await req.json();
    
    if (!artist || !title) {
      return new Response(
        JSON.stringify({ error: 'Missing artist or title parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const GENIUS_API_KEY = Deno.env.get('GENIUS_API_KEY');
    if (!GENIUS_API_KEY) {
      console.error('[Genius] GENIUS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Genius API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[fetch-lyrics] Request: "${title}" by ${artist}`);
    
    // Search for the song
    const searchQuery = `${artist} ${title}`;
    const searchResult = await searchGenius(searchQuery, GENIUS_API_KEY);
    
    if (!searchResult) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Song not found on Genius',
          artist,
          title 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch lyrics from the page
    const lyrics = await fetchLyricsFromPage(searchResult.url);
    
    if (!lyrics || lyrics.length < 50) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not extract lyrics from page',
          geniusUrl: searchResult.url,
          artist: searchResult.artist,
          title: searchResult.title 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[fetch-lyrics] ✅ Success: ${lyrics.length} chars for "${searchResult.title}"`);
    
    return new Response(
      JSON.stringify({
        success: true,
        lyrics,
        source: 'genius',
        geniusUrl: searchResult.url,
        artist: searchResult.artist,
        title: searchResult.title,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[fetch-lyrics] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

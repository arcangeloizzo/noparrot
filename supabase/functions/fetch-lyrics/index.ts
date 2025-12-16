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

// Extract lyrics from Jina markdown response
function extractLyricsFromMarkdown(markdown: string): string {
  console.log(`[Genius] Extracting lyrics from markdown (${markdown.length} chars)`);
  
  const lines = markdown.split('\n');
  
  // Find where lyrics start - look for [Verse], [Chorus], [Intro], etc.
  const lyricsStartIdx = lines.findIndex(l => 
    /^\[?(Verse|Chorus|Intro|Hook|Bridge|Outro|Pre-Chorus|Refrain|Part|Strofa|Ritornello)/i.test(l.trim()) ||
    /^\[.+\]$/.test(l.trim())
  );
  
  let lyricsLines: string[];
  
  if (lyricsStartIdx !== -1) {
    // Take from lyrics start
    lyricsLines = lines.slice(lyricsStartIdx);
  } else {
    // Fallback: look for content after "Lyrics" header
    const lyricsHeaderIdx = lines.findIndex(l => /^#+\s*.*Lyrics/i.test(l));
    if (lyricsHeaderIdx !== -1) {
      lyricsLines = lines.slice(lyricsHeaderIdx + 1);
    } else {
      // Last resort: take all content
      lyricsLines = lines;
    }
  }
  
  // Clean up the lyrics
  let lyrics = lyricsLines
    .join('\n')
    .replace(/^#+\s*.*$/gm, '')           // Remove markdown headers
    .replace(/\[.*?\]\(.*?\)/g, '')        // Remove markdown links
    .replace(/\*\*/g, '')                  // Remove bold
    .replace(/\*/g, '')                    // Remove italic
    .replace(/^>\s*/gm, '')                // Remove blockquotes
    .replace(/\n{3,}/g, '\n\n')            // Normalize multiple newlines
    .trim();
  
  // Remove footer content (credits, etc.)
  const footerPatterns = [
    /\n+\d+\s*Embed$/i,
    /\n+See [^\n]+ Live$/i,
    /\n+Get tickets[^\n]*$/i,
    /\n+You might also like[^\n]*$/i,
  ];
  
  for (const pattern of footerPatterns) {
    lyrics = lyrics.replace(pattern, '');
  }
  
  console.log(`[Genius] Extracted ${lyrics.length} chars of lyrics from markdown`);
  return lyrics.trim();
}

// Fetch lyrics from Genius page using Jina Reader to bypass anti-bot
async function fetchLyricsFromPage(url: string): Promise<string> {
  console.log(`[Genius] Fetching lyrics via Jina Reader: ${url}`);
  
  try {
    // Use Jina AI Reader to bypass anti-bot protections
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/markdown',
        'X-Return-Format': 'markdown',
      },
    });
    
    if (!response.ok) {
      console.error(`[Genius] Jina fetch failed: ${response.status}`);
      // Try direct fetch as fallback
      return await fetchLyricsDirectFallback(url);
    }
    
    const markdown = await response.text();
    console.log(`[Genius] Jina returned ${markdown.length} chars`);
    
    const lyrics = extractLyricsFromMarkdown(markdown);
    
    if (lyrics.length < 50) {
      console.log('[Genius] Jina lyrics too short, trying direct fallback');
      return await fetchLyricsDirectFallback(url);
    }
    
    return lyrics;
  } catch (error) {
    console.error('[Genius] Jina error:', error);
    return await fetchLyricsDirectFallback(url);
  }
}

// Fallback: try direct fetch with enhanced headers
async function fetchLyricsDirectFallback(url: string): Promise<string> {
  console.log(`[Genius] Trying direct fetch fallback: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });
    
    if (!response.ok) {
      console.error(`[Genius] Direct fetch failed: ${response.status}`);
      return '';
    }
    
    const html = await response.text();
    return extractLyricsFromHtml(html);
  } catch (error) {
    console.error('[Genius] Direct fetch error:', error);
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
    
    // MIGLIORAMENTO: Permetti ricerca anche solo con titolo (artist può essere vuoto)
    if (!title) {
      return new Response(
        JSON.stringify({ error: 'Missing title parameter' }),
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
    
    const artistName = artist || '';
    console.log(`[fetch-lyrics] Request: "${title}" by "${artistName || '(unknown artist)'}"`);
    
    // Search for the song - usa solo titolo se artista non disponibile
    const searchQuery = artistName ? `${artistName} ${title}` : title;
    console.log(`[fetch-lyrics] Search query: "${searchQuery}"`);
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

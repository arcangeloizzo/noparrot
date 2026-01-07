import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =====================================================
// Spotify API helpers for trackId lookup
// =====================================================

async function getSpotifyAccessToken(): Promise<string | null> {
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    console.log('[Spotify] Missing client credentials');
    return null;
  }
  
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: 'grant_type=client_credentials'
    });
    
    if (!response.ok) {
      console.error(`[Spotify] Token request failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log('[Spotify] Access token obtained');
    return data.access_token;
  } catch (error) {
    console.error('[Spotify] Token error:', error);
    return null;
  }
}

async function fetchSpotifyTrackMetadata(trackId: string, accessToken: string): Promise<{ artist: string; title: string } | null> {
  try {
    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
      console.error(`[Spotify] Track fetch failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const artist = data.artists?.[0]?.name || '';
    const title = data.name || '';
    
    console.log(`[Spotify] Track metadata: "${title}" by "${artist}"`);
    return { artist, title };
  } catch (error) {
    console.error('[Spotify] Track metadata error:', error);
    return null;
  }
}

// =====================================================
// Genius API helpers
// =====================================================

// Search Genius for a song and get lyrics URL
async function searchGenius(
  query: string,
  apiKey: string,
): Promise<{ url: string; title: string; artist: string } | null> {
  console.log(`[Genius] Searching for: "${query}"`);

  try {
    const response = await fetch(
      `https://api.genius.com/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      },
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
  const rawLyrics = matches.map((m) => m[1]).join('\n');


  // Clean up HTML
  const lyrics = rawLyrics
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
  const lyricsStartIdx = lines.findIndex((l) =>
    /^[\[]?(Verse|Chorus|Intro|Hook|Bridge|Outro|Pre-Chorus|Refrain|Part|Strofa|Ritornello)/i
        .test(l.trim()) ||
    /^\[.+\]$/.test(l.trim())
  );

  let lyricsLines: string[];

  if (lyricsStartIdx !== -1) {
    lyricsLines = lines.slice(lyricsStartIdx);
  } else {
    const lyricsHeaderIdx = lines.findIndex((l) => /^#+\s*.*Lyrics/i.test(l));
    if (lyricsHeaderIdx !== -1) {
      lyricsLines = lines.slice(lyricsHeaderIdx + 1);
    } else {
      lyricsLines = lines;
    }
  }

  let lyrics = lyricsLines
    .join('\n')
    .replace(/^#+\s*.*$/gm, '') // markdown headers
    .replace(/\[.*?\]\((.*?)\)/g, '') // markdown links
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^>\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Remove footer-ish content
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
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/markdown',
        'X-Return-Format': 'markdown',
      },
    });

    if (!response.ok) {
      console.error(`[Genius] Jina fetch failed: ${response.status}`);
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
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
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

// Fallback provider: lyrics.ovh with retry logic and timeout
async function fetchLyricsFromLyricsOvh(artist: string, title: string, retries = 2): Promise<string> {
  const a = (artist || '').trim();
  const t = (title || '').trim();
  if (!a || !t) return '';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout (increased from 5s)
      
      const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(a)}/${encodeURIComponent(t)}`;
      console.log(`[lyrics.ovh] Attempt ${attempt}/${retries}: ${url}`);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'LovableCloud/lyrics-fetcher',
        },
      });
      
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const lyrics = typeof json?.lyrics === 'string' ? json.lyrics.trim() : '';
        if (lyrics.length > 50) {
          console.log(`[lyrics.ovh] ✅ Success on attempt ${attempt}: ${lyrics.length} chars`);
          return lyrics;
        }
        console.log(`[lyrics.ovh] Response too short on attempt ${attempt}: ${lyrics.length} chars`);
      } else {
        console.log(`[lyrics.ovh] Attempt ${attempt} failed with status: ${res.status}`);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      console.log(`[lyrics.ovh] Attempt ${attempt} failed:`, errorMsg);
      if (attempt < retries) {
        console.log(`[lyrics.ovh] Waiting 1s before retry...`);
        await new Promise(r => setTimeout(r, 1000)); // 1s delay between retries
      }
    }
  }
  
  console.log(`[lyrics.ovh] All ${retries} attempts failed`);
  return '';
}

// Fallback provider: Musixmatch via Jina search
async function fetchLyricsFromMusixmatch(artist: string, title: string): Promise<string> {
  const a = (artist || '').trim();
  const t = (title || '').trim();
  if (!t) return ''; // At least title is needed
  
  try {
    const searchQuery = a ? `${a} ${t} lyrics musixmatch` : `${t} lyrics musixmatch`;
    const jinaUrl = `https://s.jina.ai/${encodeURIComponent(searchQuery)}`;
    
    console.log(`[Musixmatch] Searching via Jina: ${searchQuery}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
    
    const res = await fetch(jinaUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.log(`[Musixmatch] Jina search failed: ${res.status}`);
      return '';
    }
    
    const data = await res.json();
    
    // Find the Musixmatch result
    const results = data?.data || [];
    const musixmatchResult = results.find((r: { url?: string }) => 
      r.url?.includes('musixmatch.com')
    );
    
    if (!musixmatchResult?.url) {
      console.log('[Musixmatch] No Musixmatch URL found in search results');
      return '';
    }
    
    console.log(`[Musixmatch] Found URL: ${musixmatchResult.url}`);
    
    // Fetch the Musixmatch page via Jina Reader
    const readerUrl = `https://r.jina.ai/${musixmatchResult.url}`;
    const readerRes = await fetch(readerUrl, {
      headers: {
        'Accept': 'text/markdown',
        'X-Return-Format': 'markdown',
      },
    });
    
    if (!readerRes.ok) {
      console.log(`[Musixmatch] Reader fetch failed: ${readerRes.status}`);
      return '';
    }
    
    const markdown = await readerRes.text();
    console.log(`[Musixmatch] Reader returned ${markdown.length} chars`);
    
    // Extract lyrics from Musixmatch markdown
    const lyrics = extractLyricsFromMusixmatchMarkdown(markdown);
    
    if (lyrics.length > 50) {
      console.log(`[Musixmatch] ✅ Extracted ${lyrics.length} chars of lyrics`);
      return lyrics;
    }
    
    console.log('[Musixmatch] Extracted lyrics too short');
    return '';
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[Musixmatch] Error:', errorMsg);
    return '';
  }
}

// Extract lyrics from Musixmatch markdown
function extractLyricsFromMusixmatchMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  
  // Musixmatch typically has lyrics after "Lyrics" header
  const lyricsHeaderIdx = lines.findIndex((l) => 
    /^#+\s*Lyrics/i.test(l) || /^Lyrics$/i.test(l.trim())
  );
  
  let lyricsLines: string[];
  
  if (lyricsHeaderIdx !== -1) {
    lyricsLines = lines.slice(lyricsHeaderIdx + 1);
  } else {
    // Try to find verse/chorus markers
    const markerIdx = lines.findIndex((l) =>
      /^[\[]?(Verse|Chorus|Intro|Hook|Bridge|Outro)/i.test(l.trim()) ||
      /^\[.+\]$/.test(l.trim())
    );
    
    if (markerIdx !== -1) {
      lyricsLines = lines.slice(markerIdx);
    } else {
      lyricsLines = lines;
    }
  }
  
  // Find where lyrics end (typically before "Writer(s)" or similar)
  const endPatterns = [
    /^Writer\(s\)/i,
    /^Lyrics licensed/i,
    /^Copyright/i,
    /^Submit Corrections/i,
    /^Related Songs/i,
    /^\*\*\*/,
  ];
  
  const endIdx = lyricsLines.findIndex((l) => 
    endPatterns.some(p => p.test(l.trim()))
  );
  
  if (endIdx !== -1) {
    lyricsLines = lyricsLines.slice(0, endIdx);
  }
  
  const lyrics = lyricsLines
    .join('\n')
    .replace(/^#+\s*.*$/gm, '') // Remove headers
    .replace(/\[.*?\]\((.*?)\)/g, '') // Remove markdown links
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return lyrics;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    let { artist, title } = body;
    const { trackId } = body;

    // If trackId is provided without artist/title, fetch from Spotify API
    if (trackId && (!artist || !title)) {
      console.log(`[fetch-lyrics] trackId provided: ${trackId}, fetching metadata from Spotify`);
      
      const accessToken = await getSpotifyAccessToken();
      if (accessToken) {
        const metadata = await fetchSpotifyTrackMetadata(trackId, accessToken);
        if (metadata) {
          artist = metadata.artist;
          title = metadata.title;
          console.log(`[fetch-lyrics] Spotify metadata resolved: "${title}" by "${artist}"`);
        } else {
          console.error('[fetch-lyrics] Failed to fetch Spotify track metadata');
        }
      } else {
        console.error('[fetch-lyrics] Failed to get Spotify access token');
      }
    }

    // Permetti ricerca anche solo con titolo
    if (!title) {
      return new Response(
        JSON.stringify({ error: 'Missing title parameter (and trackId lookup failed)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const GENIUS_API_KEY = Deno.env.get('GENIUS_API_KEY');
    if (!GENIUS_API_KEY) {
      console.error('[Genius] GENIUS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Genius API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
          title,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fetch lyrics from Genius page
    let lyrics = await fetchLyricsFromPage(searchResult.url);
    let lyricsSource = 'genius';

    // Fallback chain if Genius scraping fails
    if (!lyrics || lyrics.length < 50) {
      console.log('[fetch-lyrics] Genius extraction failed/too short, trying lyrics.ovh fallback');
      
      // Try lyrics.ovh with retry
      const ovhLyrics = await fetchLyricsFromLyricsOvh(searchResult.artist, searchResult.title);
      if (ovhLyrics && ovhLyrics.length >= 50) {
        lyrics = ovhLyrics;
        lyricsSource = 'lyrics.ovh';
        console.log(`[fetch-lyrics] ✅ lyrics.ovh success: ${lyrics.length} chars`);
      }
    }
    
    // Try Musixmatch if lyrics.ovh also failed
    if (!lyrics || lyrics.length < 50) {
      console.log('[fetch-lyrics] lyrics.ovh failed, trying Musixmatch fallback');
      
      const mxmLyrics = await fetchLyricsFromMusixmatch(searchResult.artist, searchResult.title);
      if (mxmLyrics && mxmLyrics.length >= 50) {
        lyrics = mxmLyrics;
        lyricsSource = 'musixmatch';
        console.log(`[fetch-lyrics] ✅ Musixmatch success: ${lyrics.length} chars`);
      }
    }

    if (!lyrics || lyrics.length < 50) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not extract lyrics from any source',
          geniusUrl: searchResult.url,
          artist: searchResult.artist,
          title: searchResult.title,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[fetch-lyrics] ✅ Final success (${lyricsSource}): ${lyrics.length} chars for "${searchResult.title}"`);

    return new Response(
      JSON.stringify({
        success: true,
        lyrics,
        source: lyricsSource,
        geniusUrl: searchResult.url,
        artist: searchResult.artist,
        title: searchResult.title,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[fetch-lyrics] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

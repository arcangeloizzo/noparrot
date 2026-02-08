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
// LYRICS CLEANING HELPER
// =====================================================

function cleanLyrics(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '') // HTML tags
    .replace(/\n{3,}/g, '\n\n') // Normalize newlines
    .trim();
}

// =====================================================
// RACING PROVIDERS - All run in parallel
// =====================================================

// 1. Lyrics.ovh - FASTEST API (10s timeout)
async function fetchLyricsOvh(artist: string, title: string): Promise<string | null> {
  const a = (artist || '').trim();
  const t = (title || '').trim();
  if (!t) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(a)}/${encodeURIComponent(t)}`;
    console.log(`[Race] Starting Lyrics.ovh for "${t}" (timeout=10000ms)`);
    
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LovableCloud/lyrics-fetcher',
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.lyrics && data.lyrics.length > 50) {
        console.log(`[Race] 🏆 Lyrics.ovh WINNER: ${data.lyrics.length} chars`);
        return cleanLyrics(data.lyrics);
      }
    }
    console.log(`[Race] Lyrics.ovh: no valid result`);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    console.log(`[Race] Lyrics.ovh failed: ${errorMsg}`);
  } finally {
    clearTimeout(timeout);
  }
  return null;
}

// 2. Genius (via Jina Reader, 15s timeout)
async function fetchGenius(artist: string, title: string, apiKey: string): Promise<string | null> {
  const a = (artist || '').trim();
  const t = (title || '').trim();
  if (!t) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
  
  try {
    const JINA_API_KEY = Deno.env.get('JINA_API_KEY');
    console.log(`[Race] Starting Genius for "${t}" (timeout=15000ms, Jina key: ${JINA_API_KEY ? 'YES' : 'NO'})`);
    
    // Search Genius
    const searchQuery = a ? `${a} ${t}` : t;
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(searchQuery)}`;
    const searchRes = await fetch(searchUrl, { 
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal 
    });
    
    if (!searchRes.ok) {
      console.log(`[Race] Genius search failed: ${searchRes.status}`);
      return null;
    }
    
    const searchData = await searchRes.json();
    const hit = searchData.response?.hits?.[0]?.result;
    if (!hit?.url) {
      console.log('[Race] Genius: no search results');
      return null;
    }
    
    // Fetch lyrics page via Jina Reader (with API key)
    const jinaUrl = `https://r.jina.ai/${hit.url}`;
    const jinaHeaders: Record<string, string> = { 
      'Accept': 'text/markdown',
      'X-Return-Format': 'markdown'
    };
    if (JINA_API_KEY) {
      jinaHeaders['Authorization'] = `Bearer ${JINA_API_KEY}`;
    }
    console.log(`[Race] Genius: fetching ${hit.url} via Jina Reader`);
    const jinaRes = await fetch(jinaUrl, {
      signal: controller.signal,
      headers: jinaHeaders
    });
    
    if (jinaRes.ok) {
      const markdown = await jinaRes.text();
      const lyrics = extractLyricsFromMarkdown(markdown);
      
      if (lyrics.length > 100) {
        console.log(`[Race] 🏆 Genius WINNER: ${lyrics.length} chars`);
        return lyrics;
      }
    }
    console.log(`[Race] Genius: extraction failed or too short`);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    console.log(`[Race] Genius failed: ${errorMsg}`);
  } finally {
    clearTimeout(timeout);
  }
  return null;
}

// 3. Musixmatch (via Jina search, 15s timeout)
async function fetchMusixmatch(artist: string, title: string): Promise<string | null> {
  const a = (artist || '').trim();
  const t = (title || '').trim();
  if (!t) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
  
  try {
    const JINA_API_KEY = Deno.env.get('JINA_API_KEY');
    console.log(`[Race] Starting Musixmatch for "${t}" (timeout=15000ms, Jina key: ${JINA_API_KEY ? 'YES' : 'NO'})`);
    
    const searchQuery = a ? `${a} ${t} lyrics musixmatch` : `${t} lyrics musixmatch`;
    const jinaUrl = `https://s.jina.ai/${encodeURIComponent(searchQuery)}`;
    
    const jinaSearchHeaders: Record<string, string> = { 'Accept': 'application/json' };
    if (JINA_API_KEY) {
      jinaSearchHeaders['Authorization'] = `Bearer ${JINA_API_KEY}`;
    }
    const searchRes = await fetch(jinaUrl, {
      signal: controller.signal,
      headers: jinaSearchHeaders
    });
    
    if (!searchRes.ok) {
      console.log(`[Race] Musixmatch search failed: ${searchRes.status}`);
      return null;
    }
    
    const data = await searchRes.json();
    const results = data?.data || [];
    const mxmResult = results.find((r: { url?: string }) => 
      r.url?.includes('musixmatch.com')
    );
    
    if (!mxmResult?.url) {
      console.log('[Race] Musixmatch: no URL found');
      return null;
    }
    
    // Fetch the Musixmatch page (with API key)
    const readerHeaders: Record<string, string> = { 
      'Accept': 'text/markdown',
      'X-Return-Format': 'markdown'
    };
    if (JINA_API_KEY) {
      readerHeaders['Authorization'] = `Bearer ${JINA_API_KEY}`;
    }
    const readerRes = await fetch(`https://r.jina.ai/${mxmResult.url}`, {
      signal: controller.signal,
      headers: readerHeaders
    });
    
    if (readerRes.ok) {
      const markdown = await readerRes.text();
      const lyrics = extractLyricsFromMusixmatchMarkdown(markdown);
      
      if (lyrics.length > 100) {
        console.log(`[Race] 🏆 Musixmatch WINNER: ${lyrics.length} chars`);
        return lyrics;
      }
    }
    console.log(`[Race] Musixmatch: extraction failed or too short`);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    console.log(`[Race] Musixmatch failed: ${errorMsg}`);
  } finally {
    clearTimeout(timeout);
  }
  return null;
}

// =====================================================
// LYRICS EXTRACTION HELPERS
// =====================================================

function extractLyricsFromMarkdown(markdown: string): string {
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

  // Hard cut at common non-lyrics sections that often appear *after* the lyrics block
  const hardStopMarkers = [
    'You might also like',
    '\nEmbed',
    '\nAbout\n',
    '\nCredits\n',
    'Genius is the ultimate source',
    'Genius is the world’s biggest collection',
    'How to Format Lyrics',
    '\nQ&A\n',
  ];
  const lower = lyrics.toLowerCase();
  let cutAt = -1;
  for (const marker of hardStopMarkers) {
    const idx = lower.indexOf(marker.toLowerCase());
    if (idx !== -1) {
      cutAt = cutAt === -1 ? idx : Math.min(cutAt, idx);
    }
  }
  if (cutAt !== -1) {
    lyrics = lyrics.slice(0, cutAt).trim();
  }

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

  return lyrics.trim();
}

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

  // Hard cut at common non-lyrics sections
  const hardStopMarkers = [
    '\nWriter',
    'Lyrics licensed',
    'Copyright',
    'Submit Corrections',
    'Related Songs',
  ];
  const lower = lyrics.toLowerCase();
  let cutAt = -1;
  for (const marker of hardStopMarkers) {
    const idx = lower.indexOf(marker.toLowerCase());
    if (idx !== -1) {
      cutAt = cutAt === -1 ? idx : Math.min(cutAt, idx);
    }
  }

  return (cutAt !== -1 ? lyrics.slice(0, cutAt) : lyrics).trim();
}

// =====================================================
// MAIN HANDLER - RACING PATTERN
// =====================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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
    const artistName = artist || '';
    console.log(`[fetch-lyrics] 🏁 Starting RACE for: "${title}" by "${artistName || '(unknown artist)'}"`);

    // =========================================================================
    // RACING PATTERN: All providers start simultaneously
    // Promise.any returns the FIRST successful result
    // =========================================================================
    const promises: Promise<string | null>[] = [
      fetchLyricsOvh(artistName, title),
      GENIUS_API_KEY ? fetchGenius(artistName, title, GENIUS_API_KEY) : Promise.resolve(null),
      fetchMusixmatch(artistName, title)
    ];

    try {
      // Promise.any: first success wins!
      const lyrics = await Promise.any(
        promises.map(p => p.then(res => {
          if (!res || res.length < 50) throw new Error('Empty or too short');
          return res;
        }))
      );

      const elapsed = Date.now() - startTime;
      console.log(`[fetch-lyrics] ✅ Race completed in ${elapsed}ms with ${lyrics.length} chars`);

      return new Response(
        JSON.stringify({
          success: true,
          lyrics,
          source: 'racing',
          artist: artistName,
          title,
          elapsedMs: elapsed
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (aggregateError) {
      // All providers failed
      const elapsed = Date.now() - startTime;
      console.error(`[fetch-lyrics] ❌ All providers failed after ${elapsed}ms`);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Lyrics not found in any provider',
          artist: artistName,
          title,
          elapsedMs: elapsed
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[fetch-lyrics] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

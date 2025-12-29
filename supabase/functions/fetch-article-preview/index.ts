import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract plain text from HTML - Enhanced version
function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8220;/g, '"')  // left double quote
    .replace(/&#8221;/g, '"')  // right double quote
    .replace(/&#8222;/g, '"')  // double low-9 quote
    .replace(/&#8217;/g, "'")  // right single quote
    .replace(/&#8216;/g, "'")  // left single quote
    .replace(/&#8211;/g, '–')  // en dash
    .replace(/&#8212;/g, '—')  // em dash
    .replace(/&#8230;/g, '…')  // ellipsis
    .replace(/&#8203;/g, '')   // zero-width space
    .replace(/&hellip;/g, '…')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters
  
  // Decode all remaining numeric HTML entities
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  // Decode hex HTML entities
  text = text.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n') // Remove excessive newlines
    .trim();
}

// Aggressive HTML cleaning for reader (removes ALL HTML, converts lists)
function cleanReaderText(html: string): string {
  let text = html
    // Remove scripts, styles, comments completely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // Convert list items to bullet points
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    // Convert headings to uppercase with newlines
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n$1\n')
    // Convert paragraphs to double newlines
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    // Convert breaks to newlines
    .replace(/<br[^>]*>/gi, '\n')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode ALL HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8222;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8230;/g, '…')
    .replace(/&#8203;/g, '')
    .replace(/&hellip;/g, '…')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width chars
  
  // Decode numeric entities
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  text = text.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Clean up whitespace while preserving paragraph structure
  return text
    .replace(/[ \t]+/g, ' ') // Multiple spaces to single space
    .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
    .replace(/^\s+|\s+$/gm, '') // Trim each line
    .trim();
}

// Extract YouTube video ID
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
    /youtube\.com\/live\/([^&\n?#]+)/,  // YouTube Live URLs
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// Detect social media platforms
function detectSocialPlatform(url: string): string | null {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
  if (urlLower.includes('linkedin.com')) return 'linkedin';
  if (urlLower.includes('threads.net')) return 'threads';
  
  // TikTok
  if (urlLower.includes('tiktok.com') || urlLower.includes('vm.tiktok.com')) {
    console.log('[Preview] ✅ Detected TikTok URL:', url);
    return 'tiktok';
  }
  
  return null;
}

// Detect Spotify content type and ID
function extractSpotifyInfo(url: string): { type: 'track' | 'episode' | 'album' | 'playlist' | 'artist'; id: string } | null {
  const urlLower = url.toLowerCase();
  if (!urlLower.includes('spotify.com') && !urlLower.includes('open.spotify.com')) {
    return null;
  }
  
  // Pattern: open.spotify.com/{type}/{id}
  const patterns = [
    { regex: /spotify\.com\/track\/([a-zA-Z0-9]+)/, type: 'track' as const },
    { regex: /spotify\.com\/episode\/([a-zA-Z0-9]+)/, type: 'episode' as const },
    { regex: /spotify\.com\/album\/([a-zA-Z0-9]+)/, type: 'album' as const },
    { regex: /spotify\.com\/playlist\/([a-zA-Z0-9]+)/, type: 'playlist' as const },
    { regex: /spotify\.com\/artist\/([a-zA-Z0-9]+)/, type: 'artist' as const },
  ];
  
  for (const { regex, type } of patterns) {
    const match = url.match(regex);
    if (match && match[1]) {
      console.log(`[Spotify] Detected ${type}: ${match[1]}`);
      return { type, id: match[1] };
    }
  }
  
  return null;
}

// Get Spotify access token using Client Credentials Flow
async function getSpotifyAccessToken(): Promise<string | null> {
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    console.log('[Spotify] ⚠️ Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
    return null;
  }
  
  try {
    console.log('[Spotify] 🔐 Requesting access token via Client Credentials...');
    
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
      },
      body: 'grant_type=client_credentials'
    });
    
    if (!response.ok) {
      console.error('[Spotify] ❌ Token request failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    console.log('[Spotify] ✅ Access token obtained');
    return data.access_token;
  } catch (error) {
    console.error('[Spotify] ❌ Error getting access token:', error);
    return null;
  }
}

// Fetch track metadata from Spotify Web API
async function fetchSpotifyTrackMetadata(trackId: string, accessToken: string): Promise<{ artist: string; title: string } | null> {
  try {
    console.log(`[Spotify] 🎵 Fetching track metadata for: ${trackId}`);
    
    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      console.error('[Spotify] ❌ Track API request failed:', response.status);
      return null;
    }
    
    const track = await response.json();
    
    const artist = track.artists?.[0]?.name || '';
    const title = track.name || '';
    
    console.log(`[Spotify] ✅ Track metadata: "${title}" by "${artist}"`);
    
    return { artist, title };
  } catch (error) {
    console.error('[Spotify] ❌ Error fetching track metadata:', error);
    return null;
  }
}

// Fetch lyrics from our fetch-lyrics edge function
async function fetchLyricsFromGenius(artist: string, title: string): Promise<{ lyrics: string; source: string; geniusUrl: string } | null> {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Spotify] Missing SUPABASE env vars for lyrics fetch');
      return null;
    }
    
    console.log(`[Spotify] Fetching lyrics for: "${title}" by ${artist}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/fetch-lyrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ artist, title }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`[Spotify] Lyrics fetch failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.lyrics) {
      console.log(`[Spotify] ✅ Lyrics fetched: ${data.lyrics.length} chars`);
      return {
        lyrics: data.lyrics,
        source: data.source || 'genius',
        geniusUrl: data.geniusUrl || '',
      };
    }
    
    console.log('[Spotify] No lyrics found:', data.error);
    return null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[Spotify] Lyrics fetch timeout');
    } else {
      console.error('[Spotify] Lyrics fetch error:', error);
    }
    return null;
  }
}


// Fetch Open Graph metadata as fallback
async function fetchOpenGraphData(url: string): Promise<any> {
  console.log('[OpenGraph] Fetching metadata for:', url);
  
  try {
    const response = await fetch(url, {
      headers: {
        // User-agent realistico per evitare blocchi Facebook
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      redirect: 'follow' // Segui i redirect di Facebook
    });
    
    if (!response.ok) {
      console.log('[OpenGraph] Fetch failed:', response.status, response.statusText);
      return null;
    }
    
    const html = await response.text();
    const ogData: Record<string, string> = {};
    
    // Parse Open Graph tags
    const ogRegex = /<meta\s+property="og:([^"]+)"\s+content="([^"]+)"/gi;
    let match;
    while ((match = ogRegex.exec(html)) !== null) {
      ogData[match[1]] = match[2]
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
    }
    
    // Parse anche Twitter Card tags come fallback
    const twitterRegex = /<meta\s+name="twitter:([^"]+)"\s+content="([^"]+)"/gi;
    while ((match = twitterRegex.exec(html)) !== null) {
      if (!ogData[match[1]]) {
        ogData[match[1]] = match[2]
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      }
    }
    
    console.log('[OpenGraph] Extracted:', {
      title: ogData.title,
      description: ogData.description?.slice(0, 100),
      image: ogData.image,
      site_name: ogData.site_name
    });
    
    return {
      title: ogData.title || ogData['twitter:title'] || null,
      description: ogData.description || ogData['twitter:description'] || '',
      image: ogData.image || ogData['twitter:image'] || '',
      author: ogData.site_name || null,
      url: ogData.url || url,
      platform: null  // Let the caller decide the platform
    };
  } catch (error) {
    console.error('[OpenGraph] Error:', error instanceof Error ? error.message : 'Unknown');
    return null;
  }
}

// Fetch social content using Jina AI Reader (FREE) - Enhanced for all platforms
async function fetchSocialWithJina(url: string, platform: string) {
  try {
    console.log(`[Jina] Fetching ${platform} content via Jina AI Reader`);
    
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Return-Format': 'json'
      }
    });
    
    if (!response.ok) {
      console.error(`[Jina] Failed for ${platform}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`[Jina] ${platform} response:`, {
      title: data.title,
      contentLength: data.content?.length || 0,
      hasImage: !!data.image,
      hasAuthor: !!data.author,
      platform
    });
    
    // Extract author - platform-specific logic
    let author = data.author_name || data.author || '';
    let authorUsername = '';
    
    if (platform === 'linkedin' && data.content) {
      const authorMatch = data.content.match(/(?:Posted by|By)\s+([^\n]+)/i);
      if (authorMatch) author = authorMatch[1].trim();
    } else if (platform === 'twitter' && data.content) {
      // Extract username from Twitter/X content
      const usernameMatch = data.content.match(/@(\w+)/);
      if (usernameMatch) authorUsername = usernameMatch[1];
    }

    // Clean content with new function
    const cleanedContent = cleanReaderText(data.content || '');
    
    return {
      title: data.title || `Post da ${platform}`,
      content: cleanedContent,
      summary: data.description || (cleanedContent ? cleanedContent.substring(0, 300) + '...' : ''),
      image: data.image || '',
      previewImg: data.image || '',
      platform,
      type: 'social',
      author,
      author_username: authorUsername || (platform === 'twitter' ? author.replace('@', '') : ''),
      hostname: new URL(url).hostname,
      contentQuality: cleanedContent.length > 200 ? 'complete' : 'partial'
    };
  } catch (error) {
    console.error(`[Jina] Error for ${platform}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let url = '';
  
  try {
    const body = await req.json();
    url = body.url;

    // Parse URL info for later use
    const urlLower = url.toLowerCase();
    const hostname = new URL(url).hostname.toLowerCase();

    // Unsupported platforms (removed from app)
    if (
      hostname.includes('instagram.com') ||
      hostname.includes('facebook.com') ||
      hostname.includes('m.facebook.com') ||
      hostname.includes('fb.com') ||
      hostname.includes('fb.watch')
    ) {
      console.log('[Preview] ⛔ Unsupported platform URL:', { url, hostname });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'UNSUPPORTED_PLATFORM',
          message: 'Questa piattaforma non è supportata in app.',
          hostname,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Jina AI Reader will be tried first, with platform-specific fallbacks

    // Check if it's a YouTube link
    const youtubeId = extractYouTubeId(url);
    if (youtubeId) {
      console.log('[fetch-article-preview] Detected YouTube video:', youtubeId);
      
      try {
        // STEP 1: Fetch YouTube metadata using oEmbed (fast, ~200ms)
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const oembedResponse = await fetch(oembedUrl);
        
        if (!oembedResponse.ok) {
          throw new Error('Failed to fetch YouTube oEmbed data');
        }
        
        const oembedData = await oembedResponse.json();
        console.log('[YouTube] ✅ oEmbed fetched:', oembedData.title);
        
        // STEP 2: Check transcript CACHE ONLY (fast path, no blocking)
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        let transcript = null;
        let transcriptSource = 'none';
        let transcriptAvailable = false;
        let transcriptStatus: 'cached' | 'pending' | 'unavailable' = 'pending';
        
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          try {
            // Fast cache-only check (no transcript fetching here)
            console.log(`[YouTube] 🔍 Checking transcript cache for ${youtubeId}...`);
            
            const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.75.0');
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
            
            const { data: cached, error: cacheError } = await supabase
              .from('youtube_transcripts_cache')
              .select('transcript, source')
              .eq('video_id', youtubeId)
              .maybeSingle();
            
            if (cacheError) {
              console.warn('[YouTube] ⚠️ Cache check error:', cacheError.message);
            } else if (cached && cached.transcript) {
              transcript = cached.transcript;
              transcriptSource = cached.source || 'cache';
              transcriptAvailable = true;
              transcriptStatus = 'cached';
              console.log(`[YouTube] ✅ CACHE HIT: ${transcript.length} chars (source: ${transcriptSource})`);
            } else {
              console.log(`[YouTube] ⏳ CACHE MISS: transcript will be fetched async by client`);
              transcriptStatus = 'pending';
            }
          } catch (cacheCheckError: any) {
            console.warn('[YouTube] ⚠️ Cache check exception:', cacheCheckError.message);
            transcriptStatus = 'pending';
          }
        } else {
          console.warn('[YouTube] ⚠️ Missing SUPABASE env vars');
          transcriptStatus = 'pending';
        }
        
        // STEP 3: Return preview IMMEDIATELY (never block on transcript)
        return new Response(JSON.stringify({
          success: true,
          title: oembedData.title,
          content: transcript || `Video: ${oembedData.title}`,
          summary: (transcript && typeof transcript === 'string' && transcript.length > 0) 
            ? transcript.substring(0, 500) + '...' 
            : oembedData.title,
          image: oembedData.thumbnail_url,
          platform: 'youtube',
          type: 'video',
          embedHtml: oembedData.html,
          youtubeId,
          transcript,
          transcriptSource,
          transcriptAvailable,
          transcriptStatus,
          author: oembedData.author_name,
          authorUrl: oembedData.author_url,
          contentQuality: transcriptAvailable ? 'complete' : 'partial'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('[fetch-article-preview] Error fetching YouTube data:', error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check if it's a Spotify link
    const spotifyInfo = extractSpotifyInfo(url);
    if (spotifyInfo) {
      console.log(`[fetch-article-preview] Detected Spotify ${spotifyInfo.type}: ${spotifyInfo.id}`);
      
      try {
        // Fetch Spotify oEmbed data (free, no API key needed)
        const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
        const oembedResponse = await fetch(oembedUrl);
        
        if (!oembedResponse.ok) {
          throw new Error(`Spotify oEmbed failed: ${oembedResponse.status}`);
        }
        
        const oembedData = await oembedResponse.json();
        
        // Enhanced logging per debug
        console.log('[Spotify] ✅ oEmbed FULL response:', {
          title: oembedData.title,
          provider: oembedData.provider_name,
          author_name: oembedData.author_name, // Questo campo potrebbe contenere l'artista!
          type: oembedData.type,
          hasImage: !!oembedData.thumbnail_url,
          htmlSnippet: oembedData.html?.substring(0, 300),
        });
        
        // Parse artist and track title - PRIORITÀ 1: Spotify Web API
        let artist = '';
        let trackTitle = oembedData.title || '';
        
        // METODO PRIMARIO: Spotify Web API (più affidabile)
        if (spotifyInfo.type === 'track') {
          const accessToken = await getSpotifyAccessToken();
          
          if (accessToken) {
            const trackMetadata = await fetchSpotifyTrackMetadata(spotifyInfo.id, accessToken);
            
            if (trackMetadata) {
              artist = trackMetadata.artist;
              trackTitle = trackMetadata.title;
              console.log(`[Spotify] ✅ WEB API: "${trackTitle}" by "${artist}"`);
            }
          }
        }
        
        // FALLBACK 1: Controlla se author_name contiene l'artista (Spotify oEmbed)
        if (!artist && oembedData.author_name && oembedData.author_name !== 'Spotify') {
          artist = oembedData.author_name.trim();
          trackTitle = oembedData.title || '';
          console.log(`[Spotify] Fallback 1 (author_name): "${trackTitle}" by "${artist}"`);
        }
        
        // FALLBACK 2: Parse dal titolo se formato "Title - Artist"
        if (!artist) {
          const titleMatch = oembedData.title?.match(/^(.+?)\s*[-–—]\s*(.+)$/);
          if (titleMatch) {
            trackTitle = titleMatch[1].trim();
            artist = titleMatch[2].trim();
            console.log(`[Spotify] Fallback 2 (title parse): "${trackTitle}" by "${artist}"`);
          }
        }
        
        console.log(`[Spotify] Final resolved: "${trackTitle}" by "${artist || '(unknown)'}" `);
        
        let transcript = null;
        let transcriptSource = 'none';
        let transcriptAvailable = false;
        let transcriptError = null;
        let geniusUrl = '';
        
        // For tracks, try to fetch lyrics from Genius
        if (spotifyInfo.type === 'track' && trackTitle) {
          let lyricsResult = null;
          
          if (artist) {
            console.log(`[Spotify] 🔍 Searching lyrics with: "${artist}" + "${trackTitle}"`);
            lyricsResult = await fetchLyricsFromGenius(artist, trackTitle);
          }
          
          // FALLBACK: Se non troviamo con artista, prova solo col titolo
          if (!lyricsResult && trackTitle) {
            console.log(`[Spotify] 🔍 Fallback: searching lyrics with title only: "${trackTitle}"`);
            lyricsResult = await fetchLyricsFromGenius('', trackTitle);
          }
          
          if (lyricsResult) {
            transcript = lyricsResult.lyrics;
            transcriptSource = lyricsResult.source;
            transcriptAvailable = true;
            geniusUrl = lyricsResult.geniusUrl;
            console.log(`[Spotify] ✅ Lyrics found (${transcriptSource}): ${transcript?.length || 0} chars`);
          } else {
            transcriptError = 'Lyrics not found on Genius';
            console.log('[Spotify] ⚠️ No lyrics found after all attempts');
          }
        } else if (spotifyInfo.type === 'episode') {
          // For podcast episodes, try Jina AI Reader for description
          const jinaResult = await fetchSocialWithJina(url, 'spotify');
          if (jinaResult && jinaResult.content) {
            transcript = jinaResult.content;
            transcriptSource = 'jina';
            transcriptAvailable = jinaResult.content.length > 100;
          }
        }
        
        return new Response(JSON.stringify({
          success: true,
          title: oembedData.title || `Spotify ${spotifyInfo.type}`,
          content: transcript || `${spotifyInfo.type === 'track' ? 'Brano' : spotifyInfo.type === 'episode' ? 'Episodio' : 'Contenuto'}: ${oembedData.title}`,
          summary: transcript ? transcript.substring(0, 500) + '...' : oembedData.title,
          image: oembedData.thumbnail_url || '',
          previewImg: oembedData.thumbnail_url || '',
          platform: 'spotify',
          type: spotifyInfo.type,
          author: artist || oembedData.provider_name || 'Spotify',
          embedHtml: oembedData.html,
          transcript,
          transcriptSource,
          transcriptAvailable,
          transcriptError,
          geniusUrl,
          contentQuality: transcriptAvailable ? 'complete' : 'partial',
          hostname: 'open.spotify.com',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('[Spotify] Error:', error);
        
        // Fallback response for Spotify
        return new Response(JSON.stringify({
          success: true,
          title: `Contenuto Spotify`,
          content: 'Contenuto Spotify - apri il link originale per ascoltare.',
          summary: 'Contenuto Spotify',
          platform: 'spotify',
          type: spotifyInfo.type,
          hostname: 'open.spotify.com',
          contentQuality: 'minimal',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check if it's a social media link (Twitter/X, LinkedIn, Instagram, Threads, Facebook)
    const socialPlatform = detectSocialPlatform(url);
    if (socialPlatform) {
      console.log(`[fetch-article-preview] Detected ${socialPlatform} link`);
      
      // ALWAYS try Jina AI Reader first for ALL social platforms (richer metadata)
      const jinaResult = await fetchSocialWithJina(url, socialPlatform);
      if (jinaResult && jinaResult.content && jinaResult.content.length > 50) {
        console.log(`[fetch-article-preview] ✅ Jina AI successful for ${socialPlatform}`);
        return new Response(JSON.stringify({ success: true, ...jinaResult }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log(`[fetch-article-preview] ⚠️ Jina AI failed or returned poor content for ${socialPlatform}, trying fallback`);
      
      // TikTok-specific handling with oEmbed
      if (socialPlatform === 'tiktok') {
        console.log('[TikTok] Trying oEmbed API');
        try {
          const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
          const response = await fetch(oembedUrl);
          
          if (response.ok) {
            const data = await response.json();
            
            // FASE 2: Logging dettagliato TikTok embedHtml
            console.log('[TikTok] 🎬 oEmbed response:', {
              hasEmbedHtml: !!data.html,
              embedHtmlLength: data.html?.length || 0,
              hasTitle: !!data.title,
              hasAuthor: !!data.author_name,
              hasThumbnail: !!data.thumbnail_url
            });
            console.log('[TikTok] ✅ oEmbed successful');
            
            return new Response(JSON.stringify({
              success: true,
              title: data.title || 'Video TikTok',
              content: data.title || '',
              summary: data.title || '',
              image: data.thumbnail_url || '',
              previewImg: data.thumbnail_url || '',
              embedHtml: data.html,
              author: data.author_name || 'TikTok User',
              author_username: data.author_name?.replace('@', '') || '',
              platform: 'tiktok',
              type: 'video',
              hostname: 'tiktok.com',
              contentQuality: 'partial'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (error) {
          console.error('[TikTok] oEmbed failed:', error);
        }
        
        // TikTok fallback
        return new Response(JSON.stringify({
          success: true,
          title: 'Video TikTok',
          content: '',
          summary: 'Contenuto TikTok - apri l\'originale per visualizzare',
          platform: 'tiktok',
          type: 'video',
          hostname: 'tiktok.com',
          contentQuality: 'minimal'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      
      
      // Threads-specific fallback: OpenGraph
      if (socialPlatform === 'threads') {
        console.log('[Threads] 🔍 Trying OpenGraph fallback...');
        
        try {
          const ogData = await fetchOpenGraphData(url);
          if (ogData && (ogData.title || ogData.description)) {
            console.log('[Threads] ✅ OpenGraph successful');
            const cleanedContent = cleanReaderText(ogData.description || '');
            return new Response(JSON.stringify({
              success: true,
              title: ogData.title || 'Post Threads',
              content: cleanedContent,
              summary: cleanedContent.slice(0, 200) || 'Contenuto Threads',
              image: ogData.image || '',
              previewImg: ogData.image || '',
              author: ogData.author || 'Threads User',
              platform: 'threads',
              type: 'social',
              hostname: 'threads.net',
              contentQuality: cleanedContent.length > 100 ? 'partial' : 'minimal'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (error) {
          console.error('[Threads] OpenGraph error:', error);
        }
        
        // Final minimal fallback for Threads
        console.log('[Threads] ✗ All extraction methods failed, returning minimal');
        return new Response(JSON.stringify({
          success: true,
          title: 'Post Threads',
          content: '',
          summary: 'Apri il link originale per visualizzare il contenuto Threads.',
          platform: 'threads',
          type: 'social',
          hostname: 'threads.net',
          contentQuality: 'minimal'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Fallback to oEmbed ONLY for Twitter (last resort)
      if (socialPlatform === 'twitter') {
        try {
          const twitterUrl = url.replace('x.com', 'twitter.com');
          const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(twitterUrl)}`;
          
          const response = await fetch(oembedUrl);
          
          if (response.ok) {
            const data = await response.json();
            
            // Extract plain text from HTML for content field
            const plainText = extractTextFromHtml(data.html || '');
            
            // Extract image URL from oEmbed data or HTML
            let imageUrl = '';
            if (data.thumbnail_url) {
              imageUrl = data.thumbnail_url;
            } else if (data.html) {
              // Try to extract image from HTML
              const imgMatch = data.html.match(/<img[^>]+src="([^">]+)"/);
              if (imgMatch) {
                imageUrl = imgMatch[1];
              }
            }
            
            const result = {
              title: data.author_name ? `Post by @${data.author_name}` : 'Post da X/Twitter',
              author_username: data.author_name || '',
              author_name: data.author_name || '',
              summary: plainText,
              content: plainText,
              image: imageUrl,
              previewImg: imageUrl,
              platform: 'twitter',
              type: 'social',
              embedHtml: data.html,
              hostname: 'x.com'
            };

            return new Response(JSON.stringify({ success: true, ...result }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (twitterError) {
          console.error('[fetch-article-preview] Twitter oEmbed fallback failed:', twitterError);
        }
      }
    }

    // Check if domain needs enhanced extraction (sites that block bots)
    const FORCE_ENHANCED_DOMAINS = [
      'hdblog.it',
      'www.hdblog.it',
      'hdmotori.it',
      'www.hdmotori.it',
      'hdblog.com',
      'www.hdblog.com',
      'smartworld.it',
      'www.smartworld.it',
      'tomshw.it',
      'www.tomshw.it'
    ];

    const urlHostname = new URL(url).hostname.toLowerCase();
    const isForceEnhancedDomain = FORCE_ENHANCED_DOMAINS.some(domain => urlHostname.includes(domain.replace('www.', '')));
    
    if (isForceEnhancedDomain) {
      console.log(`[Preview] 🔧 Using enhanced extraction for: ${urlHostname}`);
      
      // Try multiple fetch strategies with different header configurations
      const fetchStrategies = [
        // Strategy 1: Full browser-like headers
        {
          name: 'full-browser',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'DNT': '1',
            'Referer': `https://${urlHostname}/`,
          }
        },
        // Strategy 2: Minimal headers (some sites block "perfect" headers)
        {
          name: 'minimal',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept': 'text/html',
          }
        },
        // Strategy 3: Mobile User-Agent
        {
          name: 'mobile',
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9',
          }
        }
      ];
      
      let html = '';
      let fetchSuccess = false;
      
      for (const strategy of fetchStrategies) {
        if (fetchSuccess) break;
        
        try {
          console.log(`[Preview] 🔄 Trying ${strategy.name} strategy for ${urlHostname}...`);
          
          const response = await fetch(url, {
            headers: strategy.headers,
            redirect: 'follow',
          });
          
          if (response.ok) {
            html = await response.text();
            if (html.length > 1000) {
              fetchSuccess = true;
              console.log(`[Preview] ✅ ${strategy.name} strategy successful, HTML length: ${html.length}`);
            } else {
              console.log(`[Preview] ⚠️ ${strategy.name} returned thin response: ${html.length} chars`);
            }
          } else {
            console.log(`[Preview] ❌ ${strategy.name} failed: ${response.status}`);
          }
        } catch (strategyError: any) {
          console.log(`[Preview] ❌ ${strategy.name} error: ${strategyError.message}`);
        }
      }
      
      if (fetchSuccess && html.length > 1000) {
        // Extract metadata
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        let title = titleMatch ? extractTextFromHtml(titleMatch[1]) : '';
        
        // OG title fallback
        if (!title || title.length < 5) {
          const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
          if (ogTitleMatch) title = extractTextFromHtml(ogTitleMatch[1]);
        }
        
        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
        const description = descMatch ? extractTextFromHtml(descMatch[1]) : '';
        
        const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        const image = imgMatch ? imgMatch[1] : '';
        
        // HDBlog-specific article selectors
        const hdblogSelectors = [
          // HDBlog specific
          /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
          /<div[^>]*class="[^"]*article-body[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
          /<div[^>]*class="[^"]*post-body[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
          /<div[^>]*class="[^"]*body[^"]*"[^>]*id="[^"]*articolo[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
          // Generic article selectors
          /<article[^>]*>([\s\S]*?)<\/article>/gi,
          /<main[^>]*>([\s\S]*?)<\/main>/gi,
          /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        ];
        
        let articleHtml = '';
        for (const selector of hdblogSelectors) {
          // Reset regex lastIndex
          selector.lastIndex = 0;
          const match = selector.exec(html);
          if (match && match[1] && match[1].length > 300) {
            articleHtml = match[1];
            console.log(`[Preview] 📄 Found article container with selector, length: ${articleHtml.length}`);
            break;
          }
        }
        
        // Clean article HTML - remove unwanted elements
        const cleanHtml = (articleHtml || html)
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
          .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
          .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
          .replace(/<div[^>]*class="[^"]*(?:nav|menu|sidebar|header|footer|widget|social|share|related|comment|ads?|banner|newsletter)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
          .replace(/<div[^>]*id="[^"]*(?:nav|menu|sidebar|header|footer|widget|social|share|related|comment|ads?|banner|newsletter)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
        
        // Extract paragraphs with Italian site cleaning
        const paragraphs: string[] = [];
        const pRegex = /<p[^>]*>(.+?)<\/p>/gis;
        let match;
        while ((match = pRegex.exec(cleanHtml)) !== null && paragraphs.length < 15) {
          const text = extractTextFromHtml(match[0]);
          
          // Skip short paragraphs
          if (text.length < 50) continue;
          
          // Skip Italian site navigation/junk patterns
          const junkPatterns = [
            /^(home|newsletter|podcast|shop|regala|abbonati|privacy|cookie|menu|contatti)/i,
            /leggi anche/i,
            /potrebbe interessarti/i,
            /ti consigliamo/i,
            /iscriviti alla newsletter/i,
            /^Facebook\s+X\s*\(?Twitter\)?/i,
            /^Email\s+Whatsapp/i,
            /^Condividi\s+su/i,
            /^Segui\s+su/i,
            /^Sostieni/i,
            /\(AP Photo[^)]*\)/,
            /^AP Photo/i,
            /^Getty Images/i,
            /^ANSA/i,
            /^Foto:/i,
            /^©/,
            /^Fonte:/i,
            /^Via:/i,
            /^Source:/i,
            /^Pubblicità/i,
            /^Advertisement/i,
            /^Sponsored/i,
            /clicca qui/i,
            /scopri di più/i,
            /acquista ora/i,
          ];
          
          if (junkPatterns.some(p => p.test(text))) continue;
          
          // Skip lines with multiple pipe separators (menu pattern)
          if ((text.match(/\|/g) || []).length >= 2) continue;
          
          // Skip navigation-like short lines
          const words = text.split(/\s+/);
          if (words.length <= 6) {
            const capitalizedWords = words.filter(w => /^[A-Z][a-z]*$/.test(w)).length;
            if (capitalizedWords >= 3) continue;
          }
          
          paragraphs.push(text);
        }
        
        const content = paragraphs.length > 0 ? paragraphs.join('\n\n') : '';
        
        console.log(`[Preview] 📊 Extracted ${paragraphs.length} paragraphs, content length: ${content.length}`);
        
        // If we got decent content, return it
        if (content.length > 200 || (title && image)) {
          const cleanedContent = cleanReaderText(content || description);
          return new Response(JSON.stringify({ 
            success: true, 
            title: title || 'Articolo',
            summary: description || cleanedContent.slice(0, 200),
            content: cleanedContent,
            image,
            previewImg: image,
            platform: 'generic',
            type: 'article',
            hostname: urlHostname,
            contentQuality: cleanedContent.length > 500 ? 'complete' : 'partial'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Content too thin - try Jina AI as fallback
        console.log(`[Preview] ⚠️ Direct extraction yielded thin content (${content.length} chars), trying Jina AI...`);
      }
      
      // If direct fetch failed completely, try Jina AI
      const jinaResult = await fetchSocialWithJina(url, 'article');
      if (jinaResult && jinaResult.content && jinaResult.content.length > 100) {
        console.log(`[Preview] ✅ Jina AI successful for ${urlHostname}`);
        return new Response(JSON.stringify({ 
          success: true, 
          ...jinaResult,
          platform: 'generic',
          type: 'article',
          hostname: urlHostname,
          contentQuality: jinaResult.content.length > 500 ? 'complete' : 'partial'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // NEW: Try Google Web Cache as proxy for blocked sites
      console.log(`[Preview] 🔄 Trying Google Web Cache for ${urlHostname}...`);
      try {
        const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}&strip=1`;
        const cacheResponse = await fetch(cacheUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
          }
        });
        
        if (cacheResponse.ok) {
          const cacheHtml = await cacheResponse.text();
          console.log(`[Preview] ✅ Google Cache response received, length: ${cacheHtml.length}`);
          
          // Extract title from cached page
          const cacheTitleMatch = cacheHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
          let cacheTitle = cacheTitleMatch ? extractTextFromHtml(cacheTitleMatch[1]) : '';
          // Clean Google cache prefix from title
          cacheTitle = cacheTitle.replace(/^(cache:|Cached\s+)/i, '').trim();
          
          // Extract meta description
          const cacheDescMatch = cacheHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
          const cacheDesc = cacheDescMatch ? extractTextFromHtml(cacheDescMatch[1]) : '';
          
          // Extract og:image
          const cacheImgMatch = cacheHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
          const cacheImage = cacheImgMatch ? cacheImgMatch[1] : '';
          
          // Extract paragraphs from cached content (skip Google's cache header)
          const cacheParagraphs: string[] = [];
          const cachePRegex = /<p[^>]*>(.+?)<\/p>/gis;
          let cacheMatch;
          while ((cacheMatch = cachePRegex.exec(cacheHtml)) !== null && cacheParagraphs.length < 15) {
            const text = extractTextFromHtml(cacheMatch[0]);
            if (text.length < 50) continue;
            // Skip Google cache banner text
            if (text.includes('Google\'s cache') || text.includes('snapshot of the page')) continue;
            if (text.includes('cached version') || text.includes('current page')) continue;
            cacheParagraphs.push(text);
          }
          
          const cacheContent = cacheParagraphs.join('\n\n');
          
          if (cacheContent.length > 150 || (cacheTitle && cacheImage)) {
            console.log(`[Preview] ✅ Google Cache extraction successful: ${cacheContent.length} chars`);
            const cleanedCacheContent = cleanReaderText(cacheContent || cacheDesc);
            return new Response(JSON.stringify({
              success: true,
              title: cacheTitle || `Contenuto da ${urlHostname}`,
              summary: cacheDesc || cleanedCacheContent.slice(0, 200),
              content: cleanedCacheContent,
              image: cacheImage,
              previewImg: cacheImage,
              platform: 'generic',
              type: 'article',
              hostname: urlHostname,
              contentQuality: cleanedCacheContent.length > 500 ? 'complete' : 'partial',
              source: 'google-cache'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } else {
          console.log(`[Preview] ⚠️ Google Cache returned ${cacheResponse.status}`);
        }
      } catch (cacheError) {
        console.error(`[Preview] ⚠️ Google Cache error:`, cacheError);
      }
      
      // Final fallback: OpenGraph only
      console.log(`[Preview] ⚠️ All extraction methods failed for ${urlHostname}, trying OpenGraph fallback...`);
      const ogData = await fetchOpenGraphData(url);
      if (ogData && (ogData.title || ogData.description || ogData.image)) {
        console.log(`[Preview] 📋 OpenGraph fallback successful for ${urlHostname}`);
        return new Response(JSON.stringify({
          success: true,
          title: ogData.title || `Contenuto da ${urlHostname}`,
          summary: ogData.description || '',
          content: ogData.description || `Apri il link originale per leggere l'articolo completo.`,
          image: ogData.image || '',
          previewImg: ogData.image || '',
          platform: 'generic',
          type: 'article',
          hostname: urlHostname,
          contentQuality: 'minimal'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Ultimate fallback - extract readable title from URL path
      console.log(`[Preview] 🔴 All methods failed for ${urlHostname}, extracting title from URL...`);
      const urlPath = new URL(url).pathname;
      // Parse URL slug into readable title: /passo-a-macos-dopo-una-vita-su-windows/ → "Passo a macOS dopo una vita su Windows"
      const urlSlug = urlPath.split('/').filter(s => s.length > 10).pop() || '';
      let urlTitle = urlSlug
        .replace(/[-_]/g, ' ')
        .replace(/\d{4,}/g, '') // Remove long numbers
        .replace(/\.(html?|php|aspx?)$/i, '') // Remove file extensions
        .trim();
      // Capitalize first letter
      if (urlTitle) {
        urlTitle = urlTitle.charAt(0).toUpperCase() + urlTitle.slice(1);
      }
      
      return new Response(JSON.stringify({
        success: true,
        title: urlTitle || `Contenuto da ${urlHostname}`,
        summary: urlTitle ? `${urlTitle} - ${urlHostname}` : `Questo sito potrebbe bloccare l'analisi automatica.`,
        content: `Apri il link originale per visualizzare il contenuto.`,
        platform: 'generic',
        type: 'article',
        hostname: urlHostname,
        contentQuality: 'minimal',
        extractedFromUrl: !!urlTitle
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generic URL extraction for all other URLs
    try {
      console.log('[fetch-article-preview] Fetching generic URL:', url);
      
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        }
      });
      
      if (pageResponse.ok) {
        const html = await pageResponse.text();
        console.log('[fetch-article-preview] HTML fetched, length:', html.length);
        
        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? extractTextFromHtml(titleMatch[1]) : '';
        
        // Extract meta description
        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
        const description = descMatch ? extractTextFromHtml(descMatch[1]) : '';
        
        // Extract og:image
        const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        const image = imgMatch ? imgMatch[1] : '';
        
        // Try to find article content using specific selectors
        let articleHtml = '';
        const articleSelectors = [
          /<article[^>]*>([\s\S]*?)<\/article>/gi,
          /<main[^>]*>([\s\S]*?)<\/main>/gi,
          /<div[^>]*class="[^"]*(?:post-content|article-body|entry-content|article-content|story-body|post-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        ];
        
        for (const selector of articleSelectors) {
          selector.lastIndex = 0;
          const articleMatch = selector.exec(html);
          if (articleMatch && articleMatch[1] && articleMatch[1].length > 200) {
            articleHtml = articleMatch[1];
            break;
          }
        }
        
        // Clean HTML
        const cleanArticleHtml = (articleHtml || html)
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        
        // Extract paragraphs
        const paragraphs: string[] = [];
        const pRegex = /<p[^>]*>(.+?)<\/p>/gis;
        let match;
        while ((match = pRegex.exec(cleanArticleHtml)) !== null && paragraphs.length < 10) {
          const text = extractTextFromHtml(match[0]);
          if (text.length < 40) continue;
          paragraphs.push(text);
        }
        
        const content = paragraphs.length > 0 ? paragraphs.join('\n\n') : description;
        const cleanedContent = cleanReaderText(content || description);
        
        return new Response(JSON.stringify({
          success: true,
          title: title || 'Article',
          summary: description,
          content: cleanedContent,
          image,
          previewImg: image,
          platform: 'generic',
          type: 'article',
          hostname: new URL(url).hostname,
          contentQuality: cleanedContent.length > 300 ? 'complete' : 'partial'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (fetchError) {
      console.error('[fetch-article-preview] Generic URL fetch failed:', fetchError);
    }
    
    // Fallback
    const result = {
      success: true,
      title: 'Article',
      summary: '',
      content: 'Apri il link per leggere il contenuto completo.',
      platform: 'generic',
      type: 'article',
      hostname: new URL(url).hostname
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[fetch-article-preview] Error:', error);
    
    // FASE 2: Fallback graceful per errori 403/503 (HDBlog, siti bloccati)
    const errorStatus = (error as any)?.status;
    if (url && (errorStatus === 403 || errorStatus === 503)) {
      try {
        const hostname = new URL(url).hostname;
        console.log(`[Preview] 🔴 Sito bloccato (${errorStatus}): ${hostname} - restituisco placeholder`);
        return new Response(JSON.stringify({
          success: true,
          title: `Contenuto da ${hostname}`,
          content: `Questo sito (${hostname}) blocca l'analisi automatica. Apri l'originale per visualizzare.`,
          summary: `Sito bloccato - ${hostname}`,
          platform: 'article',
          type: 'article',
          hostname,
          contentQuality: 'minimal'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (fallbackError) {
        console.error('[Preview] Fallback error:', fallbackError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred fetching article preview',
        code: 'INTERNAL_ERROR'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

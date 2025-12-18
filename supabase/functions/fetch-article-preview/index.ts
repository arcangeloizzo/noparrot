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
    const hostname = new URL(url).hostname;
    
    // NOTE: Facebook/Instagram/Threads are now handled in the social platform section below
    // Jina AI Reader will be tried first, with platform-specific fallbacks

    // Check if it's a YouTube link
    const youtubeId = extractYouTubeId(url);
    if (youtubeId) {
      console.log('[fetch-article-preview] Detected YouTube video:', youtubeId);
      
      try {
        // STEP 1: Fetch YouTube metadata using oEmbed FIRST (fast, ~200ms)
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const oembedResponse = await fetch(oembedUrl);
        
        if (!oembedResponse.ok) {
          throw new Error('Failed to fetch YouTube oEmbed data');
        }
        
        const oembedData = await oembedResponse.json();
        console.log('[YouTube] ✅ oEmbed fetched:', oembedData.title);
        
        // STEP 2: Try transcript with AGGRESSIVE timeout (8 seconds max)
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        let transcript = null;
        let transcriptSource = 'none';
        let transcriptAvailable = false;
        let transcriptError = null;
        
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          try {
            console.log(`[YouTube] ⏱️ Attempting transcript fetch with 8s timeout for ${youtubeId}`);
            
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
            
            const transcriptResponse = await fetch(
              `${SUPABASE_URL}/functions/v1/transcribe-youtube`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({ url }),
                signal: controller.signal,
              }
            );
            
            clearTimeout(timeoutId);
            
            if (transcriptResponse.ok) {
              const transcriptData = await transcriptResponse.json();
              
              console.log('[YouTube] 📝 Transcript response:', {
                hasTranscript: !!transcriptData.transcript,
                transcriptLength: transcriptData.transcript?.length || 0,
                transcriptSource: transcriptData.source,
                disabled: transcriptData.disabled,
                error: transcriptData.error
              });
              
              // Check if transcript is disabled - skip entirely
              if (transcriptData.disabled || transcriptData.source === 'disabled') {
                console.log('[YouTube] ⏭️ Transcript disabled for this video, returning oEmbed only');
                transcriptError = 'Transcript is disabled for this video';
              } else if (transcriptData.transcript && transcriptData.transcript.length > 50) {
                transcript = transcriptData.transcript;
                transcriptSource = transcriptData.source || 'youtube_captions';
                transcriptAvailable = true;
                console.log(`[YouTube] ✅ Transcript fetched (${transcriptSource}), length: ${transcript.length}`);
              } else if (transcriptData.error) {
                transcriptError = transcriptData.error;
                console.warn(`[YouTube] ⚠️ Transcript error: ${transcriptData.error}`);
              } else {
                console.warn(`[YouTube] ⚠️ Transcript too short or empty`);
              }
            } else {
              const errorText = await transcriptResponse.text();
              transcriptError = `HTTP ${transcriptResponse.status}`;
              console.error(`[YouTube] ❌ Transcript fetch failed: ${transcriptError}`);
            }
          } catch (transcriptFetchError: any) {
            if (transcriptFetchError.name === 'AbortError') {
              transcriptError = 'Timeout (8s)';
              console.warn('[YouTube] ⏱️ Transcript fetch TIMEOUT after 8 seconds');
            } else {
              transcriptError = transcriptFetchError instanceof Error ? transcriptFetchError.message : 'Unknown error';
              console.error('[YouTube] ❌ Exception fetching transcript:', transcriptFetchError);
            }
          }
        } else {
          console.warn('[YouTube] ⚠️ Missing SUPABASE_URL or SERVICE_ROLE_KEY');
        }
        
        // STEP 3: Return preview immediately with oEmbed data (transcript optional)
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
          transcript: transcript,
          transcriptSource: transcriptSource,
          transcriptAvailable,
          transcriptError,
          author: oembedData.author_name,
          authorUrl: oembedData.author_url,
          contentQuality: (transcript && typeof transcript === 'string' && transcript.length > 500) 
            ? 'complete' 
            : 'partial'
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
        
        // Parse artist and track title from oEmbed - METODI MULTIPLI
        let artist = '';
        let trackTitle = oembedData.title || '';
        
        // METODO 1: Controlla se author_name contiene l'artista (Spotify spesso lo usa)
        if (oembedData.author_name && oembedData.author_name !== 'Spotify') {
          artist = oembedData.author_name.trim();
          trackTitle = oembedData.title || '';
          console.log(`[Spotify] Metodo 1 (author_name): "${trackTitle}" by "${artist}"`);
        }
        
        // METODO 2: Parse dal titolo se formato "Title - Artist"
        if (!artist) {
          const titleMatch = oembedData.title?.match(/^(.+?)\s*[-–—]\s*(.+)$/);
          if (titleMatch) {
            trackTitle = titleMatch[1].trim();
            artist = titleMatch[2].trim();
            console.log(`[Spotify] Metodo 2 (title parse): "${trackTitle}" by "${artist}"`);
          }
        }
        
        // METODO 3: Estrai dall'HTML embed di Spotify
        if (!artist && oembedData.html) {
          // Pattern più flessibili per l'HTML di Spotify
          const htmlPatterns = [
            /by\s+<a[^>]*>([^<]+)<\/a>/i,                    // by <a>Artist</a>
            /artist['":\s]+([^'"<>,]+)/i,                   // artist: "Name" o artist='Name'
            /<span[^>]*class="[^"]*artist[^"]*"[^>]*>([^<]+)/i, // <span class="...artist...">Name
            /data-artist="([^"]+)"/i,                       // data-artist="Name"
          ];
          
          for (const pattern of htmlPatterns) {
            const match = oembedData.html.match(pattern);
            if (match && match[1]) {
              artist = match[1].trim();
              trackTitle = oembedData.title || '';
              console.log(`[Spotify] Metodo 3 (HTML pattern): "${trackTitle}" by "${artist}"`);
              break;
            }
          }
        }
        
        // METODO 4: Estrai dal thumbnail URL (contiene spesso l'ID artista, non usabile direttamente)
        // Skip - non affidabile
        
        console.log(`[Spotify] Final parsed: "${trackTitle}" by "${artist || '(unknown)'}" `);
        
        let transcript = null;
        let transcriptSource = 'none';
        let transcriptAvailable = false;
        let transcriptError = null;
        let geniusUrl = '';
        
        // For tracks, try to fetch lyrics from Genius
        // MIGLIORAMENTO: Prova anche SENZA artista se abbiamo il titolo
        if (spotifyInfo.type === 'track' && trackTitle) {
          // Prima prova con artista (se disponibile), poi solo con titolo
          let lyricsResult = null;
          
          if (artist) {
            console.log(`[Spotify] 🔍 Searching lyrics with artist: "${artist}" + "${trackTitle}"`);
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

    // Generic URL - try basic fetch
    try {
      console.log('[fetch-article-preview] Fetching URL:', url);
      
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)'
        }
      });
      
      if (pageResponse.ok) {
        const html = await pageResponse.text();
        console.log('[fetch-article-preview] HTML fetched, length:', html.length);
        
        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : '';
        
        // Extract meta description
        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
        const description = descMatch ? descMatch[1].trim() : '';
        
        // Extract og:image
        const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        const image = imgMatch ? imgMatch[1] : '';
        
        // STEP 1: Try to find article content using specific selectors
        let articleHtml = '';
        const articleSelectors = [
          /<article[^>]*>([\s\S]*?)<\/article>/gi,
          /<main[^>]*>([\s\S]*?)<\/main>/gi,
          /<div[^>]*class="[^"]*(?:post-content|article-body|entry-content|article-content|story-body|post-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
          /<div[^>]*id="[^"]*(?:article|content|post|story)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
        ];
        
        for (const selector of articleSelectors) {
          const articleMatch = selector.exec(html);
          if (articleMatch && articleMatch[1] && articleMatch[1].length > 200) {
            articleHtml = articleMatch[1];
            console.log('[fetch-article-preview] Found article container, length:', articleHtml.length);
            break;
          }
        }
        
        // STEP 2: Remove navigation/header/footer/aside elements from article HTML
        const cleanArticleHtml = (articleHtml || html)
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
          .replace(/<menu[^>]*>[\s\S]*?<\/menu>/gi, '')
          .replace(/<div[^>]*class="[^"]*(?:nav|menu|sidebar|header|footer|widget|social|share|related|comment)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
        
        // STEP 3: Extract paragraphs with smart filtering
        const paragraphs: string[] = [];
        const pRegex = /<p[^>]*>(.+?)<\/p>/gis;
        let match;
        while ((match = pRegex.exec(cleanArticleHtml)) !== null && paragraphs.length < 10) {
          const text = extractTextFromHtml(match[0]);
          
          // Skip short paragraphs
          if (text.length < 40) continue;
          
          // Skip navigation-like content
          const words = text.split(/\s+/);
          if (words.length <= 8) {
            // Short line - check if it's menu-like (many capitalized single words)
            const capitalizedWords = words.filter(w => /^[A-Z][a-z]*$/.test(w)).length;
            if (capitalizedWords >= 3) continue;
          }
          
          // Skip lines with multiple pipe separators (menu pattern)
          if ((text.match(/\|/g) || []).length >= 2) continue;
          
          // Skip common navigation patterns
          const navPatterns = [
            /^(home|newsletter|podcast|shop|regala|abbonati|privacy|cookie|menu|contatti)/i,
            /leggi anche/i,
            /ti potrebbe interessare/i,
            /iscriviti alla newsletter/i
          ];
          if (navPatterns.some(p => p.test(text))) continue;
          
          paragraphs.push(text);
        }
        const content = paragraphs.length > 0 ? paragraphs.join('\n\n') : description;
        
        console.log('[fetch-article-preview] Extracted data:', { 
          title, 
          hasDescription: !!description, 
          hasImage: !!image,
          paragraphCount: paragraphs.length,
          contentLength: content.length,
          usedArticleSelector: !!articleHtml
        });
        
        // STEP 4: Check if content looks "dirty" (navigation mixed in)
        const hasDirtyContent = content && (
          /^(Newsletter|Podcast|Shop|Home|Menu|Regala)/m.test(content) ||
          content.split('\n').filter(line => line.trim().length > 0 && line.trim().length < 20).length > 3
        );
        
        // If we got minimal data, short content, OR dirty content -> try AI extraction
        if (!title || title === 'Article' || (!description && !content) || content.length < 300 || hasDirtyContent) {
          console.log('[fetch-article-preview] Poor/dirty extraction, trying Lovable AI fallback', { hasDirtyContent });
          console.log('[fetch-article-preview] Poor extraction, trying Lovable AI fallback');
          
          try {
            const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
            if (!LOVABLE_API_KEY) {
              console.error('[fetch-article-preview] LOVABLE_API_KEY not configured');
              throw new Error('AI extraction unavailable');
            }

            const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [
                  { 
                    role: 'system', 
                    content: 'You are an expert at extracting ONLY the main article body text from news websites. You MUST:\n1. IGNORE ALL navigation menus (Home, Shop, Newsletter, etc.), headers, footers, sidebars, ads, cookie notices, social widgets\n2. Extract ONLY paragraphs that are part of the main article content\n3. Remove standalone menu-like lines (e.g. "Home | About | Contact")\n4. The article should read coherently from start to finish\n5. Remove all HTML tags, ads, and formatting\n6. Return ONLY valid JSON with: title, description (max 300 chars), content (full article text, minimum 500 chars)\n7. If you see repeated navigation items or technical metadata (Newsletter, Podcast, Shop, Privacy, Cookie, etc.), DO NOT include them\n8. The content should start directly with the article\'s first paragraph, not with navigation or menus\n9. Each line should be a complete sentence or paragraph, not a menu item' 
                  },
                  { 
                    role: 'user', 
                    content: `Extract clean article text from this HTML page. 

CRITICAL RULES:
- Remove ALL navigation menus, headers, footers, sidebars
- Remove lines like "Home | About | Contact" or "Newsletter | Podcast | Shop"
- Remove social media widgets and sharing buttons
- Remove "Leggi anche", "Ti potrebbe interessare", related articles
- Remove author bio boxes and tags at the end
- Return ONLY the main article paragraphs

HTML:
${html.substring(0, 20000).replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '').replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '').replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '').replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '').replace(/<menu[^>]*>[\s\S]*?<\/menu>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')}` 
                  }
                ],
                temperature: 0.2,
                max_tokens: 2000
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const aiContent = aiData.choices?.[0]?.message?.content;
              
              if (aiContent) {
                console.log('[fetch-article-preview] AI response:', aiContent);
                
                try {
                  // Remove markdown code fences if present
                  let cleanContent = aiContent.trim();
                  if (cleanContent.startsWith('```json')) {
                    cleanContent = cleanContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
                  } else if (cleanContent.startsWith('```')) {
                    cleanContent = cleanContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
                  }
                  
                  const extracted = JSON.parse(cleanContent);
                  
                  // Post-processing: Filter menu-like lines from AI-extracted content
                  let cleanedAiContent = extracted.content || '';
                  if (cleanedAiContent) {
                    const lines = cleanedAiContent.split('\n').filter((line: string) => {
                      const trimmed = line.trim();
                      
                      // Keep empty lines for spacing
                      if (!trimmed) return true;
                      
                      // Skip very short lines unless they're list items
                      if (trimmed.length < 20 && !/^[\d-•]/.test(trimmed)) return false;
                      
                      // Skip lines with multiple pipe separators (menu pattern)
                      const pipeCount = (trimmed.match(/\|/g) || []).length;
                      if (pipeCount >= 2) return false;
                      
                      const words = trimmed.split(/\s+/);
                      
                      // Skip short lines (3-8 words) with many capitalized words (menu items)
                      if (words.length >= 3 && words.length <= 8) {
                        const capitalizedCount = words.filter((w: string) => /^[A-Z]/.test(w)).length;
                        if (capitalizedCount / words.length > 0.7) return false;
                      }
                      
                      // Filter common navigation patterns
                      const navPatterns = [
                        /^(home|newsletter|podcast|shop|regala|abbonati|privacy|terms|cookie|menu|contatti|chi siamo)/i,
                        /leggi anche/i,
                        /ti potrebbe interessare/i,
                        /vedi anche/i,
                        /iscriviti/i,
                        /seguici/i
                      ];
                      
                      if (navPatterns.some(pattern => pattern.test(trimmed))) return false;
                      
                      return true;
                    });
                    
                    cleanedAiContent = lines.join('\n\n');
                  }
                  
                  // Clean the AI-extracted content too
                  cleanedAiContent = cleanReaderText(cleanedAiContent);
                  
                  const result = {
                    success: true,
                    title: extracted.title || title || 'Article',
                    summary: extracted.description || description,
                    content: cleanedAiContent || content || extracted.description || description,
                    image,
                    previewImg: image,
                    platform: 'generic',
                    type: 'article',
                    hostname: new URL(url).hostname,
                    contentQuality: cleanedAiContent.length > 500 ? 'complete' : 'partial'
                  };
                  
                  console.log('[fetch-article-preview] ✅ AI extraction successful, content length:', cleanedAiContent.length);
                  return new Response(JSON.stringify(result), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  });
                } catch (parseError) {
                  console.error('[fetch-article-preview] Failed to parse AI JSON:', parseError);
                }
              }
            }
          } catch (aiError) {
            console.error('[fetch-article-preview] AI extraction failed:', aiError);
          }
        }
        
        // Return what we extracted (even if minimal) - with cleaned content
        const cleanedContent = cleanReaderText(content || description);
        const result = {
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
        };
        
        return new Response(JSON.stringify(result), {
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

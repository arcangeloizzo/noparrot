import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// SECURITY: URL VALIDATION TO PREVENT SSRF
// ============================================================================
// Block internal/private network URLs and non-HTTP protocols
function isValidExternalUrl(url: string): { valid: boolean; reason?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, reason: 'URL is required' };
  }
  
  try {
    const parsed = new URL(url.trim());
    
    // Only allow HTTP/HTTPS protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: `Protocol ${parsed.protocol} not allowed` };
    }
    
    const hostname = parsed.hostname.toLowerCase();
    
    // Block localhost and loopback
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return { valid: false, reason: 'Localhost URLs not allowed' };
    }
    
    // Block private IP ranges
    const privateRanges = [
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,           // 10.x.x.x
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/, // 172.16-31.x.x
      /^192\.168\.\d{1,3}\.\d{1,3}$/,              // 192.168.x.x
      /^169\.254\.\d{1,3}\.\d{1,3}$/,              // Link-local
      /^0\.0\.0\.0$/,                              // 0.0.0.0
    ];
    
    for (const range of privateRanges) {
      if (range.test(hostname)) {
        return { valid: false, reason: 'Private IP addresses not allowed' };
      }
    }
    
    // Block internal hostnames
    const blockedPatterns = [
      /^.*\.local$/,
      /^.*\.internal$/,
      /^.*\.localhost$/,
      /^metadata\.google\.internal$/,
      /^169\.254\.169\.254$/,  // AWS/GCP metadata
    ];
    
    for (const pattern of blockedPatterns) {
      if (pattern.test(hostname)) {
        return { valid: false, reason: 'Internal hostnames not allowed' };
      }
    }
    
    // URL length limit
    if (url.length > 2048) {
      return { valid: false, reason: 'URL too long' };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }
}

// ============================================================================
// URL NORMALIZATION FOR CONSISTENT CACHE KEYS
// ============================================================================
// Removes tracking parameters, normalizes protocol/hostname for reliable cache hits
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'gclid', 'gclsrc', 'msclkid', 'dclid', 'igshid', 'twclid', 'ttclid', 'ref'
]);

function safeNormalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    url.protocol = 'https:';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.hash = '';
    
    const cleanParams = new URLSearchParams();
    const entries = Array.from(url.searchParams.entries())
      .filter(([key]) => {
        const lowerKey = key.toLowerCase();
        if (lowerKey.startsWith('utm_')) return false;
        return !TRACKING_PARAMS.has(lowerKey);
      })
      .sort(([a], [b]) => a.localeCompare(b));
    
    for (const [key, value] of entries) {
      cleanParams.set(key, value);
    }
    url.search = cleanParams.toString();
    
    let path = url.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    url.pathname = path;
    
    return url.toString();
  } catch {
    return rawUrl.trim();
  }
}

// ============================================================================
// SOURCE-FIRST READER REFACTORING
// ============================================================================
// This edge function now:
// 1. Caches full content server-side in content_cache table
// 2. Returns ONLY metadata + qaSourceRef to client (NO full text)
// 3. Client uses iframe/embed to show content, never full text
// ============================================================================

// Extract plain text from HTML - Enhanced version
function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
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
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  text = text.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

// Aggressive HTML cleaning for reader
function cleanReaderText(html: string): string {
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n$1\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
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
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  text = text.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

function isBotChallengeContent(content: string): boolean {
  const lowerContent = content.toLowerCase();
  const challengeMarkers = [
    'checking your browser',
    'verifica connessione',
    'verify you are human',
    'just a moment',
    'cloudflare',
    'challenges.cloudflare.com',
    'cf-challenge',
    'turnstile',
    'enable javascript and cookies',
    'please wait while we verify',
    'browser check',
    'ddos protection',
    'ray id:',
    'attention required',
    'one more step',
  ];
  
  const matchCount = challengeMarkers.filter(marker => lowerContent.includes(marker)).length;
  if (matchCount >= 2) {
    console.log(`[Challenge] 🚫 Detected bot challenge page (${matchCount} markers)`);
    return true;
  }
  return false;
}

function isLinkedInAuthWallContent(content: string): boolean {
  const lower = content.toLowerCase();
  const markers = [
    'join linkedin',
    'sign in',
    'accedi',
    'iscriviti',
    'you’re signed out',
    'you are signed out',
    'log in',
    'login',
    'continue to linkedin',
  ];

  const matchCount = markers.filter((m) => lower.includes(m)).length;
  // 2+ markers to avoid false positives
  return matchCount >= 2;
}

// Detect truncated LinkedIn content ("... See more" / "... Visualizza altro")
function isLinkedInTruncated(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  const truncationMarkers = [
    '… Visualizza altro',
    '...Visualizza altro',
    '… See more',
    '...See more',
    '…See more',
    '…Visualizza altro',
    '... see more',
    '… see more',
    '...altro',
    '…altro'
  ];
  return truncationMarkers.some(marker => 
    trimmed.toLowerCase().endsWith(marker.toLowerCase())
  );
}

function isGoogleCookieConsent(content: string): boolean {
  const markers = [
    'Prima di continuare su Google',
    'Prima di continuare',
    'Usiamo cookie e dati per',
    'webcache.googleusercontent.com',
    'Accetta tutto',
    'Rifiuta tutto',
    'Altre opzioni',
    'utilizzando i servizi Google',
    'Before you continue to Google',
    'We use cookies and data to',
  ];
  const lowerContent = content.toLowerCase();
  const matchCount = markers.filter(m => lowerContent.includes(m.toLowerCase())).length;
  return matchCount >= 2;
}

function extractJsonLdArticle(html: string): { title?: string; description?: string; image?: string; content?: string; author?: string } | null {
  try {
    const ldJsonMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    
    for (const match of ldJsonMatches) {
      try {
        let jsonContent = match[1].trim();
        const parsed = JSON.parse(jsonContent);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        
        for (const item of items) {
          const itemType = item['@type'];
          const isArticle = ['NewsArticle', 'Article', 'BlogPosting', 'WebPage', 'TechArticle', 'Report'].some(
            type => itemType === type || (Array.isArray(itemType) && itemType.includes(type))
          );
          
          if (isArticle) {
            const result: { title?: string; description?: string; image?: string; content?: string; author?: string } = {};
            
            result.title = item.headline || item.name || '';
            result.description = item.description || '';
            
            if (item.image) {
              if (typeof item.image === 'string') {
                result.image = item.image;
              } else if (Array.isArray(item.image)) {
                result.image = typeof item.image[0] === 'string' ? item.image[0] : item.image[0]?.url || item.image[0]?.['@url'] || '';
              } else if (item.image.url || item.image['@url']) {
                result.image = item.image.url || item.image['@url'];
              }
            }
            
            if (item.articleBody && item.articleBody.length > 100) {
              result.content = item.articleBody;
            }
            
            if (item.author) {
              if (typeof item.author === 'string') {
                result.author = item.author;
              } else if (item.author.name) {
                result.author = item.author.name;
              } else if (Array.isArray(item.author) && item.author[0]) {
                result.author = typeof item.author[0] === 'string' ? item.author[0] : item.author[0].name || '';
              }
            }
            
            if (result.title || result.description || result.content || result.image) {
              console.log(`[JSON-LD] ✅ Found article:`, {
                title: result.title?.slice(0, 50),
                descLen: result.description?.length || 0,
                contentLen: result.content?.length || 0,
                hasImage: !!result.image
              });
              return result;
            }
          }
        }
      } catch (parseErr) {
        continue;
      }
    }
    return null;
  } catch (err) {
    console.error('[JSON-LD] Error parsing:', err);
    return null;
  }
}

function extractFallbackImage(html: string, baseUrl: string): string {
  const twitterImgMatch = html.match(/<meta[^>]+(?:name|property)=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']twitter:image["']/i);
  if (twitterImgMatch && twitterImgMatch[1]) {
    return resolveUrl(twitterImgMatch[1], baseUrl);
  }
  
  const secureImgMatch = html.match(/<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i);
  if (secureImgMatch && secureImgMatch[1]) {
    return resolveUrl(secureImgMatch[1], baseUrl);
  }
  
  const articleImgMatch = html.match(/<article[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
  if (articleImgMatch && articleImgMatch[1] && !articleImgMatch[1].includes('logo') && !articleImgMatch[1].includes('icon')) {
    return resolveUrl(articleImgMatch[1], baseUrl);
  }
  
  const contentImgMatch = html.match(/<div[^>]*class="[^"]*(?:content|article|post)[^"]*"[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
  if (contentImgMatch && contentImgMatch[1] && !contentImgMatch[1].includes('logo') && !contentImgMatch[1].includes('icon')) {
    return resolveUrl(contentImgMatch[1], baseUrl);
  }
  
  return '';
}

function resolveUrl(url: string, base: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
    return url.startsWith('//') ? 'https:' + url : url;
  }
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
    /youtube\.com\/live\/([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

function detectSocialPlatform(url: string): string | null {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
  if (urlLower.includes('linkedin.com')) return 'linkedin';
  if (urlLower.includes('threads.net')) return 'threads';
  if (urlLower.includes('tiktok.com') || urlLower.includes('vm.tiktok.com')) {
    console.log('[Preview] ✅ Detected TikTok URL:', url);
    return 'tiktok';
  }
  return null;
}

function extractSpotifyInfo(url: string): { type: 'track' | 'episode' | 'album' | 'playlist' | 'artist'; id: string } | null {
  const urlLower = url.toLowerCase();
  if (!urlLower.includes('spotify.com') && !urlLower.includes('open.spotify.com')) {
    return null;
  }
  
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

async function fetchSpotifyTrackMetadata(trackId: string, accessToken: string): Promise<{ 
  artist: string; 
  title: string; 
  popularity?: number;
} | null> {
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
    const popularity = track.popularity;
    
    console.log(`[Spotify] ✅ Track metadata: "${title}" by "${artist}" (popularity: ${popularity})`);
    
    return { artist, title, popularity };
  } catch (error) {
    console.error('[Spotify] ❌ Error fetching track metadata:', error);
    return null;
  }
}

// ============================================================================
// SPOTIFY EPISODE → YOUTUBE FALLBACK HELPERS
// ============================================================================
// For podcast episodes, attempt to find the equivalent YouTube video for transcription

// Invidious instances for YouTube search (no API key required)
const INVIDIOUS_INSTANCES = [
  'https://invidious.io.lol',
  'https://yt.artemislena.eu',
  'https://invidious.privacyredirect.com',
];

/**
 * Search YouTube for a podcast episode using Invidious API
 * Returns videoId if a confident match is found (2/3 first words match)
 * @param showName - Podcast show name from Spotify
 * @param episodeTitle - Episode title from Spotify
 * @returns YouTube video ID or null
 */
async function searchYouTubeForPodcast(showName: string, episodeTitle: string): Promise<string | null> {
  const query = `${showName} ${episodeTitle}`;
  console.log(`[Spotify Episode] 🔍 Searching YouTube for: "${query}"`);
  
  // Extract first 3 words from episode title for confidence check
  const titleWords = episodeTitle.toLowerCase().split(/\s+/).filter(w => w.length > 2).slice(0, 3);
  const minMatchRequired = Math.max(2, Math.ceil(titleWords.length * 0.66));
  
  for (const instance of INVIDIOUS_INSTANCES) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout per instance
    
    try {
      const searchUrl = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort=relevance`;
      console.log(`[Spotify Episode] Trying Invidious: ${instance}`);
      
      const response = await fetch(searchUrl, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`[Spotify Episode] Invidious ${instance} returned ${response.status}`);
        continue;
      }
      
      const results = await response.json();
      
      if (!Array.isArray(results) || results.length === 0) {
        console.log(`[Spotify Episode] No results from ${instance}`);
        continue;
      }
      
      // Check first 3 results for confidence match
      for (const video of results.slice(0, 3)) {
        const videoTitle = (video.title || '').toLowerCase();
        const matchedWords = titleWords.filter(word => videoTitle.includes(word));
        
        console.log(`[Spotify Episode] Checking: "${video.title}" - matched ${matchedWords.length}/${titleWords.length} words`);
        
        if (matchedWords.length >= minMatchRequired && video.videoId) {
          console.log(`[Spotify Episode] ✅ YouTube match found: ${video.videoId} (confidence: ${matchedWords.length}/${titleWords.length})`);
          return video.videoId;
        }
      }
      
      console.log(`[Spotify Episode] No confident match from ${instance}`);
      return null; // Results found but no confident match
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.log(`[Spotify Episode] Invidious ${instance} timeout (5s)`);
      } else {
        console.log(`[Spotify Episode] Invidious ${instance} error:`, error.message);
      }
      continue;
    }
  }
  
  console.log('[Spotify Episode] All Invidious instances failed');
  return null;
}

/**
 * Fetch YouTube transcript via internal transcribe-youtube edge function
 * Uses service_role key for server-to-server auth
 * @param youtubeId - YouTube video ID
 * @returns Transcript text or null
 */
async function fetchYouTubeTranscriptInternal(youtubeId: string): Promise<string | null> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[Spotify Episode] Missing SUPABASE env vars for transcript fetch');
    return null;
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
  
  try {
    console.log(`[Spotify Episode] 📜 Fetching YouTube transcript for: ${youtubeId}`);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-youtube`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ videoId: youtubeId }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`[Spotify Episode] YouTube transcript fetch failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.transcript) {
      console.log(`[Spotify Episode] ✅ YouTube transcript fetched: ${data.transcript.length} chars`);
      return data.transcript;
    }
    
    console.log('[Spotify Episode] No transcript available:', data.error || 'unknown');
    return null;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('[Spotify Episode] YouTube transcript fetch timeout (5s)');
    } else {
      console.error('[Spotify Episode] YouTube transcript fetch error:', error);
    }
    return null;
  }
}

async function fetchSpotifyAudioFeatures(trackId: string, accessToken: string): Promise<{
  energy: number;
  valence: number;
  tempo: number;
  danceability: number;
} | null> {
  try {
    console.log(`[Spotify] 🎨 Fetching audio features for: ${trackId}`);
    
    const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      console.error('[Spotify] ❌ Audio Features API request failed:', response.status);
      return null;
    }
    
    const features = await response.json();
    
    const audioFeatures = {
      energy: features.energy ?? 0.5,
      valence: features.valence ?? 0.5,
      tempo: features.tempo ?? 120,
      danceability: features.danceability ?? 0.5
    };
    
    console.log(`[Spotify] ✅ Audio Features: energy=${audioFeatures.energy.toFixed(2)}, valence=${audioFeatures.valence.toFixed(2)}, tempo=${Math.round(audioFeatures.tempo)}BPM`);
    
    return audioFeatures;
  } catch (error) {
    console.error('[Spotify] ❌ Error fetching audio features:', error);
    return null;
  }
}

// Fetch lyrics from our fetch-lyrics edge function (server-side only for Q/A)
async function fetchLyricsFromGeniusServerSide(artist: string, title: string): Promise<{ lyrics: string; source: string; geniusUrl: string } | null> {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Spotify] Missing SUPABASE env vars for lyrics fetch');
      return null;
    }
    
    console.log(`[Spotify] Fetching lyrics for: "${title}" by ${artist}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
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

async function fetchOpenGraphData(url: string): Promise<any> {
  console.log('[OpenGraph] Fetching metadata for:', url);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      redirect: 'follow'
    });
    
    if (!response.ok) {
      console.log('[OpenGraph] Fetch failed:', response.status, response.statusText);
      return null;
    }
    
    const html = await response.text();
    const ogData: Record<string, string> = {};
    
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
      platform: null
    };
  } catch (error) {
    console.error('[OpenGraph] Error:', error instanceof Error ? error.message : 'Unknown');
    return null;
  }
}

async function fetchSocialWithJina(url: string, platform: string) {
  try {
    console.log(`[Jina] Fetching ${platform} content via Jina AI Reader`);
    
    const jinaUrl = `https://r.jina.ai/${url}`;
    const JINA_API_KEY = Deno.env.get('JINA_API_KEY');
    
    // Build headers with optional auth
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Return-Format': 'json'
    };
    if (JINA_API_KEY) {
      headers['Authorization'] = `Bearer ${JINA_API_KEY}`;
      console.log(`[Jina] Using authenticated request for ${platform}`);
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
    
    const response = await fetch(jinaUrl, { headers, signal: controller.signal });
    clearTimeout(timeoutId);
    
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
    
    let author = data.author_name || data.author || '';
    let authorUsername = '';
    
    // LinkedIn-specific content cleaning
    let rawContent = data.content || '';
    
    if (platform === 'linkedin' && rawContent) {
      // Extract author from content patterns
      const authorMatch = rawContent.match(/(?:Posted by|By|Pubblicato da)\s+([^\n]+)/i);
      if (authorMatch) author = authorMatch[1].trim();
      
      // Remove LinkedIn noise markers
      const linkedInNoiseMarkers = [
        /Sign in to view more content/gi,
        /Join now to see who you already know/gi,
        /See who you know/gi,
        /Get the LinkedIn app/gi,
        /Download the app/gi,
        /Skip to main content/gi,
        /LinkedIn and 3rd parties use/gi,
        /Accept & Join LinkedIn/gi,
        /By clicking Continue/gi,
        /Like Comment Share/gi,
        /\d+ reactions?/gi,
        /\d+ comments?/gi,
        /View \d+ comments/gi,
        /Report this post/gi,
        /Copy link to post/gi,
        /Repost with your thoughts/gi,
        /More from this author/gi,
        /Welcome back/gi,
        /Don't miss out/gi,
        /LinkedIn Corporation ©/gi,
        /\[Image[^\]]*\]/gi,
        /!\[.*?\]\(.*?\)/gi // Markdown images
      ];
      
      for (const marker of linkedInNoiseMarkers) {
        rawContent = rawContent.replace(marker, '');
      }
      
      // Remove navigation noise at start
      rawContent = rawContent.replace(/^[\s\S]*?((?:About|Article|Post|Pubblicato|Posted)\s)/i, '$1');
      
      // Trim excessive whitespace
      rawContent = rawContent.replace(/\n{3,}/g, '\n\n').trim();
    } else if (platform === 'twitter' && rawContent) {
      const usernameMatch = rawContent.match(/@(\w+)/);
      if (usernameMatch) authorUsername = usernameMatch[1];
    }

    const cleanedContent = cleanReaderText(rawContent);
    
    // Quality check: reject if too short or looks like auth wall
    if (cleanedContent.length < 100 || isLinkedInAuthWallContent(cleanedContent)) {
      console.log(`[Jina] ⚠️ ${platform} content rejected: too short or auth wall (${cleanedContent.length} chars)`);
      return null;
    }
    
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
      contentQuality: cleanedContent.length > 300 ? 'complete' : 'partial'
    };
  } catch (error) {
    console.error(`[Jina] Error for ${platform}:`, error);
    return null;
  }
}

// ============================================================================
// SERVER-SIDE CONTENT CACHING - v3: Added popularity for Spotify PULSE badge
// ============================================================================
async function cacheContentServerSide(
  supabase: any,
  sourceUrl: string,
  sourceType: string,
  contentText: string,
  title?: string,
  imageUrl?: string,
  popularity?: number // NEW: For Spotify PULSE badge
): Promise<void> {
  if (!contentText || contentText.length < 50) {
    console.log(`[Cache] Skipping cache for ${sourceUrl}: content too short`);
    return;
  }
  
  try {
    const expiresAt = new Date();
    // Short TTL (15 min) if image is missing, so we can retry extraction
    // Long TTL (7 days) if image is present
    if (imageUrl && imageUrl.length > 5) {
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days TTL
    } else {
      expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 min TTL for retry
      console.log(`[Cache] ⚠️ Missing image for ${sourceUrl}, using short TTL`);
    }
    
    // Normalize URL for consistent cache key
    const normalizedUrl = safeNormalizeUrl(sourceUrl);
    
    // Extract hostname for quick display
    let metaHostname = '';
    try {
      metaHostname = new URL(sourceUrl).hostname.replace(/^www\./, '');
    } catch {}
    
    const upsertData: any = {
      source_url: normalizedUrl,
      source_type: sourceType,
      content_text: contentText,
      title: title || null,
      meta_image_url: imageUrl || null,
      meta_hostname: metaHostname || null,
      expires_at: expiresAt.toISOString()
    };
    
    // Add popularity for Spotify (PULSE badge)
    if (typeof popularity === 'number') {
      upsertData.popularity = popularity;
      console.log(`[Cache] 🎵 Including Spotify popularity: ${popularity}`);
    }
    
    const { error } = await supabase
      .from('content_cache')
      .upsert(upsertData, {
        onConflict: 'source_url'
      });
    
    if (error) {
      console.error(`[Cache] Failed to cache content for ${normalizedUrl}:`, error.message);
    } else {
      console.log(`[Cache] ✅ Cached ${contentText.length} chars for ${normalizedUrl} (img: ${!!imageUrl}, popularity: ${popularity ?? 'N/A'})`);
    }
  } catch (err) {
    console.error(`[Cache] Exception caching content:`, err);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let url = '';
  
  try {
    const body = await req.json();
    url = body.url;

    // SSRF Protection: Validate URL before processing
    const urlValidation = isValidExternalUrl(url);
    if (!urlValidation.valid) {
      console.warn(`[Security] SSRF blocked: ${urlValidation.reason} - URL: ${url?.substring(0, 100)}`);
      return new Response(
        JSON.stringify({ error: urlValidation.reason || 'Invalid URL' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const urlLower = url.toLowerCase();
    const hostname = new URL(url).hostname.toLowerCase();

    // Initialize Supabase client for caching
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    let supabase: any = null;
    
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    }

    // ========================================================================
    // CACHE-FIRST: Check if we have cached metadata before any external fetch
    // ========================================================================
    if (supabase) {
      const normalizedUrl = safeNormalizeUrl(url);
      console.log(`[Cache] Checking cache for: ${normalizedUrl}`);
      
      const { data: cached, error: cacheErr } = await supabase
        .from('content_cache')
        .select('title, content_text, meta_image_url, source_type, meta_hostname, popularity')
        .eq('source_url', normalizedUrl)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      
      if (!cacheErr && cached && cached.title) {
        // NEW: Soft refresh for social platforms missing images
        const socialPlatformsNeedImage = ['linkedin', 'twitter', 'tiktok', 'threads'];
        const isSocialMissingImage = 
          socialPlatformsNeedImage.includes(cached.source_type) && 
          !cached.meta_image_url;
        
        if (isSocialMissingImage) {
          console.log(`[Cache] ⚠️ Social platform ${cached.source_type} missing image, forcing refresh for ${normalizedUrl}`);
          // DON'T return from cache - proceed to fetch fresh data below
        } else {
          console.log(`[Cache] ✅ HIT for ${normalizedUrl}: "${cached.title?.slice(0, 40)}..."`);
        
          // Determine platform from source_type
        const platformMap: Record<string, string> = {
          'youtube': 'youtube',
          'spotify': 'spotify',
          'twitter': 'twitter',
          'linkedin': 'linkedin',
          'tiktok': 'tiktok',
          'threads': 'threads',
          'article': 'generic',
        };
        const platform = platformMap[cached.source_type] || 'generic';
        
        // FIX: Determine correct qaSourceRef based on source_type for proper Gate handling
        let qaSourceRefKind: 'url' | 'spotifyId' | 'youtubeId' | 'tweetId' = 'url';
        let qaSourceRefId = url;
        
        if (cached.source_type === 'spotify') {
          qaSourceRefKind = 'spotifyId';
          // Extract Spotify ID from URL
          const spotifyMatch = url.match(/track\/([a-zA-Z0-9]+)/);
          qaSourceRefId = spotifyMatch ? spotifyMatch[1] : url;
        } else if (cached.source_type === 'youtube') {
          qaSourceRefKind = 'youtubeId';
          // Extract YouTube ID
          const ytMatch = url.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/);
          qaSourceRefId = ytMatch ? ytMatch[1] : url;
        } else if (cached.source_type === 'twitter') {
          qaSourceRefKind = 'tweetId';
          const tweetMatch = url.match(/status\/(\d+)/);
          qaSourceRefId = tweetMatch ? tweetMatch[1] : url;
        }
        
        console.log(`[Cache] Platform-aware qaSourceRef: kind=${qaSourceRefKind}, id=${qaSourceRefId.substring(0, 30)}`);
        
        // Build response with popularity for Spotify PULSE badge
        const cacheResponse: any = {
          success: true,
          title: cached.title,
          summary: cached.content_text?.substring(0, 300) || '',
          image: cached.meta_image_url || '',
          previewImg: cached.meta_image_url || '',
          platform,
          type: cached.source_type === 'spotify' ? 'audio' : 'article',
          hostname: cached.meta_hostname || hostname,
          contentQuality: 'complete',
          fromCache: true,
          iframeAllowed: true,
          qaSourceRef: { kind: qaSourceRefKind, id: qaSourceRefId, url }
        };
        
        // FIX v3: Include popularity for Spotify PULSE badge from cache
        if (typeof cached.popularity === 'number') {
          cacheResponse.popularity = cached.popularity;
          console.log(`[Cache] 🎵 Returning cached popularity for PULSE: ${cached.popularity}`);
        }
        
        return new Response(JSON.stringify(cacheResponse), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        } // Close the else block for !isSocialMissingImage
      } else if (cacheErr) {
        console.log(`[Cache] Query error: ${cacheErr.message}`);
      } else {
        console.log(`[Cache] MISS for ${normalizedUrl}`);
      }
    }

    // Helper to detect generic/useless social titles
    const isGenericSocialTitle = (t?: string | null) => {
      const x = (t || '').toLowerCase();
      return !t || x.includes('post da instagram') || x.includes('post da facebook') || 
             x === 'instagram' || x === 'facebook' || x.includes('instagram photo') ||
             x.includes('instagram video') || x.length < 10;
    };

    // Instagram oEmbed API - official endpoint that works for public posts
    async function fetchInstagramOEmbed(igUrl: string) {
      try {
        const oembedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(igUrl)}`;
        console.log('[Preview] Trying Instagram oEmbed:', oembedUrl);
        const response = await fetch(oembedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          console.log('[Preview] Instagram oEmbed failed with status:', response.status);
          return null;
        }
        
        const data = await response.json();
        console.log('[Preview] Instagram oEmbed success:', { title: data.title, author: data.author_name, hasThumb: !!data.thumbnail_url });
        return {
          title: data.title || null,
          author: data.author_name || null,
          image: data.thumbnail_url || null,
          description: data.title || null
        };
      } catch (err) {
        console.log('[Preview] Instagram oEmbed error:', err);
        return null;
      }
    }

    // Unsupported platforms - try oEmbed first (for IG), then Jina, Firecrawl, OpenGraph
    if (
      hostname.includes('instagram.com') ||
      hostname.includes('facebook.com') ||
      hostname.includes('m.facebook.com') ||
      hostname.includes('fb.com') ||
      hostname.includes('fb.watch')
    ) {
      console.log('[Preview] ⛔ Unsupported platform - attempting enhanced metadata fetch:', { originalUrl: url, hostname });
      
      const platform = hostname.includes('instagram') ? 'instagram' : 'facebook';

      // Canonicalize IG/FB URLs (strip tracking params) to improve metadata fetch
      let canonicalUrl = url;
      try {
        const u = new URL(url);
        if (u.hostname.includes('instagram.com') || u.hostname.includes('facebook.com')) {
          canonicalUrl = `${u.origin}${u.pathname}`;
        }
      } catch {}
      
      // 0. TRY INSTAGRAM oEmbed FIRST (official API, most reliable)
      let oembedData: any = null;
      if (platform === 'instagram') {
        oembedData = await fetchInstagramOEmbed(canonicalUrl);
        
        // If oEmbed returned good data, return immediately
        if (oembedData?.title && !isGenericSocialTitle(oembedData.title)) {
          console.log('[Preview] ✅ Using Instagram oEmbed data');
          return new Response(
            JSON.stringify({
              success: true,
              gateBlocked: true,
              contentQuality: 'blocked',
              message: `Questa piattaforma (${hostname}) non supporta il gate di comprensione.`,
              hostname,
              originalUrl: url,
              platform,
              title: oembedData.title,
              image: oembedData.image,
              summary: oembedData.description,
              author: oembedData.author || 'Instagram',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // 1. Try Jina AI for Instagram/Facebook metadata
      let jinaData: any = null;
      try {
        jinaData = await fetchSocialWithJina(canonicalUrl, platform);
        console.log('[Preview] Jina result for blocked platform:', jinaData ? { title: jinaData.title, hasImage: !!jinaData.image } : 'null');
      } catch (err) {
        console.log('[Preview] Jina fetch failed for blocked platform:', err);
      }

      const hasGoodJinaData = jinaData?.title && !isGenericSocialTitle(jinaData.title) && jinaData.title.length > 20;
      
      // 2. If Jina failed, try Firecrawl as aggressive fallback
      let firecrawlData: any = null;
      if (!hasGoodJinaData) {
        const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
        if (FIRECRAWL_API_KEY) {
          try {
            console.log('[Preview] Trying Firecrawl for blocked platform...');
            const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
              },
              body: JSON.stringify({
                url: canonicalUrl,
                formats: ['markdown', 'html'],
                onlyMainContent: false,
                waitFor: 2500
              })
            });
            
            const fcData = await fcResponse.json();
            const fcRoot = fcData?.data || fcData || {};
            const meta = fcRoot?.metadata || {};
            const markdown = fcRoot?.markdown as string | undefined;

            const deriveFromMarkdown = (md?: string) => {
              if (!md) return { title: null, description: null };
              const lines = md.split('\n').map(l => l.trim()).filter(Boolean);
              const first = lines[0] || '';
              const title = first.length >= 12 ? first.slice(0, 140) : null;
              const description = (lines[1] && lines[1].length >= 20) ? lines[1].slice(0, 220) : null;
              return { title, description };
            };

            const mdDerived = deriveFromMarkdown(markdown);

            console.log('[Preview] Firecrawl response for blocked platform:', {
              success: fcData?.success,
              hasMetadata: !!meta && Object.keys(meta).length > 0,
              title: meta?.title || meta?.ogTitle || mdDerived.title || null
            });
            
            if (fcData?.success) {
              const fcTitle = meta.title || meta.ogTitle || mdDerived.title || null;
              const fcDesc = meta.description || meta.ogDescription || mdDerived.description || null;
              firecrawlData = {
                title: isGenericSocialTitle(fcTitle) ? null : fcTitle,
                image: meta.ogImage || meta.image || null,
                description: fcDesc,
                author: meta.author || meta.ogSiteName || null
              };
            }
          } catch (fcErr) {
            console.log('[Preview] Firecrawl failed for blocked platform:', fcErr);
          }
        } else {
          console.log('[Preview] Firecrawl API key not configured, skipping');
        }
      }
      
      // 3. Fallback to OpenGraph if all else failed
      let ogData: any = null;
      if (!hasGoodJinaData && !firecrawlData?.title) {
        try {
          ogData = await fetchOpenGraphData(canonicalUrl);
          console.log('[Preview] OpenGraph result for blocked platform:', ogData ? { title: ogData.title, hasImage: !!ogData.image } : 'null');
        } catch (err) {
          console.log('[Preview] OpenGraph fetch failed for blocked platform:', err);
        }
      }
      
      // 4. Merge best available metadata
      const mergedData = {
        title: firecrawlData?.title || (isGenericSocialTitle(jinaData?.title) ? null : jinaData?.title) || (isGenericSocialTitle(ogData?.title) ? null : ogData?.title) || oembedData?.title || null,
        image: firecrawlData?.image || jinaData?.image || ogData?.image || oembedData?.image || null,
        description: firecrawlData?.description || jinaData?.summary || jinaData?.description || ogData?.description || oembedData?.description || null,
        author: firecrawlData?.author || jinaData?.author || ogData?.author || oembedData?.author || null
      };
      
      console.log('[Preview] Final merged metadata for blocked platform:', {
        hasTitle: !!mergedData.title,
        titleLength: mergedData.title?.length || 0,
        hasImage: !!mergedData.image,
        source: firecrawlData?.title ? 'firecrawl' : (jinaData?.title ? 'jina' : (ogData?.title ? 'opengraph' : (oembedData?.title ? 'oembed' : 'none')))
      });
      
      // Return success: true with gateBlocked flag and extracted metadata
      return new Response(
        JSON.stringify({
          success: true,
          gateBlocked: true,
          contentQuality: 'blocked',
          message: `Questa piattaforma (${hostname}) non supporta il gate di comprensione.`,
          hostname,
          originalUrl: url,
          platform,
          title: mergedData.title,
          image: mergedData.image,
          summary: mergedData.description,
          author: mergedData.author || (platform === 'instagram' ? 'Instagram' : 'Facebook'),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // YOUTUBE HANDLING - PARALLELIZED
    // ========================================================================
    const youtubeId = extractYouTubeId(url);
    if (youtubeId) {
      console.log('[fetch-article-preview] Detected YouTube video:', youtubeId);
      const ytStartTime = Date.now();
      
      try {
        // PARALLEL: oEmbed + transcript cache check
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`;
        
        const [oembedResult, cacheResult] = await Promise.allSettled([
          fetch(oembedUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; NoParrot/1.0)',
              'Accept': 'application/json'
            }
          }).then(async (res) => {
            if (res.ok) {
              return await res.json();
            }
            return null;
          }),
          supabase?.from('youtube_transcripts_cache')
            .select('transcript')
            .eq('video_id', youtubeId)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle() || Promise.resolve({ data: null })
        ]);
        
        // Extract oEmbed data
        let oembedData: { title?: string; thumbnail_url?: string; html?: string; author_name?: string; author_url?: string } | null = null;
        if (oembedResult.status === 'fulfilled' && oembedResult.value) {
          oembedData = oembedResult.value;
          console.log('[YouTube] ✅ oEmbed fetched:', oembedData?.title);
        } else {
          console.warn('[YouTube] ⚠️ oEmbed failed, using fallback');
        }
        
        // Extract cache result
        let transcriptStatus: 'cached' | 'pending' | 'unavailable' = 'pending';
        if (cacheResult.status === 'fulfilled' && cacheResult.value?.data?.transcript) {
          transcriptStatus = 'cached';
          console.log('[YouTube] ✅ CACHE HIT: transcript available for Q/A');
        } else {
          console.log('[YouTube] ⏳ CACHE MISS: transcript will be fetched for Q/A');
        }
        
        // Fallback: use YouTube thumbnail directly if oEmbed failed
        const title = oembedData?.title || `YouTube Video (${youtubeId})`;
        const thumbnail = oembedData?.thumbnail_url || `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
        const author = oembedData?.author_name || '';
        const authorUrl = oembedData?.author_url || '';
        
        const ytElapsed = Date.now() - ytStartTime;
        console.log(`[YouTube] ✅ Complete in ${ytElapsed}ms`);
        
        // SOURCE-FIRST: Return metadata only, NO transcript to client
        return new Response(JSON.stringify({
          success: true,
          title,
          // NO content/transcript to client - only short summary
          summary: title,
          image: thumbnail,
          platform: 'youtube',
          type: 'video',
          embedHtml: oembedData?.html || null,
          youtubeId,
          // NO transcript field - removed for copyright compliance
          transcriptStatus, // Just status for UI badge
          author,
          authorUrl,
          contentQuality: transcriptStatus === 'cached' ? 'complete' : 'partial',
          // Gate config for client (15s timer, iOS-compatible)
          gateConfig: {
            mode: 'timer',
            minSeconds: 15
          },
          // QA source reference for generate-qa
          qaSourceRef: {
            kind: 'youtubeId',
            id: youtubeId
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('[fetch-article-preview] Error fetching YouTube data:', error);
        // Return graceful fallback instead of 500
        return new Response(JSON.stringify({
          success: true,
          title: `YouTube Video (${youtubeId})`,
          summary: `YouTube Video`,
          image: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
          platform: 'youtube',
          type: 'video',
          youtubeId,
          transcriptStatus: 'unavailable',
          contentQuality: 'partial',
          gateConfig: { mode: 'timer', minSeconds: 15 },
          qaSourceRef: { kind: 'youtubeId', id: youtubeId }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ========================================================================
    // SPOTIFY HANDLING - PARALLELIZED FOR SPEED
    // ========================================================================
    const spotifyInfo = extractSpotifyInfo(url);
    if (spotifyInfo) {
      console.log(`[fetch-article-preview] Detected Spotify ${spotifyInfo.type}: ${spotifyInfo.id}`);
      const spotifyStartTime = Date.now();
      
      try {
        // STEP 1: oEmbed (always needed, quick)
        const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
        const oembedResponse = await fetch(oembedUrl);
        
        if (!oembedResponse.ok) {
          throw new Error(`Spotify oEmbed failed: ${oembedResponse.status}`);
        }
        
        const oembedData = await oembedResponse.json();
        
        let artist = '';
        let trackTitle = oembedData.title || '';
        let trackPopularity: number | undefined;
        let audioFeatures: { energy: number; valence: number; tempo: number; danceability: number } | undefined;
        let lyricsAvailable = false;
        let geniusUrl = '';
        
        // STEP 2: PARALLEL execution for track metadata
        if (spotifyInfo.type === 'track') {
          const accessToken = await getSpotifyAccessToken();
          
          if (accessToken) {
            // PARALLEL: metadata + features + lyrics all at once!
            const [metadataResult, featuresResult, lyricsResult] = await Promise.allSettled([
              fetchSpotifyTrackMetadata(spotifyInfo.id, accessToken),
              fetchSpotifyAudioFeatures(spotifyInfo.id, accessToken),
              // Use oEmbed data for initial lyrics search (faster than waiting for metadata)
              fetchLyricsFromGeniusServerSide(
                oembedData.author_name || '', 
                oembedData.title || ''
              )
            ]);
            
            // Extract metadata
            if (metadataResult.status === 'fulfilled' && metadataResult.value) {
              artist = metadataResult.value.artist;
              trackTitle = metadataResult.value.title;
              trackPopularity = metadataResult.value.popularity;
              console.log(`[Spotify] ✅ WEB API: "${trackTitle}" by "${artist}" (PULSE: ${trackPopularity})`);
            }
            
            // Extract audio features
            if (featuresResult.status === 'fulfilled' && featuresResult.value) {
              audioFeatures = featuresResult.value;
            }
            
            // Process lyrics result
            const lyricsData = lyricsResult.status === 'fulfilled' ? lyricsResult.value : null;
            
            if (lyricsData?.lyrics && supabase) {
              lyricsAvailable = true;
              geniusUrl = lyricsData.geniusUrl || '';
              
              // Cache lyrics for Q/A generation (include thumbnail for preview + popularity for PULSE)
              await cacheContentServerSide(
                supabase,
                url,
                'spotify',
                lyricsData.lyrics,
                `${trackTitle} - ${artist}`,
                oembedData.thumbnail_url || '',
                trackPopularity // NEW: Pass popularity for PULSE badge cache
              );
            } else if (supabase) {
              // NEGATIVE CACHE: Save that lyrics are unavailable
              // This prevents infinite retry loops - BUT still save image + popularity for PULSE!
              const negativeExpiry = new Date();
              negativeExpiry.setMinutes(negativeExpiry.getMinutes() + 30); // 30 min TTL
              
              const normalizedUrl = safeNormalizeUrl(url);
              const synthetic = (() => {
                const base = [
                  `Brano Spotify: ${trackTitle || 'Titolo non disponibile'} di ${artist || 'Artista non disponibile'}.`,
                  typeof trackPopularity === 'number' ? `Popolarità (Spotify): ${trackPopularity}/100.` : null,
                  `Nota: il testo completo (lyrics) non è disponibile dai provider in questo momento.`,
                  `Per il quiz usiamo metadati e contesto (titolo, artista, popolarità, e segnali di piattaforma) per generare domande più specifiche sul brano.`
                ].filter(Boolean).join(' ');

                // Ensure we always cross the 300-char quality threshold used in generate-qa
                if (base.length >= 320) return base;
                return (
                  base +
                  ' ' +
                  `Contesto aggiuntivo: questo contenuto è una traccia musicale pubblicata su Spotify; le domande dovrebbero concentrarsi su identificazione del brano, autore, e segnali disponibili (come la popolarità) evitando domande generiche senza riferimenti. ` +
                  `Se vuoi più precisione, puoi condividere anche una fonte testuale (intervista/recensione/lyrics) oltre al link Spotify.`
                );
              })();

              const negativeData: any = {
                source_url: normalizedUrl,
                source_type: 'spotify',
                // IMPORTANT: even when lyrics are unavailable, store a rich synthetic text
                // so generate-qa can produce non-generic questions.
                content_text: synthetic,
                title: `${trackTitle} - ${artist}`,
                meta_image_url: oembedData.thumbnail_url || null,
                meta_hostname: 'open.spotify.com',
                expires_at: negativeExpiry.toISOString()
              };
              
              // Still save popularity even when lyrics unavailable (for PULSE badge)
              if (typeof trackPopularity === 'number') {
                negativeData.popularity = trackPopularity;
                console.log(`[Spotify] Including popularity in negative cache: ${trackPopularity}`);
              }
              
              await supabase.from('content_cache').upsert(negativeData, { onConflict: 'source_url' });
              
              console.log('[Spotify] Negative cache set: lyrics unavailable');
            }
          }
        }
        
        // Fallbacks for artist name
        if (!artist && oembedData.author_name && oembedData.author_name !== 'Spotify') {
          artist = oembedData.author_name.trim();
          trackTitle = oembedData.title || '';
        }
        
        if (!artist) {
          const titleMatch = oembedData.title?.match(/^(.+?)\s*[-–—]\s*(.+)$/);
          if (titleMatch) {
            trackTitle = titleMatch[1].trim();
            artist = titleMatch[2].trim();
          }
        }
        
        const spotifyElapsed = Date.now() - spotifyStartTime;
        console.log(`[Spotify] ✅ Complete processing in ${spotifyElapsed}ms (lyrics: ${lyricsAvailable})`);
        
        // SOURCE-FIRST: Return metadata only, NO lyrics to client
        return new Response(JSON.stringify({
          success: true,
          title: oembedData.title || `Spotify ${spotifyInfo.type}`,
          summary: oembedData.title,
          image: oembedData.thumbnail_url || '',
          previewImg: oembedData.thumbnail_url || '',
          platform: 'spotify',
          type: spotifyInfo.type,
          author: artist || oembedData.provider_name || 'Spotify',
          embedHtml: oembedData.html,
          lyricsAvailable,
          geniusUrl,
          contentQuality: lyricsAvailable ? 'complete' : 'partial',
          hostname: 'open.spotify.com',
          popularity: trackPopularity,
          audioFeatures,
          elapsedMs: spotifyElapsed,
          gateConfig: {
            mode: 'timer',
            minSeconds: 15
          },
          qaSourceRef: {
            kind: 'spotifyId',
            id: spotifyInfo.id
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('[Spotify] Error:', error);
        
        return new Response(JSON.stringify({
          success: true,
          title: `Contenuto Spotify`,
          summary: 'Contenuto Spotify',
          platform: 'spotify',
          type: spotifyInfo.type,
          hostname: 'open.spotify.com',
          contentQuality: 'minimal',
          gateConfig: { mode: 'timer', minSeconds: 15 },
          qaSourceRef: { kind: 'spotifyId', id: spotifyInfo.id }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    // ========================================================================
    // SPOTIFY EPISODE HANDLING - YOUTUBE FALLBACK
    // ========================================================================
    // SAFETY: This block is ONLY for episodes, tracks are handled above
    else if (spotifyInfo.type === 'episode') {
      console.log(`[Spotify Episode] Processing episode: ${spotifyInfo.id}`);
      const episodeStartTime = Date.now();
      
      try {
        // 1. Get Spotify access token
        const accessToken = await getSpotifyAccessToken();
        if (!accessToken) {
          console.log('[Spotify Episode] No access token, returning minimal response');
          return new Response(JSON.stringify({
            success: true,
            title: 'Episodio Spotify',
            platform: 'spotify',
            type: 'episode',
            hostname: 'open.spotify.com',
            contentQuality: 'minimal',
            gateConfig: { mode: 'timer', minSeconds: 30 },
            qaSourceRef: { kind: 'spotifyId', id: spotifyInfo.id }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // 2. Fetch episode metadata from Spotify API
        console.log('[Spotify Episode] Fetching episode metadata...');
        const episodeResponse = await fetch(`https://api.spotify.com/v1/episodes/${spotifyInfo.id}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        let episodeTitle = 'Episodio Podcast';
        let showName = '';
        let episodeImage = '';
        let showDescription = '';
        
        if (episodeResponse.ok) {
          const episodeData = await episodeResponse.json();
          episodeTitle = episodeData.name || 'Episodio Podcast';
          showName = episodeData.show?.name || '';
          episodeImage = episodeData.images?.[0]?.url || episodeData.show?.images?.[0]?.url || '';
          showDescription = episodeData.description || '';
          console.log(`[Spotify Episode] ✅ Metadata: "${episodeTitle}" from "${showName}"`);
        } else {
          console.log(`[Spotify Episode] Episode API failed: ${episodeResponse.status}`);
        }
        
        // 3. Search YouTube for matching video (with 5s timeout)
        let youtubeVideoId: string | null = null;
        let youtubeTranscript: string | null = null;
        let youtubeFallback = false;
        let youtubeFallbackMessage = '';
        
        if (showName && episodeTitle) {
          youtubeVideoId = await searchYouTubeForPodcast(showName, episodeTitle);
          
          if (youtubeVideoId) {
            // 4. Fetch transcript from YouTube (with 5s timeout)
            youtubeTranscript = await fetchYouTubeTranscriptInternal(youtubeVideoId);
            
            if (youtubeTranscript && youtubeTranscript.length > 200) {
              youtubeFallback = true;
              youtubeFallbackMessage = `Trascrizione recuperata da YouTube`;
              console.log(`[Spotify Episode] ✅ YouTube fallback successful: ${youtubeTranscript.length} chars`);
              
              // 5. Cache the transcript with spotify_episode_yt source type
              if (supabase) {
                const cacheExpiry = new Date();
                cacheExpiry.setDate(cacheExpiry.getDate() + 7); // 7 days cache
                
                await supabase.from('content_cache').upsert({
                  source_url: normalizedUrl,
                  source_type: 'spotify_episode_yt',
                  content_text: youtubeTranscript,
                  title: `${showName}: ${episodeTitle}`,
                  meta_image_url: episodeImage,
                  meta_hostname: 'open.spotify.com',
                  expires_at: cacheExpiry.toISOString()
                }, { onConflict: 'source_url' });
                
                console.log('[Spotify Episode] Cached YouTube transcript in content_cache');
              }
            } else {
              console.log('[Spotify Episode] YouTube transcript too short or unavailable');
            }
          }
        }
        
        const episodeElapsed = Date.now() - episodeStartTime;
        console.log(`[Spotify Episode] ✅ Complete in ${episodeElapsed}ms (YouTube fallback: ${youtubeFallback})`);
        
        // Return response with YouTube fallback info
        return new Response(JSON.stringify({
          success: true,
          title: showName ? `${showName}: ${episodeTitle}` : episodeTitle,
          summary: showDescription.slice(0, 200) || episodeTitle,
          image: episodeImage,
          previewImg: episodeImage,
          platform: 'spotify',
          type: 'episode',
          author: showName || 'Spotify Podcast',
          hostname: 'open.spotify.com',
          contentQuality: youtubeFallback ? 'complete' : 'minimal',
          elapsedMs: episodeElapsed,
          // YouTube fallback info for UI
          youtubeFallback,
          youtubeFallbackMessage,
          youtubeVideoId,
          // Gate config - timer for minimal, quiz for complete
          gateConfig: youtubeFallback
            ? { mode: 'quiz', minQuestions: 3 }
            : { mode: 'timer', minSeconds: 30 },
          // QA source reference - point to YouTube if transcript available
          qaSourceRef: youtubeFallback && youtubeVideoId
            ? { kind: 'youtubeId', id: youtubeVideoId, url }
            : { kind: 'spotifyId', id: spotifyInfo.id }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        console.error('[Spotify Episode] Error:', error);
        
        return new Response(JSON.stringify({
          success: true,
          title: 'Episodio Spotify',
          platform: 'spotify',
          type: 'episode',
          hostname: 'open.spotify.com',
          contentQuality: 'minimal',
          gateConfig: { mode: 'timer', minSeconds: 30 },
          qaSourceRef: { kind: 'spotifyId', id: spotifyInfo.id }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ========================================================================
    // TWITTER/X HANDLING
    // ========================================================================
    const socialPlatform = detectSocialPlatform(url);
    if (socialPlatform === 'twitter') {
      console.log(`[fetch-article-preview] Detected Twitter/X link`);
      
      // Extract tweet ID for qaSourceRef
      const tweetIdMatch = url.match(/status\/(\d+)/);
      const tweetId = tweetIdMatch ? tweetIdMatch[1] : null;
      
      // Try vxTwitter API first
      let tweetData: any = null;
      try {
        const vxUrl = url.replace(/twitter\.com|x\.com/, 'api.vxtwitter.com');
        const vxResponse = await fetch(vxUrl, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (vxResponse.ok) {
          tweetData = await vxResponse.json();
          console.log('[Twitter] ✅ vxTwitter API success');
        }
      } catch (e) {
        console.log('[Twitter] vxTwitter failed, trying fallbacks');
      }
      
      // Fallback to Jina
      if (!tweetData) {
        const jinaResult = await fetchSocialWithJina(url, 'twitter');
        if (jinaResult) {
          tweetData = {
            text: jinaResult.content,
            user_name: jinaResult.author,
            user_screen_name: jinaResult.author_username
          };
        }
      }
      
      // Cache content server-side for Q/A (include image)
      if (tweetData?.text && supabase) {
        await cacheContentServerSide(
          supabase,
          url,
          'twitter',
          tweetData.text,
          tweetData.user_name,
          tweetData?.media?.photos?.[0]?.url || ''
        );
      }
      
      // SOURCE-FIRST: Return only metadata, NOT full tweet text
      return new Response(JSON.stringify({
        success: true,
        title: tweetData?.user_name ? `Post di ${tweetData.user_name}` : 'Tweet',
        // NO full content to client - just short preview
        summary: tweetData?.text?.substring(0, 150) || 'Tweet',
        image: tweetData?.media?.photos?.[0]?.url || '',
        previewImg: tweetData?.media?.photos?.[0]?.url || '',
        platform: 'twitter',
        type: 'social',
        author: tweetData?.user_name || '',
        author_username: tweetData?.user_screen_name || '',
        author_avatar: tweetData?.user_profile_image_url || '',
        verified: tweetData?.user_verified || false,
        hostname: 'twitter.com',
        contentQuality: tweetData?.text ? 'complete' : 'partial',
        // Gate config
        gateConfig: {
          mode: 'timer',
          minSeconds: 10
        },
        // QA source reference
        qaSourceRef: tweetId ? {
          kind: 'tweetId',
          id: tweetId
        } : {
          kind: 'url',
          id: url,
          url
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // ========================================================================
    // TIKTOK, LINKEDIN, THREADS HANDLING - WITH RACING FOR LINKEDIN
    // ========================================================================
    if (socialPlatform) {
      console.log(`[fetch-article-preview] Detected ${socialPlatform} link`);
      const socialStartTime = Date.now();
      
      let jinaResult: any = null;
      let contentSource = 'none';
      
      // For LinkedIn: RACE between Jina and Firecrawl for speed
      if (socialPlatform === 'linkedin') {
        const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
        
        // Build racing promises
        const racingPromises: Promise<{ result: any; source: string } | null>[] = [
          // Jina attempt
          fetchSocialWithJina(url, 'linkedin').then(res => {
            if (res?.content && res.content.length > 300 && 
                !isLinkedInAuthWallContent(res.content) && 
                !isBotChallengeContent(res.content)) {
              console.log(`[Race] 🏆 Jina WINNER for LinkedIn: ${res.content.length} chars`);
              return { result: res, source: 'jina' };
            }
            throw new Error('Jina insufficient');
          }),
          // Firecrawl attempt (if available)
          ...(FIRECRAWL_API_KEY ? [
            fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
              },
              body: JSON.stringify({
                url,
                formats: ['markdown'],
                onlyMainContent: true,
                waitFor: 1500
              })
            }).then(async (res) => {
              if (!res.ok) throw new Error(`Firecrawl ${res.status}`);
              const data = await res.json();
              const rawMarkdown = data.data?.markdown || data.markdown || '';
              const cleanedContent = extractTextFromHtml(rawMarkdown);
              
              // HARDENED: Higher threshold (400) + validation against auth walls and truncation
              const isValidContent = 
                data.success && 
                cleanedContent.length > 400 &&
                !isLinkedInAuthWallContent(cleanedContent) &&
                !isBotChallengeContent(cleanedContent) &&
                !isLinkedInTruncated(cleanedContent);
              
              if (isValidContent) {
                console.log(`[Race] 🏆 Firecrawl WINNER for LinkedIn: ${cleanedContent.length} chars (validated)`);
                return {
                  result: {
                    title: data.data?.metadata?.title || data.metadata?.title || 'Post LinkedIn',
                    content: cleanedContent,
                    summary: data.data?.metadata?.description || data.metadata?.description || '',
                    image: data.data?.metadata?.ogImage || data.metadata?.ogImage || '',
                    previewImg: data.data?.metadata?.ogImage || data.metadata?.ogImage || '',
                    platform: 'linkedin',
                    type: 'social',
                    author: data.data?.metadata?.author || data.metadata?.author || '',
                    hostname: 'linkedin.com',
                    contentQuality: 'complete'
                  },
                  source: 'firecrawl'
                };
              }
              console.log(`[Race] ⚠️ Firecrawl rejected: ${cleanedContent.length} chars, truncated=${isLinkedInTruncated(cleanedContent)}, authWall=${isLinkedInAuthWallContent(cleanedContent)}`);
              throw new Error('Firecrawl insufficient or truncated');
            })
          ] : [])
        ];
        
        try {
          // Promise.any: first valid result wins
          const winner = await Promise.any(racingPromises);
          if (winner) {
            jinaResult = winner.result;
            contentSource = winner.source;
          }
        } catch {
          console.log('[LinkedIn] All racing providers failed, trying OG fallback...');
        }
      } else {
        // For TikTok/Threads: just use Jina
        jinaResult = await fetchSocialWithJina(url, socialPlatform);
        contentSource = jinaResult ? 'jina' : 'none';
      }
      
      // LinkedIn fallback to direct OpenGraph if racing failed
      if (socialPlatform === 'linkedin' && (!jinaResult?.content || jinaResult.content.length < 100)) {
        console.log('[LinkedIn] Racing failed, trying direct OpenGraph extraction...');
          try {
            const ogResponse = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
              },
              redirect: 'follow'
            });
            
            if (ogResponse.ok) {
              const html = await ogResponse.text();
              
              // Extract OG data
              const getOg = (prop: string): string => {
                const m = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
                          html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'));
                return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : '';
              };
              
              const ogTitle = getOg('title');
              const ogDescription = getOg('description');
              const ogImage = getOg('image');
              
              // Try to extract post text from the page - LinkedIn sometimes includes it in JSON-LD or hidden elements
              let postText = ogDescription || '';
              
              // Look for JSON-LD with the actual post content
              const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
              if (jsonLdMatch) {
                for (const match of jsonLdMatch) {
                  try {
                    const jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
                    const parsed = JSON.parse(jsonContent);
                    const items = Array.isArray(parsed) ? parsed : [parsed];
                    for (const item of items) {
                      if (item.articleBody && item.articleBody.length > postText.length) {
                        postText = item.articleBody;
                        console.log('[LinkedIn] Found articleBody in JSON-LD:', postText.length, 'chars');
                      }
                      if (item.text && item.text.length > postText.length) {
                        postText = item.text;
                      }
                    }
                  } catch (e) {
                    // JSON parse error, continue
                  }
                }
              }
              
              // Attempt to extract author name from title format "Post di [Name] | LinkedIn" or "[Name] su LinkedIn"
              let authorName = '';
              const authorMatch = ogTitle.match(/(?:Post di|Post by)\s+([^|–\-]+)/i) ||
                                  ogTitle.match(/^([^|–\-]+?)\s+su\s+LinkedIn/i) ||
                                  ogTitle.match(/^([^|–\-]+?)\s*[|–\-]\s*LinkedIn/i);
              if (authorMatch) {
                authorName = authorMatch[1].trim();
                // If it looks like a post title rather than a name (too long), clear it
                if (authorName.length > 50) {
                  authorName = '';
                }
              }
              
              // Also try to extract from JSON-LD author field
              if (!authorName && jsonLdMatch) {
                for (const match of jsonLdMatch) {
                  try {
                    const jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
                    const parsed = JSON.parse(jsonContent);
                    const items = Array.isArray(parsed) ? parsed : [parsed];
                    for (const item of items) {
                      if (item.author?.name) {
                        authorName = item.author.name;
                        break;
                      }
                      if (typeof item.author === 'string') {
                        authorName = item.author;
                        break;
                      }
                    }
                    if (authorName) break;
                  } catch (e) {}
                }
              }
              
              if (ogTitle || ogDescription) {
                console.log(`[LinkedIn] ✅ OpenGraph extraction:`, {
                  title: ogTitle?.slice(0, 50),
                  description: ogDescription?.slice(0, 100),
                  hasImage: !!ogImage,
                  postTextLen: postText.length,
                  author: authorName
                });
                
                contentSource = 'opengraph';
                jinaResult = {
                  title: ogTitle || 'Post LinkedIn',
                  content: postText || ogDescription || '',
                  summary: ogDescription || '',
                  image: ogImage || '',
                  previewImg: ogImage || '',
                  platform: 'linkedin',
                  type: 'social',
                  author: authorName,
                  hostname: 'linkedin.com',
                  contentQuality: postText.length > 200 ? 'complete' : (postText.length > 50 ? 'partial' : 'minimal')
                };
              } else {
                console.log('[LinkedIn] ⚠️ No OG tags found in page');
              }
            } else {
              console.log('[LinkedIn] ⚠️ OpenGraph fetch failed:', ogResponse.status);
            }
          } catch (ogError) {
            console.error('[LinkedIn] OpenGraph extraction error:', ogError);
          }
        }

      // Cache content server-side (including image for LinkedIn/TikTok/Threads)
      if (jinaResult?.content && jinaResult.content.length > 50 && supabase) {
        await cacheContentServerSide(
          supabase,
          url,
          socialPlatform,
          jinaResult.content,
          jinaResult.title,
          jinaResult.image || jinaResult.previewImg // Fix: save image to cache
        );
        console.log(`[${socialPlatform}] ✅ Cached ${jinaResult.content.length} chars via ${contentSource}, image: ${jinaResult.image ? 'yes' : 'no'}`);
      }
      
      const hasContent = jinaResult?.content && jinaResult.content.length > 50;
      
      // SOURCE-FIRST: Return only metadata
      return new Response(JSON.stringify({ 
        success: true, 
        title: jinaResult?.title || `Post da ${socialPlatform}`,
        // NO full content to client
        summary: jinaResult?.content?.substring(0, 150) || '',
        image: jinaResult?.image || '',
        previewImg: jinaResult?.image || '',
        platform: socialPlatform,
        type: 'social',
        author: jinaResult?.author || '',
        hostname: new URL(url).hostname,
        contentQuality: hasContent ? 'complete' : (jinaResult ? 'partial' : 'blocked'),
        contentSource, // Track extraction method
        // Gate config
        gateConfig: {
          mode: 'timer',
          minSeconds: 10
        },
        // QA source reference
        qaSourceRef: {
          kind: 'url',
          id: url,
          url
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // GENERIC ARTICLE HANDLING
    // ========================================================================
    console.log('[fetch-article-preview] Processing generic URL:', url);
    
    const urlHostname = new URL(url).hostname;
    
    // Check for known anti-bot domains that need special handling
    const isFirecrawlDomain = 
      urlHostname.includes('hdblog') || 
      urlHostname.includes('hdmotori') ||
      urlHostname.includes('threads.net') ||
      urlHostname.includes('ilpost.it');
    
    // Try Firecrawl for problematic domains
    if (isFirecrawlDomain) {
      const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
      
      if (FIRECRAWL_API_KEY) {
        try {
          console.log(`[Preview] 🔥 Using Firecrawl for ${urlHostname}...`);
          const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
            },
            body: JSON.stringify({
              url,
              formats: ['markdown'],
              onlyMainContent: true,
              timeout: 15000
            })
          });
          
          if (fcResponse.ok) {
            const fcData = await fcResponse.json();
            if (fcData.success && fcData.data?.markdown && fcData.data.markdown.length > 100) {
              console.log(`[Preview] ✅ Firecrawl success: ${fcData.data.markdown.length} chars`);
              
              // Cache content server-side (include image)
              if (supabase) {
                await cacheContentServerSide(
                  supabase,
                  url,
                  'article',
                  fcData.data.markdown,
                  fcData.data.metadata?.title,
                  fcData.data.metadata?.ogImage || ''
                );
              }
              
              // SOURCE-FIRST: Return only metadata
              return new Response(JSON.stringify({
                success: true,
                title: fcData.data.metadata?.title || 'Articolo',
                summary: fcData.data.metadata?.description || '',
                // NO full content to client
                image: fcData.data.metadata?.ogImage || '',
                previewImg: fcData.data.metadata?.ogImage || '',
                platform: 'generic',
                type: 'article',
                hostname: urlHostname,
                contentQuality: 'complete',
                iframeAllowed: true,
                gateConfig: { mode: 'timer', minSeconds: 15 },
                qaSourceRef: { kind: 'url', id: url, url }
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
        } catch (fcError) {
          console.error('[Preview] Firecrawl error:', fcError);
        }
      }
    }
    
    // Try Jina AI Reader
    console.log(`[Preview] 🤖 Trying Jina AI Reader for ${urlHostname}...`);
    const jinaUrl = `https://r.jina.ai/${url}`;
    
    try {
      const jinaResponse = await fetch(jinaUrl, {
        headers: {
          'Accept': 'application/json',
          'X-Return-Format': 'json'
        }
      });
      
      if (jinaResponse.ok) {
        const jinaData = await jinaResponse.json();
        
        if (jinaData.content && jinaData.content.length > 100 && !isBotChallengeContent(jinaData.content)) {
          console.log(`[Preview] ✅ Jina success: ${jinaData.content.length} chars`);
          
          const cleanedContent = cleanReaderText(jinaData.content);
          
          // Cache content server-side (include image)
          if (supabase) {
            await cacheContentServerSide(
              supabase,
              url,
              'article',
              cleanedContent,
              jinaData.title,
              jinaData.image || ''
            );
          }
          
          // SOURCE-FIRST: Return only metadata
          return new Response(JSON.stringify({
            success: true,
            title: jinaData.title || 'Articolo',
            summary: jinaData.description || cleanedContent.substring(0, 200),
            // NO full content to client
            image: jinaData.image || '',
            previewImg: jinaData.image || '',
            platform: 'generic',
            type: 'article',
            hostname: urlHostname,
            author: jinaData.author || '',
            contentQuality: cleanedContent.length > 500 ? 'complete' : 'partial',
            iframeAllowed: true,
            gateConfig: { mode: 'timer', minSeconds: 15 },
            qaSourceRef: { kind: 'url', id: url, url }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    } catch (jinaError) {
      console.error('[Preview] Jina error:', jinaError);
    }
    
    // Direct fetch as fallback
    console.log(`[Preview] 📡 Trying direct fetch for ${urlHostname}...`);
    
    let html = '';
    let fetchSuccess = false;
    
    try {
      const directResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        }
      });
      
      if (directResponse.ok) {
        html = await directResponse.text();
        fetchSuccess = true;
        console.log(`[Preview] ✅ Direct fetch: ${html.length} chars`);
      }
    } catch (fetchError) {
      console.error('[Preview] Direct fetch failed:', fetchError);
    }
    
    // Check for bot challenge
    if (fetchSuccess && isBotChallengeContent(html)) {
      console.log(`[Preview] 🚫 Bot challenge detected for ${urlHostname}`);
      
      const blockedTitleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      let blockedTitle = blockedTitleMatch ? extractTextFromHtml(blockedTitleMatch[1]) : '';
      const blockedDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
      const blockedDescription = blockedDescMatch ? extractTextFromHtml(blockedDescMatch[1]) : '';
      const blockedImgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      const blockedImage = blockedImgMatch ? blockedImgMatch[1] : '';
      
      if (!blockedTitle || blockedTitle.toLowerCase().includes('cloudflare')) {
        blockedTitle = urlHostname.replace('www.', '').split('.')[0];
        blockedTitle = blockedTitle.charAt(0).toUpperCase() + blockedTitle.slice(1);
      }
      
      return new Response(JSON.stringify({
        success: true,
        title: blockedTitle,
        summary: blockedDescription || 'Questo sito blocca la lettura automatica.',
        image: blockedImage,
        previewImg: blockedImage,
        platform: 'generic',
        type: 'article',
        hostname: urlHostname,
        contentQuality: 'blocked',
        blockedBy: 'cloudflare',
        iframeAllowed: true, // Still allow iframe
        gateConfig: { mode: 'timer', minSeconds: 0 }, // Bypass gate for blocked
        qaSourceRef: { kind: 'url', id: url, url }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Extract metadata from HTML
    if (fetchSuccess && html.length > 1000) {
      const jsonLdData = extractJsonLdArticle(html);
      
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      let title = jsonLdData?.title || (titleMatch ? extractTextFromHtml(titleMatch[1]) : '');
      
      if (!title || title.length < 5) {
        const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
        if (ogTitleMatch) title = extractTextFromHtml(ogTitleMatch[1]);
      }
      
      const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
      const description = jsonLdData?.description || (descMatch ? extractTextFromHtml(descMatch[1]) : '');
      
      const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      let image = jsonLdData?.image || (imgMatch ? imgMatch[1] : '');
      
      if (!image) {
        image = extractFallbackImage(html, url);
      }
      
      // Extract article content for caching (not for client)
      let articleContent = '';
      
      if (jsonLdData?.content && jsonLdData.content.length > 200) {
        articleContent = cleanReaderText(jsonLdData.content);
      } else {
        // Extract paragraphs
        const paragraphs: string[] = [];
        const pRegex = /<p[^>]*>(.+?)<\/p>/gis;
        let match;
        
        while ((match = pRegex.exec(html)) !== null && paragraphs.length < 25) {
          const text = extractTextFromHtml(match[0]);
          if (text.length < 30) continue;
          
          const junkPatterns = [
            /^(home|newsletter|podcast|shop|regala|abbonati|privacy|cookie|menu|contatti)/i,
            /leggi anche/i,
            /potrebbe interessarti/i,
          ];
          
          if (junkPatterns.some(p => p.test(text))) continue;
          if ((text.match(/\|/g) || []).length >= 2) continue;
          
          paragraphs.push(text);
        }
        
        articleContent = paragraphs.join('\n\n');
      }
      
      // Cache content server-side (include image URL)
      if (articleContent && supabase) {
        await cacheContentServerSide(
          supabase,
          url,
          'article',
          articleContent,
          title,
          image
        );
      }
      
      const hasGoodContent = articleContent.length > 150 || (title && image);
      
      // SOURCE-FIRST: Return only metadata
      return new Response(JSON.stringify({ 
        success: true, 
        title: title || 'Articolo',
        summary: description || articleContent.substring(0, 200),
        // NO full content to client
        image,
        previewImg: image,
        platform: 'generic',
        type: 'article',
        hostname: urlHostname,
        author: jsonLdData?.author || '',
        contentQuality: articleContent.length > 500 ? 'complete' : 'partial',
        iframeAllowed: true,
        gateConfig: { mode: 'timer', minSeconds: 15 },
        qaSourceRef: { kind: 'url', id: url, url }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // OpenGraph fallback
    const ogData = await fetchOpenGraphData(url);
    if (ogData && (ogData.title || ogData.description || ogData.image)) {
      return new Response(JSON.stringify({
        success: true,
        title: ogData.title || `Contenuto da ${urlHostname}`,
        summary: ogData.description || '',
        image: ogData.image || '',
        previewImg: ogData.image || '',
        platform: 'generic',
        type: 'article',
        hostname: urlHostname,
        contentQuality: 'minimal',
        iframeAllowed: true,
        gateConfig: { mode: 'timer', minSeconds: 15 },
        qaSourceRef: { kind: 'url', id: url, url }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Ultimate fallback
    const urlPath = new URL(url).pathname;
    const urlSlug = urlPath.split('/').filter(s => s.length > 10).pop() || '';
    let urlTitle = urlSlug
      .replace(/[-_]/g, ' ')
      .replace(/\d{4,}/g, '')
      .replace(/\.(html?|php|aspx?)$/i, '')
      .trim();
    
    if (urlTitle) {
      urlTitle = urlTitle.charAt(0).toUpperCase() + urlTitle.slice(1);
    }
    
    return new Response(JSON.stringify({
      success: true,
      title: urlTitle || `Contenuto da ${urlHostname}`,
      summary: urlTitle ? `${urlTitle} - ${urlHostname}` : `Contenuto da ${urlHostname}`,
      platform: 'generic',
      type: 'article',
      hostname: urlHostname,
      contentQuality: 'minimal',
      iframeAllowed: true,
      gateConfig: { mode: 'timer', minSeconds: 15 },
      qaSourceRef: { kind: 'url', id: url, url }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[fetch-article-preview] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      url
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

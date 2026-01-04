import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Decode HTML entities from XML
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'");
}

// Lista di pattern per identificare "meta-news" (rassegne stampa)
const META_NEWS_PATTERNS = [
  /rassegna\s+stampa/i,
  /prime\s+pagine/i,
  /quotidiani\s+di\s+oggi/i,
  /titoli\s+dei\s+giornali/i,
  /i\s+titoli\s+di\s+oggi/i,
  /giornali\s+in\s+edicola/i,
  /le\s+notizie\s+del\s+giorno/i,
  /le\s+notizie\s+di\s+oggi/i,
  /prima\s+pagina/i,
  /anteprima\s+notizie/i,
  /edizioni\/il-/i,
  /\/\d{4}-\d{2}-\d{2}$/i, // URLs ending with date only
];

// URL patterns that indicate meta-news pages
const META_NEWS_URL_PATTERNS = [
  /\/edizioni\//i,
  /prima-pagina/i,
  /anteprima-notizie/i,
  /\/\d{4}-\d{2}-\d{2}$/i, // URLs ending with just a date
  /vivere\.it\/\d{4}/i, // vivere.it date pages
];

function isMetaNews(title: string): boolean {
  return META_NEWS_PATTERNS.some(pattern => pattern.test(title));
}

function isMetaNewsUrl(url: string): boolean {
  return META_NEWS_URL_PATTERNS.some(pattern => pattern.test(url));
}

// Decode Google News URL from Base64-encoded format
function decodeGoogleNewsUrl(googleNewsUrl: string): string | null {
  console.log('[GoogleNews] Attempting to decode:', googleNewsUrl);
  
  try {
    // Regex più flessibile: cattura tutto dopo 'articles/' o 'read/'
    const match = googleNewsUrl.match(/(?:articles|read|rss\/articles)\/([A-Za-z0-9_-]+)/);
    if (!match) {
      console.log('[GoogleNews] ❌ No article ID found in URL');
      return null;
    }
    
    const encoded = match[1];
    console.log('[GoogleNews] Extracted encoded ID:', encoded.substring(0, 20) + '...');
    
    // Convert from URL-safe base64 to standard base64
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if necessary
    const padding = (4 - base64.length % 4) % 4;
    base64 += '='.repeat(padding);
    
    // Decode
    const decoded = atob(base64);
    
    // Search for HTTP/HTTPS URL in the decoded protobuf data
    const urlMatch = decoded.match(/https?:\/\/[^\x00-\x1f\s"'<>]+/);
    if (urlMatch) {
      // Clean trailing binary characters
      let url = urlMatch[0];
      url = url.replace(/[\x00-\x1f]+$/, '');
      console.log('[GoogleNews] ✅ Decoded URL:', url);
      return url;
    }
    
    console.log('[GoogleNews] ❌ No URL found in decoded data');
    return null;
  } catch (error) {
    console.log('[GoogleNews] ❌ Decode failed:', error);
    return null;
  }
}

// Helper to extract source name from URL
function extractSourceFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const domain = hostname.replace('www.', '').split('.')[0];
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return 'Fonte';
  }
}

// Helper to extract text from XML tags (handles CDATA and simple tags)
function extractText(xml: string, tag: string): string | null {
  const cdataRegex = new RegExp(`<${tag}><!\\[CDATA\\[(.+?)\\]\\]></${tag}>`, 's');
  const simpleRegex = new RegExp(`<${tag}>(.+?)</${tag}>`, 's');
  
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();
  
  const simpleMatch = xml.match(simpleRegex);
  if (simpleMatch) return simpleMatch[1].trim();
  
  return null;
}

// Extract source name from RSS item (prioritize <source> tag, then parse from title)
function extractSourceName(itemXml: string, title: string): string {
  // Google News format: <source url="...">Source Name</source>
  const sourceMatch = itemXml.match(/<source[^>]*>([^<]+)<\/source>/);
  if (sourceMatch && sourceMatch[1].trim()) {
    console.log('Extracted source from <source> tag:', sourceMatch[1]);
    return sourceMatch[1].trim();
  }
  
  // Fallback: parse from title
  const titleParts = title.split(' - ');
  if (titleParts.length >= 2) {
    const source = titleParts[titleParts.length - 1].trim();
    console.log('Extracted source from title:', source);
    return source;
  }
  
  // Last fallback
  const link = extractText(itemXml, 'link') || '';
  return extractSourceFromUrl(link);
}

// Extract image from RSS item
function extractImage(itemXml: string): string | null {
  // Google News puts images in <description> as HTML entities
  const description = extractText(itemXml, 'description');
  if (description) {
    // Decode HTML entities first
    const decoded = decodeHtmlEntities(description);
    const imgMatch = decoded.match(/<img[^>]*src="([^"]+)"/);
    if (imgMatch) {
      console.log('Image found in description:', imgMatch[1]);
      return imgMatch[1];
    }
  }
  
  console.log('No image found in RSS item');
  return null;
}

// Generate news image using Lovable AI (gemini-2.5-flash-image-preview)
async function generateNewsImage(title: string, summary: string, supabase: any): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.log('[ImageGen] No LOVABLE_API_KEY configured');
    return null;
  }

  try {
    // Create a hash for caching
    const titleHash = title.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const cacheKey = `news-${titleHash}.png`;
    
    // Check if image already exists in storage
    const { data: existingFile } = await supabase.storage
      .from('news-images')
      .list('', { search: cacheKey });
    
    if (existingFile && existingFile.length > 0) {
      const { data: publicUrl } = supabase.storage
        .from('news-images')
        .getPublicUrl(cacheKey);
      console.log('[ImageGen] ✅ Using cached image:', publicUrl.publicUrl);
      return publicUrl.publicUrl;
    }

    // Generate contextual prompt
    const prompt = `Create a photorealistic news illustration for this headline:
"${title}"

Brief context: ${summary.substring(0, 150)}

Requirements:
- Professional news photography style
- NO text, logos, watermarks, or overlays
- Suitable for a news article header image
- 16:9 aspect ratio composition
- High quality, realistic lighting
- Neutral and factual visual tone`;

    console.log('[ImageGen] Generating image with prompt:', prompt.substring(0, 100) + '...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text']
      }),
      signal: AbortSignal.timeout(60000) // 60s timeout for image generation
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ImageGen] API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData) {
      console.log('[ImageGen] No image in response');
      return null;
    }

    // Extract base64 data
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      console.log('[ImageGen] Invalid base64 format');
      return null;
    }

    const imageFormat = base64Match[1]; // png, jpeg, etc.
    const base64Data = base64Match[2];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Upload to Supabase Storage
    const fileName = `news-${titleHash}.${imageFormat}`;
    const { error: uploadError } = await supabase.storage
      .from('news-images')
      .upload(fileName, binaryData, {
        contentType: `image/${imageFormat}`,
        upsert: true
      });

    if (uploadError) {
      console.error('[ImageGen] Upload error:', uploadError);
      return null;
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from('news-images')
      .getPublicUrl(fileName);

    console.log('[ImageGen] ✅ Generated and cached image:', publicUrl.publicUrl);
    return publicUrl.publicUrl;

  } catch (error) {
    console.error('[ImageGen] Error:', error);
    return null;
  }
}

// Validate image URL (exclude Google News placeholders and logos)
function isValidImage(url: string | null): boolean {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  
  // Esclude Google
  if (urlLower.includes('google.com') || urlLower.includes('gstatic.com')) return false;
  if (urlLower.includes('news.google')) return false;
  
  // Esclude loghi e placeholder comuni
  if (urlLower.includes('logo')) return false;
  if (urlLower.includes('placeholder')) return false;
  if (urlLower.includes('default')) return false;
  if (urlLower.includes('avatar')) return false;
  if (urlLower.includes('favicon')) return false;
  if (urlLower.includes('icon')) return false;
  
  // Deve essere HTTPS
  if (!url.startsWith('https://')) return false;
  
  return true;
}

// Fetch article image using Jina AI Reader
async function fetchArticleImageWithJina(url: string): Promise<string | null> {
  try {
    console.log('[Jina] Fetching image from:', url);
    
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Return-Format': 'json'
      },
      signal: AbortSignal.timeout(10000) // 10s timeout
    });
    
    if (!response.ok) {
      console.log('[Jina] Failed with status:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.data?.image && isValidImage(data.data.image)) {
      console.log('[Jina] ✅ Image found:', data.data.image);
      return data.data.image;
    }
    
    if (data.image && isValidImage(data.image)) {
      console.log('[Jina] ✅ Image found:', data.image);
      return data.image;
    }
    
    console.log('[Jina] No valid image in response');
    return null;
  } catch (error) {
    console.log('[Jina] ❌ Error:', error);
    return null;
  }
}

// Fetch Open Graph image from URL with full redirect handling
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    console.log(`Fetching OG image from: ${url}`);
    
    // First attempt: follow redirects
    const response = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      redirect: 'follow'
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch URL: ${response.status}`);
      return null;
    }
    
    const finalUrl = response.url;
    console.log(`Final URL after redirects: ${finalUrl}`);
    
    // If still on Google News, extract real redirect from HTML
    if (finalUrl.includes('news.google.com')) {
      console.log('Still on Google News, extracting real article URL from HTML...');
      const html = await response.text();
      
      // Google News uses different redirect patterns
      const redirectPatterns = [
        /href="(https?:\/\/[^"]+)"[^>]*>(?:Click here|Continua a leggere)/i,
        /<a[^>]*href="(https?:\/\/(?!news\.google)[^"]+)"[^>]*>/i,
        /url=(https?:\/\/(?!news\.google)[^&"']+)/i
      ];
      
      for (const pattern of redirectPatterns) {
        const match = html.match(pattern);
        if (match && match[1] && !match[1].includes('google.com')) {
          const realUrl = decodeURIComponent(match[1]);
          console.log(`Found real article URL: ${realUrl}`);
          
          // Fetch the actual article
          try {
            const articleResponse = await fetch(realUrl, {
              headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              },
              redirect: 'follow'
            });
            
            if (articleResponse.ok) {
              const articleHtml = await articleResponse.text();
              const ogImage = extractOgImageFromHtml(articleHtml);
              if (ogImage) return ogImage;
            }
          } catch (e) {
            console.log('Failed to fetch real article:', e);
          }
        }
      }
      
      console.log('Could not extract real URL from Google News redirect');
      return null;
    }
    
    // Extract OG image from final HTML
    const html = await response.text();
    return extractOgImageFromHtml(html);
    
  } catch (error) {
    console.error(`Error fetching OG image: ${error}`);
    return null;
  }
}

// Helper to extract OG image from HTML
function extractOgImageFromHtml(html: string): string | null {
  // Try og:image
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch) {
    console.log(`Found og:image: ${ogMatch[1]}`);
    return ogMatch[1];
  }
  
  // Try content first (some sites have different order)
  const ogMatchAlt = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogMatchAlt) {
    console.log(`Found og:image (alt format): ${ogMatchAlt[1]}`);
    return ogMatchAlt[1];
  }
  
  // Fallback: twitter:image
  const twitterMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
  if (twitterMatch) {
    console.log(`Found twitter:image: ${twitterMatch[1]}`);
    return twitterMatch[1];
  }
  
  console.log('No OG or Twitter image found');
  return null;
}

// Search for related articles about the same story using Google News search
async function searchRelatedArticles(mainTitle: string): Promise<Array<{ title: string; source: string; link: string }>> {
  // Clean title: remove source and common words like LIVE
  let cleanTitle = mainTitle.split(' - ')[0].trim();
  cleanTitle = cleanTitle.replace(/\bLIVE\b/gi, '').trim();
  // Use 8 keywords instead of 6 for better coverage
  const keywords = cleanTitle.split(' ').slice(0, 8).join(' ');
  
  console.log(`Searching for related articles with keywords: ${keywords}`);
  
  const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keywords)}&hl=it&gl=IT&ceid=IT:it`;
  
  const response = await fetch(searchUrl, {
    headers: { 
      'User-Agent': 'Mozilla/5.0 (compatible; NoParrotBot/1.0)',
      'Accept': 'application/xml, text/xml, */*'
    }
  });
  
  if (!response.ok) {
    console.error('Failed to search related articles:', response.statusText);
    return [];
  }
  
  const text = await response.text();
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const items = text.match(itemRegex);
  
  if (!items || items.length === 0) {
    console.log('No related articles found in search');
    return [];
  }
  
  // Extract up to 8 articles from different sources
  const articles: Array<{ title: string; source: string; link: string }> = [];
  const seenSources = new Set<string>();
  
  for (const itemXml of items.slice(0, 20)) { // Check more items to get 8 unique real sources
    const title = extractText(itemXml, 'title');
    const link = extractText(itemXml, 'link');
    
    if (!title || !link) continue;
    
    // Skip meta-news from search results (both by title and URL)
    if (isMetaNews(title)) {
      console.log(`[Search] Skipping meta-news (title): ${title}`);
      continue;
    }
    
    if (isMetaNewsUrl(link)) {
      console.log(`[Search] Skipping meta-news (URL): ${link}`);
      continue;
    }
    
    const source = extractSourceName(itemXml, title);
    
    // Skip duplicates from same source
    if (seenSources.has(source.toLowerCase())) continue;
    seenSources.add(source.toLowerCase());
    
    articles.push({ title, source, link });
    console.log(`[Search] Added article from ${source}: ${title.substring(0, 50)}...`);
    
    if (articles.length >= 8) break;
  }
  
  console.log(`Found ${articles.length} unique real news sources for this story`);
  return articles;
}

// Fetch top story and search for multi-source coverage
async function fetchTopStoryWithMultiSourceCoverage(): Promise<{
  mainTitle: string;
  articles: Array<{ title: string; source: string; link: string }>;
  imageUrl: string | null;
}> {
  console.log('Fetching top story from Google News');
  
  const rssUrl = 'https://news.google.com/rss?hl=it&gl=IT&ceid=IT:it';
  
  const response = await fetch(rssUrl, {
    headers: { 
      'User-Agent': 'Mozilla/5.0 (compatible; NoParrotBot/1.0)',
      'Accept': 'application/xml, text/xml, */*'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Google News RSS: ${response.statusText}`);
  }
  
  const text = await response.text();
  console.log('Fetched RSS feed successfully');
  
  // Extract all items
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const items = text.match(itemRegex);
  
  if (!items || items.length === 0) {
    throw new Error('No articles found in RSS feed');
  }
  
  // Iterate through items to find first NON-meta-news article
  let firstItemXml: string | null = null;
  let mainTitle: string | null = null;
  
  console.log(`[RSS] Checking ${items.length} items for first real news (skipping meta-news)...`);
  
  for (let i = 0; i < Math.min(items.length, 10); i++) {
    const itemXml = items[i];
    const title = extractText(itemXml, 'title');
    
    if (!title) continue;
    
    if (isMetaNews(title)) {
      console.log(`[RSS] Skipping meta-news at position ${i}: ${title}`);
      continue;
    }
    
    // Found first real news!
    console.log(`[RSS] ✅ Found real news at position ${i}: ${title}`);
    firstItemXml = itemXml;
    mainTitle = title;
    break;
  }
  
  if (!mainTitle || !firstItemXml) {
    throw new Error('Could not find any real news (all items were meta-news)');
  }
  
  const imageUrl = extractImage(firstItemXml);
  console.log('Top headline:', mainTitle);
  if (imageUrl) console.log('Image found:', imageUrl);
  
  // PHASE 2: Search for related articles from multiple sources
  const relatedArticles = await searchRelatedArticles(mainTitle);
  
  if (relatedArticles.length === 0) {
    // Fallback to just the main article if search fails
    const mainLink = extractText(firstItemXml, 'link') || '';
    const mainSource = extractSourceName(firstItemXml, mainTitle);
    
    return {
      mainTitle,
      articles: [{
        title: mainTitle,
        source: mainSource,
        link: mainLink
      }],
      imageUrl
    };
  }
  
  console.log(`Found ${relatedArticles.length} sources covering this story`);
  
  return { mainTitle, articles: relatedArticles, imageUrl };
}

// Validate and fix deep_content to ensure every paragraph has source markers
function validateAndFixSources(deepContent: string, maxSourceIndex: number): string {
  if (!deepContent) return '';
  
  // Split into paragraphs (separated by double newlines)
  const paragraphs = deepContent.split(/\n\n+/).filter(p => p.trim());
  
  const fixedParagraphs = paragraphs.map((paragraph, idx) => {
    const trimmed = paragraph.trim();
    
    // Check if paragraph ends with [SOURCE:N] pattern
    const hasSourceAtEnd = /\[SOURCE:\d+\](\s*\[SOURCE:\d+\])*\s*$/.test(trimmed);
    
    if (!hasSourceAtEnd) {
      // Add [SOURCE:0] if no source marker found at end
      console.log(`[Validation] Paragraph ${idx} missing source marker, adding [SOURCE:0]`);
      return `${trimmed} [SOURCE:0]`;
    }
    
    // Validate that all source indices are within range
    const sourceMatches = trimmed.match(/\[SOURCE:(\d+)\]/g);
    if (sourceMatches) {
      const invalidIndices = sourceMatches
        .map(m => parseInt(m.match(/\d+/)![0]))
        .filter(index => index >= maxSourceIndex);
      
      if (invalidIndices.length > 0) {
        console.warn(`[Validation] Found invalid source indices: ${invalidIndices.join(', ')} (max: ${maxSourceIndex - 1})`);
        // Replace invalid indices with [SOURCE:0]
        let fixed = trimmed;
        invalidIndices.forEach(invalid => {
          fixed = fixed.replace(new RegExp(`\\[SOURCE:${invalid}\\]`, 'g'), '[SOURCE:0]');
        });
        return fixed;
      }
    }
    
    return trimmed;
  });
  
  return fixedParagraphs.join('\n\n');
}

// Synthesize articles about the SAME story using AI
async function synthesizeWithAI(
  mainTitle: string,
  articles: Array<{ title: string; source: string; link: string }>
): Promise<{ title: string; summary: string; deep_content: string }> {
  console.log('Synthesizing story with AI');
  
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }
  
  const prompt = `Sei un giornalista esperto. Il tuo compito è sintetizzare UNA SINGOLA NOTIZIA specifica, NON una rassegna stampa generica.

TITOLO PRINCIPALE DAL RSS: ${mainTitle}

FONTI DISPONIBILI:
${articles.map((a, idx) => `[${idx}] ${a.source}: "${a.title}"`).join('\n')}

⚠️ REGOLA FONDAMENTALE: Devi parlare di UNA SOLA NOTIZIA SPECIFICA, quella più importante tra le fonti.
- NON creare una "rassegna stampa" o "panoramica delle notizie"
- NON elencare multiple notizie diverse
- FOCALIZZATI su UN evento/fatto specifico
- Il titolo deve essere specifico (es. "Inter batte l'Atletico in Champions" NON "Le notizie sportive di oggi")

Il tuo compito è creare:
1. Un TITOLO FINALE chiaro e specifico sull'evento principale (max 80 caratteri)
   ⚠️ NON citare MAI il nome di una fonte nel titolo (es: "- Corriere della Sera", "secondo Repubblica" è VIETATO)
2. Un SUMMARY per la card che descrive SOLO questo evento (400-500 caratteri, SENZA marker [SOURCE:N])
3. Un APPROFONDIMENTO ESTESO (deep_content) di 1500-2000 caratteri FOCALIZZATO su questo evento con:
   - Spiegazione dettagliata di cosa è successo in QUESTO evento specifico
   - Contesto storico/politico quando rilevante
   - Chi sono i protagonisti e perché è importante
   - Cosa dicono le diverse fonti su QUESTO evento
   - Implicazioni e sviluppi futuri
   - Scrivi in modo discorsivo, coinvolgente, NO elenchi puntati

⚠️ CRITICAL RULES FOR [SOURCE:N] MARKERS - MUST BE FOLLOWED EXACTLY:
1. VALID INDEX RANGE: You have ${articles.length} sources (indices 0 to ${articles.length - 1})
   - ONLY use indices in this range: ${Array.from({length: articles.length}, (_, i) => i).join(', ')}
   - NEVER use indices ${articles.length} or higher
   - Example: If you have 5 sources, ONLY use [SOURCE:0] through [SOURCE:4]

2. PLACEMENT RULES:
   - Place markers ONLY at the END of paragraphs, NEVER mid-sentence
   - NEVER place [SOURCE:N] before commas or conjunctions
   - EVERY paragraph MUST end with at least one valid [SOURCE:N] marker

3. FORMAT RULES:
   - Multiple sources: [SOURCE:0] [SOURCE:1] [SOURCE:2] ✅
   - NEVER use comma format: [SOURCE:0, 1, 2] ❌
   - Space-separated individual markers ONLY

STRUTTURA CORRETTA DI OGNI PARAGRAFO:
"Frase 1. Frase 2. Frase 3 che conclude l'idea del paragrafo. [SOURCE:0] [SOURCE:1]"

ESEMPIO ERRATO ❌:
"Trump ha affermato [SOURCE:0] che ci sono buone chance per un accordo"

ESEMPIO CORRETTO ✅:
"Trump ha affermato che ci sono buone chance per un accordo tra le due nazioni, un'affermazione attesa da tempo che potrebbe cambiare gli equilibri diplomatici. [SOURCE:0] [SOURCE:1]"

Rispondi SOLO con JSON valido:
{
  "title": "Titolo conciso e chiaro",
  "summary": "Sintesi per card SENZA marker (400-500 caratteri)",
  "deep_content": "Approfondimento esteso con marker [SOURCE:N] SOLO a fine paragrafo (1500-2000 caratteri)"
}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: 'Sei un giornalista esperto. Rispondi SOLO con JSON valido, nessun testo prima o dopo.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 3000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI synthesis failed: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Extract JSON from response (handles markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from AI response');
    }
    
    const result = JSON.parse(jsonMatch[0]);
    console.log('AI synthesis completed:', result.title);
    
    // Validate and fix deep_content: ensure every paragraph has source markers
    const fixedDeepContent = validateAndFixSources(result.deep_content, articles.length);
    
    return {
      title: result.title,
      summary: result.summary,
      deep_content: fixedDeepContent
    };
  } catch (error) {
    console.error('AI synthesis error:', error);
    
    return {
      title: mainTitle,
      summary: `Sintesi automatica: ${mainTitle}. Questa notizia è stata aggregata da ${articles.length} fonti diverse.`,
      deep_content: `${mainTitle}\n\nQuesta notizia è stata riportata da diverse fonti:\n${articles.map((a, idx) => `\n[SOURCE:${idx}] ${a.source}: ${a.title}`).join('')}\n\nPer maggiori dettagli, consulta le fonti originali.`
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('fetch-daily-focus invoked');
    
    // Parse request body for scheduled generation
    let scheduled = false;
    let edition_time: string | null = null;
    try {
      const body = await req.json();
      scheduled = body?.scheduled === true;
      edition_time = body?.edition_time || null;
    } catch {
      // No body or invalid JSON, use default
    }
    
    // If not scheduled, calculate edition_time from current CET time
    if (!edition_time) {
      const now = new Date();
      const cetFormatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Europe/Rome'
      });
      edition_time = cetFormatter.format(now).toLowerCase().replace(' ', ' ');
    }
    
    console.log('Edition time:', edition_time, '| Scheduled:', scheduled);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Skip cache check for scheduled runs - always generate new content
    // For non-scheduled runs, check if we have recent content
    if (!scheduled) {
      const { data: cached } = await supabase
        .from('daily_focus')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (cached) {
        console.log('Returning latest daily focus (non-scheduled call)');
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // 2. Fetch fresh data using multi-source search
    console.log('Fetching fresh daily focus with multi-source coverage...');
    const { mainTitle, articles, imageUrl: rssImageUrl } = await fetchTopStoryWithMultiSourceCoverage();
    
    if (articles.length === 0) {
      console.log('No articles found, using fallback');
      const fallback = {
        id: crypto.randomUUID(),
        title: 'Nessuna notizia disponibile',
        summary: 'Al momento non ci sono notizie disponibili. Riprova più tardi.',
        deep_content: 'Nessun contenuto disponibile.',
        sources: [{ icon: '📰', name: 'Google News', url: '' }],
        trust_score: 'Medio' as const,
        reactions: { likes: 0, comments: 0, shares: 0 },
        image_url: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      
      await supabase.from('daily_focus').insert(fallback);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // 2.5 Deduplication check: avoid inserting duplicate news (same first 6 words of title)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentNews } = await supabase
      .from('daily_focus')
      .select('id, title')
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(5);
    
    const newTitleWords = mainTitle.toLowerCase().split(' ').slice(0, 6).join(' ');
    const existingDuplicate = recentNews?.find(existing => {
      const existingWords = existing.title.toLowerCase().split(' ').slice(0, 6).join(' ');
      return newTitleWords === existingWords;
    });
    
    if (existingDuplicate) {
      console.log('Duplicate news detected, returning existing item:', existingDuplicate.id);
      const { data: latestItem } = await supabase
        .from('daily_focus')
        .select('*')
        .eq('id', existingDuplicate.id)
        .single();
      
      if (latestItem) {
        return new Response(JSON.stringify(latestItem), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // 3. Synthesize with AI
    const { title, summary, deep_content } = await synthesizeWithAI(mainTitle, articles);
    
    // 4. Image handling with Jina AI Reader
    let finalImageUrl = isValidImage(rssImageUrl) ? rssImageUrl : null;
    
    // Try Jina AI Reader on multiple articles (up to 4)
    if (!finalImageUrl && articles.length > 0) {
      console.log('[Image] Trying Jina AI on multiple articles...');
      
      for (let i = 0; i < Math.min(4, articles.length); i++) {
        const article = articles[i];
        if (!article.link) continue;
        
        // Decode Google News URL to get the real article URL
        const realUrl = article.link.includes('news.google.com') 
          ? decodeGoogleNewsUrl(article.link) 
          : article.link;
        
        if (!realUrl && article.link.includes('news.google.com')) {
          // Fallback: se decode fallisce, prova Jina direttamente su URL Google News
          console.log(`[Image] Decode failed, trying Jina directly on Google News URL for ${article.source}`);
          const jinaImage = await fetchArticleImageWithJina(article.link);
          if (jinaImage) {
            finalImageUrl = jinaImage;
            console.log(`[Image] ✅ Got image from Google News redirect: ${article.source}`);
            break;
          }
          continue;
        }
        
        if (!realUrl) {
          console.log(`[Image] Could not decode URL for ${article.source}`);
          continue;
        }
        
        console.log(`[Image] Attempt ${i + 1}/${Math.min(4, articles.length)}: ${article.source} - ${realUrl}`);
        const jinaImage = await fetchArticleImageWithJina(realUrl);
        
        if (jinaImage) {
          finalImageUrl = jinaImage;
          console.log(`[Image] ✅ Got image from ${article.source}`);
          break;
        }
      }
    }
    
    // AI image generation disabled - use null if no image found
    if (!finalImageUrl) {
      console.log('[Image] No image found, skipping AI generation');
      finalImageUrl = null;
    }
    
    console.log('[fetch-daily-focus] Final image URL:', finalImageUrl);
    
    // 4. Format sources (take up to 5 diverse sources)
    const sources = articles.slice(0, 5).map(a => ({
      icon: '📰',
      name: a.source,
      url: a.link
    }));
    
    // 5. Create daily focus record
    const dailyFocus = {
      id: crypto.randomUUID(),
      title,
      summary,
      deep_content,
      sources,
      trust_score: 'Alto' as const, // Multi-source = higher trust
      reactions: { likes: 0, comments: 0, shares: 0 },
      image_url: finalImageUrl,
      edition_time, // "2:30 pm", "8:30 am", etc.
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours
    };
    
    // 6. Store in database
    const { error: insertError } = await supabase
      .from('daily_focus')
      .insert(dailyFocus);
    
    if (insertError) {
      console.error('Error inserting daily focus:', insertError);
      throw insertError;
    }
    
    console.log('Daily focus created successfully');
    
    return new Response(JSON.stringify(dailyFocus), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error in fetch-daily-focus:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
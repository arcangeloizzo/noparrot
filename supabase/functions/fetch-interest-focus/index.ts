import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  /prima\s+pagina/i
];

function isMetaNews(title: string): boolean {
  return META_NEWS_PATTERNS.some(pattern => pattern.test(title));
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

// Map categorie NoParrot -> Topic IDs Google News
const CATEGORY_TOPIC_IDS: Record<string, string> = {
  'Tecnologia': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtbDBHZ0pKVkNnQVAB',
  'Scienza': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtbDBHZ0pKVkNnQVAB',
  'Scienza & Tecnologia': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtbDBHZ0pKVkNnQVAB',
  'Società & Politica': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFZ4ZURBU0FtbDBHZ0pKVkNnQVAB',
  'Cultura & Arte': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtbDBHZ0pKVkNnQVAB',
  'Salute': 'CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtbDBLQUFQAQ',
  'Economia': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6YUdFU0FtbDBHZ0pKVkNnQVAB',
  'Economia & Business': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6YUdFU0FtbDBHZ0pKVkNnQVAB',
  'Sport': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtbDBHZ0pKVkNnQVAB',
  'Sport & Lifestyle': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtbDBHZ0pKVkNnQVAB',
  'Intrattenimento': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtbDBHZ0pKVkNnQVAB',
  'Media & Comunicazione': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtbDBHZ0pKVkNnQVAB'
};

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

// Generate news image using Lovable AI (gemini-2.5-flash-image-preview)
async function generateNewsImage(title: string, summary: string, category: string, supabase: any): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.log('[ImageGen] No LOVABLE_API_KEY configured');
    return null;
  }

  try {
    // Create a hash for caching (include category)
    const hashSource = `${title}-${category}`;
    const titleHash = hashSource.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const cacheKey = `interest-${category.toLowerCase().replace(/\s+/g, '-')}-${titleHash}.png`;
    
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

    // Generate contextual prompt with category context
    const prompt = `Create a photorealistic news illustration for this ${category} headline:
"${title}"

Brief context: ${summary.substring(0, 150)}

Requirements:
- Professional news photography style for ${category} news
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
    const fileName = `interest-${category.toLowerCase().replace(/\s+/g, '-')}-${titleHash}.${imageFormat}`;
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

// Extract key entities/terms from title for relevance checking
function extractKeyTerms(title: string): string[] {
  // Clean title
  const cleanTitle = title.split(' - ')[0].trim().toLowerCase();
  
  // Remove common stopwords
  const stopwords = ['il', 'la', 'lo', 'le', 'gli', 'un', 'una', 'dei', 'delle', 'di', 'da', 'in', 'su', 'per', 'con', 'tra', 'fra', 'a', 'e', 'o', 'che', 'non', 'è', 'sono', 'ha', 'hanno', 'come', 'più', 'anche', 'cosa', 'fa', 'al', 'alla', 'allo', 'alle', 'agli', 'nel', 'nella', 'nello', 'nelle', 'negli', 'del', 'dello', 'della', 'delle', 'degli', 'sul', 'sulla', 'sullo', 'sulle', 'sugli', 'dal', 'dalla', 'dallo', 'dalle', 'dagli'];
  
  const words = cleanTitle.split(/\s+/).filter(w => w.length > 2 && !stopwords.includes(w));
  
  // Extract the most important terms (first 4-5 content words, likely the subject)
  return words.slice(0, 5);
}

// Check if article is semantically relevant to the main story
function isRelevantToMainStory(articleTitle: string, keyTerms: string[]): boolean {
  const lowerTitle = articleTitle.toLowerCase();
  
  // Article must contain at least 2 key terms from the main story
  let matchCount = 0;
  for (const term of keyTerms) {
    if (lowerTitle.includes(term)) {
      matchCount++;
    }
  }
  
  // Require at least 40% of key terms to match (2 out of 5)
  const threshold = Math.max(2, Math.floor(keyTerms.length * 0.4));
  return matchCount >= threshold;
}

// Search for related articles about the same story using Google News search
async function searchRelatedArticles(mainTitle: string): Promise<Array<{ title: string; source: string; link: string }>> {
  // Clean title: remove source and common words like LIVE
  let cleanTitle = mainTitle.split(' - ')[0].trim();
  cleanTitle = cleanTitle.replace(/\bLIVE\b/gi, '').trim();
  
  // Extract key terms for relevance filtering
  const keyTerms = extractKeyTerms(cleanTitle);
  console.log(`[Search] Key terms for relevance: ${keyTerms.join(', ')}`);
  
  // Use more specific keywords (first 6 significant words)
  const keywords = cleanTitle.split(' ').slice(0, 6).join(' ');
  
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
  
  // Extract up to 8 articles from different sources, but ONLY if relevant
  const articles: Array<{ title: string; source: string; link: string }> = [];
  const seenSources = new Set<string>();
  
  for (const itemXml of items.slice(0, 25)) { // Check more items to find relevant ones
    const title = extractText(itemXml, 'title');
    const link = extractText(itemXml, 'link');
    
    if (!title || !link) continue;
    
    // Skip meta-news from search results
    if (isMetaNews(title)) {
      console.log(`[Search] Skipping meta-news: ${title.substring(0, 50)}...`);
      continue;
    }
    
    // CRITICAL: Check if article is about the SAME story, not just similar words
    if (!isRelevantToMainStory(title, keyTerms)) {
      console.log(`[Search] Skipping irrelevant article (not same story): ${title.substring(0, 60)}...`);
      continue;
    }
    
    const source = extractSourceName(itemXml, title);
    
    // Skip duplicates from same source
    if (seenSources.has(source.toLowerCase())) continue;
    seenSources.add(source.toLowerCase());
    
    articles.push({ title, source, link });
    console.log(`[Search] ✅ Added relevant article from ${source}: ${title.substring(0, 50)}...`);
    
    if (articles.length >= 6) break; // Reduced to 6 to ensure quality
  }
  
  console.log(`Found ${articles.length} unique RELEVANT sources for this story`);
  return articles;
}

// Fetch top story for category and search for multi-source coverage
async function fetchTopCategoryStoryWithMultiSourceCoverage(
  category: string
): Promise<{
  mainTitle: string;
  articles: Array<{ title: string; source: string; link: string }>;
  imageUrl: string | null;
}> {
  console.log(`Fetching top story for category: ${category}`);
  
  const topicId = CATEGORY_TOPIC_IDS[category];
  if (!topicId) {
    throw new Error(`Category not mapped: ${category}`);
  }
  
  // Fallback per "Società & Politica" che usa ricerca invece di topic
  let rssUrl: string;
  if (category === 'Società & Politica') {
    console.log('Using search-based RSS for Società & Politica');
    rssUrl = 'https://news.google.com/rss/search?q=politica+italia&hl=it&gl=IT&ceid=IT:it';
  } else {
    rssUrl = `https://news.google.com/rss/topics/${topicId}?hl=it&gl=IT&ceid=IT:it`;
  }
  
  const response = await fetch(rssUrl, {
    headers: { 
      'User-Agent': 'Mozilla/5.0 (compatible; NoParrotBot/1.0)',
      'Accept': 'application/xml, text/xml, */*'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch category RSS: ${response.statusText}`);
  }
  
  const text = await response.text();
  console.log('Fetched category RSS feed successfully');
  
  // Extract all items
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const items = text.match(itemRegex);
  
  if (!items || items.length === 0) {
    throw new Error('No articles found in category RSS feed');
  }
  
  // Iterate through items to find first NON-meta-news article
  let firstItemXml: string | null = null;
  let mainTitle: string | null = null;
  
  console.log(`[RSS ${category}] Checking ${items.length} items for first real news (skipping meta-news)...`);
  
  for (let i = 0; i < Math.min(items.length, 10); i++) {
    const itemXml = items[i];
    const title = extractText(itemXml, 'title');
    
    if (!title) continue;
    
    if (isMetaNews(title)) {
      console.log(`[RSS ${category}] Skipping meta-news at position ${i}: ${title}`);
      continue;
    }
    
    // Found first real news!
    console.log(`[RSS ${category}] ✅ Found real news at position ${i}: ${title}`);
    firstItemXml = itemXml;
    mainTitle = title;
    break;
  }
  
  if (!mainTitle || !firstItemXml) {
    throw new Error('Could not find any real news (all items were meta-news)');
  }
  
  const imageUrl = extractImage(firstItemXml);
  console.log('Top headline for category:', mainTitle);
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

// Synthesize articles about the SAME story for a specific category
async function synthesizeForCategory(
  category: string,
  mainTitle: string, 
  articles: Array<{ title: string; source: string; link: string }>
): Promise<{ title: string; summary: string; deep_content: string }> {
  console.log(`Synthesizing for category ${category}...`);
  
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const prompt = `Sei un giornalista esperto specializzato in ${category}.

TITOLO PRINCIPALE: ${mainTitle}

FONTI DISPONIBILI:
${articles.map((a, idx) => `[${idx}] ${a.source}: "${a.title}"`).join('\n')}

Il tuo compito è creare:
1. Un TITOLO FINALE chiaro e conciso (max 80 caratteri)
2. Un SUMMARY per la card (400-500 caratteri, SENZA marker [SOURCE:N])
3. Un APPROFONDIMENTO ESTESO (deep_content) di 1500-2000 caratteri con:
   - Spiegazione dettagliata di cosa è successo
   - Contesto storico/politico/settoriale quando rilevante
   - Chi sono i protagonisti e perché è importante
   - Cosa dicono le diverse fonti
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
"La compagnia ha annunciato [SOURCE:0] un nuovo prodotto che rivoluzionerà il mercato"

ESEMPIO CORRETTO ✅:
"La compagnia ha annunciato un nuovo prodotto che rivoluzionerà il mercato, segnando una svolta significativa nell'evoluzione del settore. [SOURCE:0] [SOURCE:1]"

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
    console.log('fetch-interest-focus invoked');
    
    const body = await req.json();
    const { category, force } = body;
    
    if (!category) {
      return new Response(
        JSON.stringify({ error: 'Category is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Check cache (valid for 3 hours) - skip if force=true
    if (!force) {
      const { data: cached } = await supabase
        .from('interest_focus')
        .select('*')
        .eq('category', category)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (cached) {
        console.log(`Returning cached interest focus for category: ${category}`);
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      console.log(`Force refresh requested for category: ${category}`);
    }
    
    // 2. Fetch fresh data
    console.log(`Fetching fresh interest focus for category: ${category}...`);
    const { mainTitle, articles, imageUrl: rssImageUrl } = await fetchTopCategoryStoryWithMultiSourceCoverage(category);
    
    if (articles.length === 0) {
      console.log('No articles found, using fallback');
      const fallback = {
        id: crypto.randomUUID(),
        category,
        title: `Nessuna notizia disponibile per ${category}`,
        summary: 'Al momento non ci sono notizie disponibili per questa categoria. Riprova più tardi.',
        deep_content: 'Nessun contenuto disponibile.',
        sources: [{ icon: '📰', name: 'Google News', url: '' }],
        trust_score: 'Medio' as const,
        reactions: { likes: 0, comments: 0, shares: 0 },
        image_url: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
      };
      
      await supabase.from('interest_focus').insert(fallback);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // 3. Synthesize with AI
    const { title, summary, deep_content } = await synthesizeForCategory(category, mainTitle, articles);
    
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
    
    console.log(`[fetch-interest-focus] Final image URL for ${category}:`, finalImageUrl);
    
    // 4. Format sources (take up to 5 diverse sources)
    const sources = articles.slice(0, 5).map(a => ({
      icon: '📰',
      name: a.source,
      url: a.link
    }));
    
    // 5. Create interest focus record
    const interestFocus = {
      id: crypto.randomUUID(),
      category,
      title,
      summary,
      deep_content,
      sources,
      trust_score: 'Alto' as const,
      reactions: { likes: 0, comments: 0, shares: 0 },
      image_url: finalImageUrl,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() // 3 hours
    };
    
    // 6. Store in database
    const { error: insertError } = await supabase
      .from('interest_focus')
      .insert(interestFocus);
    
    if (insertError) {
      console.error('Error inserting interest focus:', insertError);
      throw insertError;
    }
    
    console.log(`Interest focus created successfully for category: ${category}`);
    
    return new Response(JSON.stringify(interestFocus), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error in fetch-interest-focus:', error);
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
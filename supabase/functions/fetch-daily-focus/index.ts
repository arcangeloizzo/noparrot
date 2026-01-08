import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============= DEDUP CONFIG =============
const DEDUP_CONFIG = {
  SIMILARITY_HARD_THRESHOLD: 0.88,  // Skip automatico
  SIMILARITY_SOFT_THRESHOLD: 0.75,  // Richiede angle check
  CLUSTER_QUOTA_24H: 2,             // Max editoriali stesso cluster
  LOOKBACK_HOURS: 48                // Finestra temporale
};

// ============= DEDUP FUNCTIONS =============

// Generate event fingerprint for hard deduplication
function generateEventFingerprint(mainTitle: string, pubDate: string): string {
  const stopWords = ['il', 'la', 'i', 'le', 'un', 'una', 'di', 'da', 'a', 'in', 'con', 'su', 'per', 'tra', 'fra', 'e', 'o', 'ma', 'che', 'non', 'del', 'della', 'dei', 'delle', 'al', 'alla', 'agli', 'alle'];
  
  const normalized = mainTitle
    .toLowerCase()
    .replace(/[^a-zàèéìòù0-9\s]/g, '')
    .split(' ')
    .filter(w => w.length > 2 && !stopWords.includes(w))
    .sort()
    .slice(0, 10)
    .join('|');
  
  const dateStr = new Date(pubDate).toISOString().split('T')[0];
  return `${dateStr}:${normalized}`;
}

// Classify topic and angle using AI
async function classifyTopicAndAngle(mainTitle: string): Promise<{
  topic_cluster: string;
  angle_tag: string;
}> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.log('[Classify] No API key, using default classification');
    return { topic_cluster: 'Altro', angle_tag: 'Generale' };
  }

  try {
    const prompt = `Classifica questa notizia:
"${mainTitle}"

TOPIC_CLUSTER (uno solo): Trump | Vaticano | Ucraina | Gaza | Medio_Oriente | Russia | Cina | Economia | Clima | Tecnologia | Italia | Europa | USA | Sport | Cultura | Altro
ANGLE_TAG (uno solo): Geopolitica | Economia | Militare | Diplomazia | Società | Diritto | Elezioni | Ambiente | Tecnologia | Cultura | Religione | Generale

Rispondi SOLO con JSON valido: {"topic_cluster": "...", "angle_tag": "..."}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 100
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.log('[Classify] API error:', response.status);
      return { topic_cluster: 'Altro', angle_tag: 'Generale' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[Classify] ${mainTitle.substring(0, 40)}... → ${parsed.topic_cluster}/${parsed.angle_tag}`);
      return {
        topic_cluster: parsed.topic_cluster || 'Altro',
        angle_tag: parsed.angle_tag || 'Generale'
      };
    }
  } catch (error) {
    console.log('[Classify] Error:', error);
  }

  return { topic_cluster: 'Altro', angle_tag: 'Generale' };
}

// Calculate semantic similarity using AI
async function calculateSimilarity(
  newTitle: string,
  recentEditorials: Array<{ id: string; title: string; summary: string; raw_title?: string }>
): Promise<{ maxSimilarity: number; matchedId: string | null; matchedTitle: string | null }> {
  if (!recentEditorials?.length) {
    return { maxSimilarity: 0, matchedId: null, matchedTitle: null };
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.log('[Similarity] No API key, using keyword matching');
    // Fallback: simple keyword overlap
    const newWords = new Set(newTitle.toLowerCase().split(' ').filter(w => w.length > 3));
    let maxOverlap = 0;
    let matchedId: string | null = null;
    let matchedTitle: string | null = null;
    
    for (const editorial of recentEditorials) {
      const existingWords = new Set((editorial.raw_title || editorial.title).toLowerCase().split(' ').filter(w => w.length > 3));
      const intersection = [...newWords].filter(w => existingWords.has(w)).length;
      const overlap = intersection / Math.max(newWords.size, existingWords.size);
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        matchedId = editorial.id;
        matchedTitle = editorial.title;
      }
    }
    return { maxSimilarity: maxOverlap, matchedId, matchedTitle };
  }

  try {
    const recentContext = recentEditorials.slice(0, 8).map((e, i) => 
      `[${i}] "${e.title}" (raw: ${e.raw_title || 'n/a'})`
    ).join('\n');

    const prompt = `NUOVO TITOLO DI NOTIZIA: "${newTitle}"

EDITORIALI RECENTI (ultime 48h):
${recentContext}

Valuta la similarità semantica (0.0-1.0) tra il nuovo titolo e ciascun editoriale recente.
- 0.90-1.0: Stesso identico evento/fatto
- 0.80-0.90: Stesso evento, angolo leggermente diverso
- 0.70-0.80: Stesso tema generale, eventi diversi
- <0.70: Temi diversi

Rispondi SOLO con JSON: {"max_similarity": 0.XX, "matched_index": N, "reason": "breve spiegazione"}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 150
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      console.log('[Similarity] API error:', response.status);
      return { maxSimilarity: 0, matchedId: null, matchedTitle: null };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const matchedIdx = parsed.matched_index;
      const matchedEditorial = recentEditorials[matchedIdx] || null;
      
      console.log(`[Similarity] ${newTitle.substring(0, 40)}... → similarity: ${parsed.max_similarity} (${parsed.reason || 'no reason'})`);
      
      return {
        maxSimilarity: parsed.max_similarity || 0,
        matchedId: matchedEditorial?.id || null,
        matchedTitle: matchedEditorial?.title || null
      };
    }
  } catch (error) {
    console.log('[Similarity] Error:', error);
  }

  return { maxSimilarity: 0, matchedId: null, matchedTitle: null };
}

// ============= ORIGINAL HELPER FUNCTIONS =============

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
  /\/\d{4}-\d{2}-\d{2}$/i,
];

const META_NEWS_URL_PATTERNS = [
  /\/edizioni\//i,
  /prima-pagina/i,
  /anteprima-notizie/i,
  /\/\d{4}-\d{2}-\d{2}$/i,
  /vivere\.it\/\d{4}/i,
];

function isMetaNews(title: string): boolean {
  return META_NEWS_PATTERNS.some(pattern => pattern.test(title));
}

function isMetaNewsUrl(url: string): boolean {
  return META_NEWS_URL_PATTERNS.some(pattern => pattern.test(url));
}

function decodeGoogleNewsUrl(googleNewsUrl: string): string | null {
  console.log('[GoogleNews] Attempting to decode:', googleNewsUrl);
  
  try {
    const match = googleNewsUrl.match(/(?:articles|read|rss\/articles)\/([A-Za-z0-9_-]+)/);
    if (!match) {
      console.log('[GoogleNews] ❌ No article ID found in URL');
      return null;
    }
    
    const encoded = match[1];
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - base64.length % 4) % 4;
    base64 += '='.repeat(padding);
    
    const decoded = atob(base64);
    const urlMatch = decoded.match(/https?:\/\/[^\x00-\x1f\s"'<>]+/);
    if (urlMatch) {
      let url = urlMatch[0].replace(/[\x00-\x1f]+$/, '');
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

function extractSourceFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const domain = hostname.replace('www.', '').split('.')[0];
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return 'Fonte';
  }
}

function extractText(xml: string, tag: string): string | null {
  const cdataRegex = new RegExp(`<${tag}><!\\[CDATA\\[(.+?)\\]\\]></${tag}>`, 's');
  const simpleRegex = new RegExp(`<${tag}>(.+?)</${tag}>`, 's');
  
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();
  
  const simpleMatch = xml.match(simpleRegex);
  if (simpleMatch) return simpleMatch[1].trim();
  
  return null;
}

function extractSourceName(itemXml: string, title: string): string {
  const sourceMatch = itemXml.match(/<source[^>]*>([^<]+)<\/source>/);
  if (sourceMatch && sourceMatch[1].trim()) {
    return sourceMatch[1].trim();
  }
  
  const titleParts = title.split(' - ');
  if (titleParts.length >= 2) {
    return titleParts[titleParts.length - 1].trim();
  }
  
  const link = extractText(itemXml, 'link') || '';
  return extractSourceFromUrl(link);
}

function extractImage(itemXml: string): string | null {
  const description = extractText(itemXml, 'description');
  if (description) {
    const decoded = decodeHtmlEntities(description);
    const imgMatch = decoded.match(/<img[^>]*src="([^"]+)"/);
    if (imgMatch) {
      return imgMatch[1];
    }
  }
  return null;
}

function isValidImage(url: string | null): boolean {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('google.com') || urlLower.includes('gstatic.com')) return false;
  if (urlLower.includes('news.google')) return false;
  if (urlLower.includes('logo')) return false;
  if (urlLower.includes('placeholder')) return false;
  if (urlLower.includes('default')) return false;
  if (urlLower.includes('avatar')) return false;
  if (urlLower.includes('favicon')) return false;
  if (urlLower.includes('icon')) return false;
  if (!url.startsWith('https://')) return false;
  
  return true;
}

async function fetchArticleImageWithJina(url: string): Promise<string | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Return-Format': 'json'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.data?.image && isValidImage(data.data.image)) {
      return data.data.image;
    }
    
    if (data.image && isValidImage(data.image)) {
      return data.image;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      redirect: 'follow'
    });
    
    if (!response.ok) return null;
    
    const finalUrl = response.url;
    
    if (finalUrl.includes('news.google.com')) {
      const html = await response.text();
      const redirectPatterns = [
        /href="(https?:\/\/[^"]+)"[^>]*>(?:Click here|Continua a leggere)/i,
        /<a[^>]*href="(https?:\/\/(?!news\.google)[^"]+)"[^>]*>/i,
        /url=(https?:\/\/(?!news\.google)[^&"']+)/i
      ];
      
      for (const pattern of redirectPatterns) {
        const match = html.match(pattern);
        if (match && match[1] && !match[1].includes('google.com')) {
          const realUrl = decodeURIComponent(match[1]);
          try {
            const articleResponse = await fetch(realUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              redirect: 'follow'
            });
            if (articleResponse.ok) {
              const articleHtml = await articleResponse.text();
              const ogImage = extractOgImageFromHtml(articleHtml);
              if (ogImage) return ogImage;
            }
          } catch { }
        }
      }
      return null;
    }
    
    const html = await response.text();
    return extractOgImageFromHtml(html);
  } catch {
    return null;
  }
}

function extractOgImageFromHtml(html: string): string | null {
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch) return ogMatch[1];
  
  const ogMatchAlt = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogMatchAlt) return ogMatchAlt[1];
  
  const twitterMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
  if (twitterMatch) return twitterMatch[1];
  
  return null;
}

async function searchRelatedArticles(mainTitle: string): Promise<Array<{ title: string; source: string; link: string }>> {
  let cleanTitle = mainTitle.split(' - ')[0].trim();
  cleanTitle = cleanTitle.replace(/\bLIVE\b/gi, '').trim();
  const keywords = cleanTitle.split(' ').slice(0, 8).join(' ');
  
  const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keywords)}&hl=it&gl=IT&ceid=IT:it`;
  
  const response = await fetch(searchUrl, {
    headers: { 
      'User-Agent': 'Mozilla/5.0 (compatible; NoParrotBot/1.0)',
      'Accept': 'application/xml, text/xml, */*'
    }
  });
  
  if (!response.ok) return [];
  
  const text = await response.text();
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const items = text.match(itemRegex);
  
  if (!items || items.length === 0) return [];
  
  const articles: Array<{ title: string; source: string; link: string }> = [];
  const seenSources = new Set<string>();
  
  for (const itemXml of items.slice(0, 20)) {
    const title = extractText(itemXml, 'title');
    const link = extractText(itemXml, 'link');
    
    if (!title || !link) continue;
    if (isMetaNews(title)) continue;
    if (isMetaNewsUrl(link)) continue;
    
    const source = extractSourceName(itemXml, title);
    if (seenSources.has(source.toLowerCase())) continue;
    seenSources.add(source.toLowerCase());
    
    articles.push({ title, source, link });
    if (articles.length >= 8) break;
  }
  
  return articles;
}

// ============= MAIN STORY FETCHER WITH DEDUP =============

async function findValidNewsItem(
  supabase: any
): Promise<{
  mainTitle: string;
  articles: Array<{ title: string; source: string; link: string }>;
  imageUrl: string | null;
  classification: { topic_cluster: string; angle_tag: string; fingerprint: string };
} | null> {
  console.log('[Dedup] Starting intelligent news selection...');
  
  const lookbackTime = new Date(Date.now() - DEDUP_CONFIG.LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  
  // Fetch recent editorials with new columns
  const { data: recentEditorials } = await supabase
    .from('daily_focus')
    .select('id, title, summary, raw_title, topic_cluster, angle_tag, event_fingerprint, created_at')
    .gte('created_at', lookbackTime)
    .order('created_at', { ascending: false });
  
  console.log(`[Dedup] Found ${recentEditorials?.length || 0} editorials in last ${DEDUP_CONFIG.LOOKBACK_HOURS}h`);
  
  // Fetch RSS feed
  const rssUrl = 'https://news.google.com/rss?hl=it&gl=IT&ceid=IT:it';
  const response = await fetch(rssUrl, {
    headers: { 
      'User-Agent': 'Mozilla/5.0 (compatible; NoParrotBot/1.0)',
      'Accept': 'application/xml, text/xml, */*'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch RSS: ${response.statusText}`);
  }
  
  const text = await response.text();
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const items = text.match(itemRegex);
  
  if (!items || items.length === 0) {
    throw new Error('No articles in RSS feed');
  }
  
  console.log(`[Dedup] Checking ${items.length} RSS items...`);
  
  // Iterate through items with dedup checks
  for (let i = 0; i < Math.min(items.length, 15); i++) {
    const itemXml = items[i];
    const mainTitle = extractText(itemXml, 'title');
    const pubDate = extractText(itemXml, 'pubDate') || new Date().toISOString();
    
    if (!mainTitle) continue;
    
    // Skip meta-news
    if (isMetaNews(mainTitle)) {
      console.log(`[Dedup] SKIP meta-news: ${mainTitle.substring(0, 50)}...`);
      continue;
    }
    
    // 1. HARD DEDUP: event_fingerprint
    const fingerprint = generateEventFingerprint(mainTitle, pubDate);
    const fingerprintMatch = recentEditorials?.find(e => e.event_fingerprint === fingerprint);
    
    if (fingerprintMatch) {
      console.log(`[Dedup] SKIP (fingerprint match): ${mainTitle.substring(0, 50)}...`);
      continue;
    }
    
    // 2. SOFT DEDUP: semantic similarity
    const { maxSimilarity, matchedTitle } = await calculateSimilarity(mainTitle, recentEditorials || []);
    
    if (maxSimilarity >= DEDUP_CONFIG.SIMILARITY_HARD_THRESHOLD) {
      console.log(`[Dedup] SKIP (similarity ${maxSimilarity.toFixed(2)} >= ${DEDUP_CONFIG.SIMILARITY_HARD_THRESHOLD}): ${mainTitle.substring(0, 50)}... ~ "${matchedTitle}"`);
      continue;
    }
    
    // 3. ANGLE CHECK (for similarity 0.75-0.88)
    if (maxSimilarity >= DEDUP_CONFIG.SIMILARITY_SOFT_THRESHOLD) {
      console.log(`[Dedup] Soft match (${maxSimilarity.toFixed(2)}), checking topic/angle...`);
      
      const { topic_cluster, angle_tag } = await classifyTopicAndAngle(mainTitle);
      
      const sameClusterRecent = recentEditorials?.filter(e => 
        e.topic_cluster === topic_cluster
      ) || [];
      
      if (sameClusterRecent.length > 0) {
        // Check if angle is different
        const sameAngle = sameClusterRecent.find(e => e.angle_tag === angle_tag);
        if (sameAngle) {
          console.log(`[Dedup] SKIP (same cluster "${topic_cluster}" + angle "${angle_tag}"): ${mainTitle.substring(0, 50)}...`);
          continue;
        }
        
        // Check 24h quota (max 2 per cluster)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const clusterCount24h = sameClusterRecent.filter(e => 
          new Date(e.created_at) > new Date(twentyFourHoursAgo)
        ).length;
        
        if (clusterCount24h >= DEDUP_CONFIG.CLUSTER_QUOTA_24H) {
          console.log(`[Dedup] SKIP (cluster quota ${clusterCount24h}/${DEDUP_CONFIG.CLUSTER_QUOTA_24H} for "${topic_cluster}"): ${mainTitle.substring(0, 50)}...`);
          continue;
        }
        
        console.log(`[Dedup] ✅ PASS (same cluster but different angle "${angle_tag}"): ${mainTitle.substring(0, 50)}...`);
      }
      
      // Fetch related articles and return
      const imageUrl = extractImage(itemXml);
      const relatedArticles = await searchRelatedArticles(mainTitle);
      
      if (relatedArticles.length === 0) {
        const mainLink = extractText(itemXml, 'link') || '';
        const mainSource = extractSourceName(itemXml, mainTitle);
        return {
          mainTitle,
          articles: [{ title: mainTitle, source: mainSource, link: mainLink }],
          imageUrl,
          classification: { topic_cluster, angle_tag, fingerprint }
        };
      }
      
      return {
        mainTitle,
        articles: relatedArticles,
        imageUrl,
        classification: { topic_cluster, angle_tag, fingerprint }
      };
    }
    
    // 4. LOW SIMILARITY - classify and proceed
    console.log(`[Dedup] ✅ PASS (low similarity ${maxSimilarity.toFixed(2)}): ${mainTitle.substring(0, 50)}...`);
    
    const { topic_cluster, angle_tag } = await classifyTopicAndAngle(mainTitle);
    const imageUrl = extractImage(itemXml);
    const relatedArticles = await searchRelatedArticles(mainTitle);
    
    if (relatedArticles.length === 0) {
      const mainLink = extractText(itemXml, 'link') || '';
      const mainSource = extractSourceName(itemXml, mainTitle);
      return {
        mainTitle,
        articles: [{ title: mainTitle, source: mainSource, link: mainLink }],
        imageUrl,
        classification: { topic_cluster, angle_tag, fingerprint }
      };
    }
    
    return {
      mainTitle,
      articles: relatedArticles,
      imageUrl,
      classification: { topic_cluster, angle_tag, fingerprint }
    };
  }
  
  console.log('[Dedup] No valid item found after checking all candidates');
  return null;
}

// ============= SOURCE VALIDATION =============

function validateAndFixSources(deepContent: string, maxSourceIndex: number): string {
  if (!deepContent) return '';
  
  const paragraphs = deepContent.split(/\n\n+/).filter(p => p.trim());
  
  const fixedParagraphs = paragraphs.map((paragraph, idx) => {
    const trimmed = paragraph.trim();
    const hasSourceAtEnd = /\[SOURCE:\d+\](\s*\[SOURCE:\d+\])*\s*$/.test(trimmed);
    
    if (!hasSourceAtEnd) {
      return `${trimmed} [SOURCE:0]`;
    }
    
    const sourceMatches = trimmed.match(/\[SOURCE:(\d+)\]/g);
    if (sourceMatches) {
      const invalidIndices = sourceMatches
        .map(m => parseInt(m.match(/\d+/)![0]))
        .filter(index => index >= maxSourceIndex);
      
      if (invalidIndices.length > 0) {
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

function cleanTitle(title: string, sources: Array<{ source: string }>): string {
  let cleaned = title;
  cleaned = cleaned.replace(/\s*[-–—]\s*[^-–—]{3,50}$/i, '').trim();
  
  const sourceNames = sources.map(s => s.source.toLowerCase());
  for (const name of sourceNames) {
    const regex = new RegExp(`\\s*[-–—]?\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'gi');
    cleaned = cleaned.replace(regex, '').trim();
  }
  
  cleaned = cleaned.replace(/\s*[-–—]\s*(secondo|riporta|fonte|via)\s+.+$/i, '').trim();
  
  return cleaned || title;
}

// ============= AI SYNTHESIS =============

async function synthesizeWithAI(
  mainTitle: string,
  articles: Array<{ title: string; source: string; link: string }>,
  recentEditorials?: Array<{ title: string; topic_cluster?: string; angle_tag?: string }>
): Promise<{ title: string; summary: string; deep_content: string }> {
  console.log('Synthesizing story with AI');
  
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }
  
  // Build recent context to avoid duplicates
  const recentContext = recentEditorials?.slice(0, 5).map(e => 
    `- "${e.title}" (${e.topic_cluster || '?'}/${e.angle_tag || '?'})`
  ).join('\n') || 'Nessuno';
  
  const prompt = `EVENTO DA ANALIZZARE:
${mainTitle}

FONTI DISPONIBILI (usale per informarti, NON per citarle esplicitamente nel testo):
${articles.map((a, idx) => `[${idx}] ${a.source}: "${a.title}"`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ EDITORIALI RECENTI (ultime 48h) - NON ripetere questi temi/angoli:
${recentContext}

Se la notizia riguarda lo stesso tema di uno recente, DEVI proporre un angolo DIVERSO.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 APPROCCIO ANALITICO:
Quando analizzi questa notizia, chiediti:
- Cosa rivela questo fatto?
- Quali equilibri sposta?
- Cosa significa per chi non è direttamente coinvolto?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⛔ ASSOLUTAMENTE VIETATO:
1. MAI citare nomi di testate nel titolo
2. MAI usare "Secondo [fonte]...", "[Testata] riporta che..."
3. MAI scrivere "Sintesi automatica" o simili
4. MAI elencare cosa dice ogni singola fonte separatamente
5. MAI creare elenchi puntati o liste
6. MAI esprimere giudizi morali o politici
7. MAI schierarti

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ COSA DEVI FARE:

1. TITOLO (max 60 caratteri TASSATIVI):
   - NON cronaca - SOLO analisi strutturale
   - Formula: [Soggetto/Contesto]: [insight o dinamica rivelata]
   
2. SUMMARY (400-500 caratteri):
   - Lead giornalistico in terza persona
   - NESSUN marker [SOURCE:N]
   
3. DEEP_CONTENT (1500-2000 caratteri):
   - Analisi STRUTTURALE, non cronaca
   - Stile editoriale distaccato
   - Marker [SOURCE:N] SOLO alla fine di ogni paragrafo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ REGOLE MARKER [SOURCE:N]:
- Indici validi: 0 a ${articles.length - 1}
- Formato: [SOURCE:0] [SOURCE:1]
- Posizione: SOLO fine paragrafo

Rispondi SOLO con JSON valido:
{
  "title": "Titolo originale SENZA nome testata",
  "summary": "Lead che evidenzia cosa rivela il fatto",
  "deep_content": "Analisi strutturale con marker a fine paragrafo"
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
            content: `Sei IL PUNTO ◉.
Non sei un opinionista, non sei un commentatore.
Sei una lente editoriale che mette a fuoco cosa sta succedendo nel mondo.

Il tuo compito NON è dire cosa è giusto o sbagliato.
Il tuo compito è spiegare cosa un evento rivela sulle dinamiche, sugli equilibri, sui rapporti di forza.

Il Punto non prende posizione. Il Punto mette a fuoco.

Il tuo stile è: editoriale, lucido, analitico, distaccato, strutturale.

IMPORTANTE PER IL TITOLO:
- NON stai scrivendo per un'agenzia di stampa
- Stai scrivendo l'intestazione di un'ANALISI (max 60 caratteri)

Rispondi SOLO con JSON valido.`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 3000
      }),
    });

    if (!response.ok) {
      throw new Error(`AI synthesis failed: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from AI response');
    }
    
    const result = JSON.parse(jsonMatch[0]);
    const cleanedTitle = cleanTitle(result.title, articles);
    const fixedDeepContent = validateAndFixSources(result.deep_content, articles.length);
    
    return {
      title: cleanedTitle,
      summary: result.summary,
      deep_content: fixedDeepContent
    };
  } catch (error) {
    console.error('AI synthesis error:', error);
    
    const cleanedMainTitle = mainTitle.replace(/\s*[-–—]\s*[^-–—]+$/, '').trim();
    return {
      title: cleanedMainTitle,
      summary: `${cleanedMainTitle}. Una notizia seguita da ${articles.length} testate nazionali e internazionali.`,
      deep_content: `${cleanedMainTitle}\n\nI principali sviluppi della notizia secondo le fonti disponibili.\n\n${articles.slice(0, 3).map((a, idx) => `${a.title.replace(/\s*[-–—]\s*[^-–—]+$/, '')} [SOURCE:${idx}]`).join('\n\n')}`
    };
  }
}

// ============= MAIN SERVER =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('fetch-daily-focus invoked');
    
    let scheduled = false;
    let edition_time: string | null = null;
    try {
      const body = await req.json();
      scheduled = body?.scheduled === true;
      edition_time = body?.edition_time || null;
    } catch { }
    
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
    
    // For non-scheduled runs, return cached content
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
    
    // Find valid news item with intelligent dedup
    console.log('Finding valid news item with intelligent dedup...');
    const validItem = await findValidNewsItem(supabase);
    
    if (!validItem) {
      console.log('No valid news found, creating fallback');
      const fallback = {
        id: crypto.randomUUID(),
        title: 'Nessuna notizia disponibile',
        summary: 'Al momento non ci sono notizie disponibili che non siano già state trattate. Riprova più tardi.',
        deep_content: 'Nessun contenuto disponibile.',
        sources: [{ icon: '📰', name: 'Google News', url: '' }],
        trust_score: 'Medio' as const,
        reactions: { likes: 0, comments: 0, shares: 0 },
        image_url: null,
        raw_title: null,
        topic_cluster: null,
        angle_tag: null,
        event_fingerprint: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      
      await supabase.from('daily_focus').insert(fallback);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const { mainTitle, articles, imageUrl: rssImageUrl, classification } = validItem;
    
    // Fetch recent editorials for AI context
    const lookbackTime = new Date(Date.now() - DEDUP_CONFIG.LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
    const { data: recentForContext } = await supabase
      .from('daily_focus')
      .select('title, topic_cluster, angle_tag')
      .gte('created_at', lookbackTime)
      .order('created_at', { ascending: false })
      .limit(5);
    
    // Synthesize with AI (pass recent context)
    const { title, summary, deep_content } = await synthesizeWithAI(mainTitle, articles, recentForContext || []);
    
    // Image handling
    let finalImageUrl = isValidImage(rssImageUrl) ? rssImageUrl : null;
    
    if (!finalImageUrl && articles.length > 0) {
      for (let i = 0; i < Math.min(4, articles.length); i++) {
        const article = articles[i];
        if (!article.link) continue;
        
        const realUrl = article.link.includes('news.google.com') 
          ? decodeGoogleNewsUrl(article.link) 
          : article.link;
        
        if (!realUrl && article.link.includes('news.google.com')) {
          const jinaImage = await fetchArticleImageWithJina(article.link);
          if (jinaImage) {
            finalImageUrl = jinaImage;
            break;
          }
          continue;
        }
        
        if (!realUrl) continue;
        
        const jinaImage = await fetchArticleImageWithJina(realUrl);
        if (jinaImage) {
          finalImageUrl = jinaImage;
          break;
        }
      }
    }
    
    // Format sources
    const sources = articles.slice(0, 5).map(a => ({
      icon: '📰',
      name: a.source,
      url: a.link
    }));
    
    // Create daily focus record with dedup metadata
    const dailyFocus = {
      id: crypto.randomUUID(),
      title,
      summary,
      deep_content,
      sources,
      trust_score: 'Alto' as const,
      reactions: { likes: 0, comments: 0, shares: 0 },
      image_url: finalImageUrl,
      edition_time,
      raw_title: mainTitle,
      topic_cluster: classification.topic_cluster,
      angle_tag: classification.angle_tag,
      event_fingerprint: classification.fingerprint,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    };
    
    // Store in database
    const { error: insertError } = await supabase
      .from('daily_focus')
      .insert(dailyFocus);
    
    if (insertError) {
      console.error('Error inserting daily focus:', insertError);
      throw insertError;
    }
    
    console.log(`Daily focus created: "${title}" [${classification.topic_cluster}/${classification.angle_tag}]`);
    
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

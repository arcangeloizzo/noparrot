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

// Validate image URL (exclude Google News placeholders and logos)
function isValidImage(url: string | null): boolean {
  if (!url) return false;
  if (url.includes('google.com') || url.includes('gstatic.com')) return false;
  if (url.includes('news.google')) return false;
  if (url.toLowerCase().includes('logo')) return false;
  return true;
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
  // Limit to first 6 keywords for broader search
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
  
  // Extract up to 8 articles from different sources
  const articles: Array<{ title: string; source: string; link: string }> = [];
  const seenSources = new Set<string>();
  
  for (const itemXml of items.slice(0, 15)) { // Check first 15 to get 8 unique sources
    const title = extractText(itemXml, 'title');
    const link = extractText(itemXml, 'link');
    
    if (!title || !link) continue;
    
    const source = extractSourceName(itemXml, title);
    
    // Skip duplicates from same source
    if (seenSources.has(source.toLowerCase())) continue;
    seenSources.add(source.toLowerCase());
    
    articles.push({ title, source, link });
    
    if (articles.length >= 8) break;
  }
  
  console.log(`Found ${articles.length} unique sources for this story`);
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
  
  // Extract first item (top headline)
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const items = text.match(itemRegex);
  
  if (!items || items.length === 0) {
    throw new Error('No articles found in RSS feed');
  }
  
  const firstItemXml = items[0];
  
  // Extract main title and image
  const mainTitle = extractText(firstItemXml, 'title');
  if (!mainTitle) {
    throw new Error('Could not extract main title from top story');
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
  
  const prompt = `Sei un giornalista esperto che deve sintetizzare una notizia da fonti multiple.

TITOLO PRINCIPALE: ${mainTitle}

FONTI DISPONIBILI:
${articles.map((a, idx) => `[${idx}] ${a.source}: "${a.title}"`).join('\n')}

Il tuo compito è creare:
1. Un TITOLO FINALE chiaro e conciso (max 80 caratteri)
2. Un SUMMARY per la card (400-500 caratteri, SENZA marker [SOURCE:N])
3. Un APPROFONDIMENTO ESTESO (deep_content) di 1500-2000 caratteri con:
   - Spiegazione dettagliata di cosa è successo
   - Contesto storico/politico quando rilevante
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
    
    return {
      title: result.title,
      summary: result.summary,
      deep_content: result.deep_content
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
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Check cache (valid for 24 hours)
    const { data: cached } = await supabase
      .from('daily_focus')
      .select('*')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (cached) {
      console.log('Returning cached daily focus');
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
    
    // 3. Synthesize with AI
    const { title, summary, deep_content } = await synthesizeWithAI(mainTitle, articles);
    
    // 4. Image handling with strict validation
    let finalImageUrl = isValidImage(rssImageUrl) ? rssImageUrl : null;
    
    // Try OG fetch only if we don't have a valid image
    if (!finalImageUrl && articles.length > 0 && articles[0].link) {
      console.log('[fetch-daily-focus] No valid RSS image, attempting OG fetch from:', articles[0].link);
      const ogImage = await fetchOgImage(articles[0].link);
      finalImageUrl = isValidImage(ogImage) ? ogImage : null;
    }
    
    // Always ensure we have a fallback image
    if (!finalImageUrl) {
      console.log('[fetch-daily-focus] No valid image found, using default fallback');
      const FALLBACK_IMAGES: Record<string, string> = {
        'default': 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&h=400&fit=crop'
      };
      finalImageUrl = FALLBACK_IMAGES['default'];
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
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
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
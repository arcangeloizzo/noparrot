import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  // Google News puts images in <description> as HTML
  const description = extractText(itemXml, 'description');
  if (description) {
    const imgMatch = description.match(/<img[^>]*src="([^"]+)"/);
    if (imgMatch) {
      console.log('Image found in description:', imgMatch[1]);
      return imgMatch[1];
    }
  }
  
  // Fallback: check media:content
  const mediaMatch = itemXml.match(/<media:content[^>]*url="([^"]+)"/);
  if (mediaMatch) return mediaMatch[1];
  
  // Fallback: check enclosure
  const enclosureMatch = itemXml.match(/<enclosure[^>]*url="([^"]+)"/);
  if (enclosureMatch) return enclosureMatch[1];
  
  console.log('No image found in RSS item');
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
  articles: Array<{ title: string; source: string }>
): Promise<{ title: string; summary: string }> {
  console.log('Synthesizing story with AI');
  
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }
  
  const prompt = `Analizza questi articoli che parlano della STESSA NOTIZIA da fonti giornalistiche diverse.

NOTIZIA PRINCIPALE:
"${mainTitle}"

COPERTURA DA DIVERSE FONTI:
${articles.map((a, i) => `${i + 1}. ${a.source}: "${a.title}"`).join('\n')}

ISTRUZIONI RIGOROSE:
1. Questa è UNA SOLA notizia vista da prospettive diverse
2. NON mescolare storie diverse - concentrati SOLO sul fatto principale
3. Il titolo deve essere chiaro e specifico sul singolo evento
4. Il summary deve essere informativo e completo: spiega cosa è successo, chi è coinvolto, il contesto, perché è importante e quali sono le implicazioni. Fornisci dettagli sufficienti per comprendere la notizia senza dover leggere le fonti (400-600 caratteri).
5. Evita elencazioni di fatti diversi - è UN SOLO EVENTO

Rispondi SOLO con JSON (nessun testo extra):
{
  "title": "Titolo specifico del singolo evento (max 50 caratteri)",
  "summary": "Spiegazione completa: cosa è successo, chi è coinvolto, contesto, perché è importante, implicazioni (400-600 caratteri)"
}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 800
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
    summary: result.summary
  };
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
    const { mainTitle, articles, imageUrl } = await fetchTopStoryWithMultiSourceCoverage();
    
    if (articles.length === 0) {
      console.log('No articles found, using fallback');
      const fallback = {
        id: crypto.randomUUID(),
        title: 'Nessuna notizia disponibile',
        summary: 'Al momento non ci sono notizie disponibili. Riprova più tardi.',
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
    const { title, summary } = await synthesizeWithAI(mainTitle, articles);
    
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
      sources,
      trust_score: 'Alto' as const, // Multi-source = higher trust
      reactions: { likes: 0, comments: 0, shares: 0 },
      image_url: imageUrl,
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

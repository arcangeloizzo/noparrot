import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Extract source name from RSS item (prioritize <source> tag, then parse from title)
function extractSourceName(itemXml: string, title: string): string {
  // Try <source> tag first
  const sourceTag = extractText(itemXml, 'source');
  if (sourceTag && sourceTag.trim() !== '') {
    console.log('Extracted source from <source> tag:', sourceTag);
    return sourceTag.trim();
  }
  
  // Fallback: parse from title (format "Title - Source")
  const titleParts = title.split(' - ');
  if (titleParts.length >= 2) {
    const possibleSource = titleParts[titleParts.length - 1].trim();
    console.log('Extracted source from title:', possibleSource);
    return possibleSource;
  }
  
  // Last fallback: use URL
  const link = extractText(itemXml, 'link') || '';
  return extractSourceFromUrl(link);
}

// Extract image from RSS item
function extractImage(itemXml: string): string | null {
  // Try <media:content> tag (most common in Google News)
  const mediaMatch = itemXml.match(/<media:content[^>]*url="([^"]+)"/);
  if (mediaMatch) return mediaMatch[1];
  
  // Try <enclosure> tag
  const enclosureMatch = itemXml.match(/<enclosure[^>]*url="([^"]+)"/);
  if (enclosureMatch) return enclosureMatch[1];
  
  // Try og:image from description HTML
  const imgMatch = itemXml.match(/<img[^>]*src="([^"]+)"/);
  if (imgMatch) return imgMatch[1];
  
  return null;
}

// Search for related articles about the same story using Google News search
async function searchRelatedArticles(mainTitle: string): Promise<Array<{ title: string; source: string; link: string }>> {
  console.log('Searching for related articles:', mainTitle);
  
  // Clean title for search (remove source name if present)
  const cleanTitle = mainTitle.split(' - ')[0].trim();
  const searchQuery = encodeURIComponent(cleanTitle);
  const searchUrl = `https://news.google.com/rss/search?q=${searchQuery}&hl=it&gl=IT&ceid=IT:it`;
  
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
  
  // Extract first item (top headline for this category)
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const items = text.match(itemRegex);
  
  if (!items || items.length === 0) {
    throw new Error('No articles found in category RSS feed');
  }
  
  const firstItemXml = items[0];
  
  // Extract main title and image
  const mainTitle = extractText(firstItemXml, 'title');
  if (!mainTitle) {
    throw new Error('Could not extract main title from top story');
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

// Synthesize articles about the SAME story for a specific category
async function synthesizeForCategory(
  category: string,
  mainTitle: string,
  articles: Array<{ title: string; source: string }>
): Promise<{ title: string; summary: string }> {
  console.log(`Synthesizing story for category: ${category}`);
  
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }
  
  const prompt = `Analizza questi articoli di ${category} che parlano della STESSA NOTIZIA da fonti diverse.

NOTIZIA PRINCIPALE:
"${mainTitle}"

COPERTURA DA DIVERSE FONTI:
${articles.map((a, i) => `${i + 1}. ${a.source}: "${a.title}"`).join('\n')}

ISTRUZIONI RIGOROSE:
1. Questa è UNA SOLA notizia di ${category} vista da prospettive diverse
2. NON mescolare storie diverse - concentrati SOLO sul fatto principale
3. Il titolo deve essere chiaro e specifico sul singolo evento
4. Il summary deve essere informativo e completo: spiega cosa è successo, chi è coinvolto, il contesto, perché è importante per ${category}, e quali sono le implicazioni. Fornisci dettagli sufficienti per comprendere la notizia senza dover leggere le fonti (400-600 caratteri).
5. Mantieni il focus sulla categoria ${category}

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
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { category } = await req.json();
    console.log(`fetch-interest-focus invoked for category: ${category}`);
    
    if (!category) {
      throw new Error('Category is required');
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Check cache (valid for 12 hours)
    const { data: cached } = await supabase
      .from('interest_focus')
      .select('*')
      .eq('category', category)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (cached) {
      console.log(`Returning cached interest focus for ${category}`);
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // 2. Fetch fresh data using multi-source search
    console.log(`Fetching fresh interest focus for ${category}...`);
    const { mainTitle, articles, imageUrl } = await fetchTopCategoryStoryWithMultiSourceCoverage(category);
    
    if (articles.length === 0) {
      console.log('No articles found, using fallback');
      const fallback = {
        id: crypto.randomUUID(),
        category,
        title: `Nessuna notizia di ${category}`,
        summary: 'Al momento non ci sono notizie disponibili per questa categoria.',
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
    const { title, summary } = await synthesizeForCategory(category, mainTitle, articles);
    
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
      sources,
      trust_score: 'Alto' as const, // Multi-source = higher trust
      reactions: { likes: 0, comments: 0, shares: 0 },
      image_url: imageUrl,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    };
    
    // 6. Store in database
    const { error: insertError } = await supabase
      .from('interest_focus')
      .insert(interestFocus);
    
    if (insertError) {
      console.error('Error inserting interest focus:', insertError);
      throw insertError;
    }
    
    console.log(`Interest focus created successfully for ${category}`);
    
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
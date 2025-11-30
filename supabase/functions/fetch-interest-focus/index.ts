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
  'Società & Politica': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFZ4ZERBU0FtbDBHZ0pKVkNnQVAB',
  'Salute': 'CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtbDBLQUFQAQ',
  'Economia': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6YUdFU0FtbDBHZ0pKVkNnQVAB',
  'Sport': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtbDBHZ0pKVkNnQVAB',
  'Intrattenimento': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtbDBHZ0pKVkNnQVAB'
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

// Parse clustered articles from Google News description HTML
function parseClusteredArticles(html: string): Array<{ title: string; source: string; link: string }> {
  console.log('Parsing clustered articles from HTML description');
  const articles: Array<{ title: string; source: string; link: string }> = [];
  
  // Split by <li> tags for cleaner parsing
  const listItems = html.split(/<li[^>]*>/i);
  
  for (const item of listItems) {
    // Extract link and title: <a href="URL">Title</a>
    const linkMatch = item.match(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
    if (!linkMatch) continue;
    
    // Extract source from <font color="#6f6f6f">Source Name</font>
    const sourceMatch = item.match(/<font[^>]*color="#6f6f6f"[^>]*>([^<]+)<\/font>/i);
    
    articles.push({
      link: linkMatch[1],
      title: linkMatch[2].replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim(),
      source: sourceMatch ? sourceMatch[1].trim() : extractSourceFromUrl(linkMatch[1])
    });
  }
  
  console.log(`Found ${articles.length} clustered articles`);
  return articles;
}

// Fetch top story for category with clustered sources
async function fetchTopCategoryStoryWithClusteredSources(
  category: string
): Promise<{
  mainTitle: string;
  articles: Array<{ title: string; source: string; link: string }>;
}> {
  console.log(`Fetching top story for category: ${category}`);
  
  const topicId = CATEGORY_TOPIC_IDS[category];
  if (!topicId) {
    throw new Error(`Category not mapped: ${category}`);
  }
  
  const rssUrl = `https://news.google.com/rss/topics/${topicId}?hl=it&gl=IT&ceid=IT:it`;
  
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
  
  // Extract main title
  const mainTitle = extractText(firstItemXml, 'title');
  if (!mainTitle) {
    throw new Error('Could not extract main title from top story');
  }
  
  console.log('Top headline for category:', mainTitle);
  
  // Extract main link
  const mainLink = extractText(firstItemXml, 'link') || '';
  
  // Extract description which contains HTML with clustered articles
  const description = extractText(firstItemXml, 'description');
  if (!description) {
    console.log('No description found, using only main article');
    return {
      mainTitle,
      articles: [{
        title: mainTitle,
        source: 'Google News',
        link: mainLink
      }]
    };
  }
  
  // Parse clustered articles from description HTML
  const clusteredArticles = parseClusteredArticles(description);
  
  // Add main article as first source
  const articles = [
    { title: mainTitle, source: 'Fonte principale', link: mainLink },
    ...clusteredArticles.slice(0, 4) // Take up to 4 additional sources
  ];
  
  console.log(`Total articles about this story: ${articles.length}`);
  
  return { mainTitle, articles };
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
4. Il summary deve spiegare il fatto centrale in modo oggettivo e sintetico
5. Mantieni il focus sulla categoria ${category}

Rispondi SOLO con JSON (nessun testo extra):
{
  "title": "Titolo specifico del singolo evento (max 50 caratteri)",
  "summary": "Cosa è successo, chi è coinvolto, perché è importante - UN SOLO FATTO (max 250 caratteri)"
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
      max_tokens: 500
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
    
    // 2. Fetch fresh data using clustering
    console.log(`Fetching fresh interest focus for ${category}...`);
    const { mainTitle, articles } = await fetchTopCategoryStoryWithClusteredSources(category);
    
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
    
    // 4. Format sources
    const sources = articles.slice(0, 3).map(a => ({
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

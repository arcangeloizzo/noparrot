import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

// Parse clustered articles from Google News description HTML
function parseClusteredArticles(html: string): Array<{ title: string; source: string; link: string }> {
  console.log('Parsing clustered articles from HTML description');
  const articles: Array<{ title: string; source: string; link: string }> = [];
  
  // Google News description format: <a href="URL">Title</a>&nbsp;&nbsp;<font color="#6f6f6f">Source</font>
  const articleRegex = /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>(?:&nbsp;)*(?:<font[^>]*>([^<]+)<\/font>)?/gi;
  
  let match;
  while ((match = articleRegex.exec(html)) !== null) {
    const link = match[1];
    const title = match[2].replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
    const source = match[3]?.trim() || 'Fonte';
    
    articles.push({ title, source, link });
  }
  
  console.log(`Found ${articles.length} clustered articles`);
  return articles;
}

// Fetch top story with clustered sources from Google News
async function fetchTopStoryWithClusteredSources(): Promise<{
  mainTitle: string;
  articles: Array<{ title: string; source: string; link: string }>;
}> {
  console.log('Fetching top story with clustered sources from Google News');
  
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
  
  // Extract main title
  const mainTitle = extractText(firstItemXml, 'title');
  if (!mainTitle) {
    throw new Error('Could not extract main title from top story');
  }
  
  console.log('Top headline:', mainTitle);
  
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
4. Il summary deve spiegare il fatto centrale in modo oggettivo e sintetico
5. Evita elencazioni di fatti diversi - è UN SOLO EVENTO

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
    
    // 2. Fetch fresh data using clustering
    console.log('Fetching fresh daily focus with clustering...');
    const { mainTitle, articles } = await fetchTopStoryWithClusteredSources();
    
    if (articles.length === 0) {
      console.log('No articles found, using fallback');
      const fallback = {
        id: crypto.randomUUID(),
        title: 'Nessuna notizia disponibile',
        summary: 'Al momento non ci sono notizie disponibili. Riprova più tardi.',
        sources: [{ icon: '📰', name: 'Google News', url: '' }],
        trust_score: 'Medio' as const,
        reactions: { likes: 0, comments: 0, shares: 0 },
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
    
    // 4. Format sources
    const sources = articles.slice(0, 3).map(a => ({
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

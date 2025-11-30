import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper per estrarre testo da XML (gestisce CDATA e testo semplice)
function extractText(xml: string, tag: string): string | null {
  // Prima prova formato CDATA: <tag><![CDATA[content]]></tag>
  const cdataRegex = new RegExp(`<${tag}><!\\[CDATA\\[([^\\]]*?)\\]\\]><\\/${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1];
  
  // Poi prova formato semplice: <tag>content</tag>
  const simpleRegex = new RegExp(`<${tag}>([^<]*?)<\\/${tag}>`, 'i');
  const simpleMatch = xml.match(simpleRegex);
  if (simpleMatch) return simpleMatch[1];
  
  return null;
}

// Estrae keywords da un titolo per la ricerca
function extractKeywords(title: string): string {
  // Rimuovi articoli, preposizioni comuni e caratteri speciali
  const stopWords = ['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'da', 'a', 'in', 'con', 'su', 'per', 'tra', 'fra', 'e', 'o'];
  const words = title.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.includes(w));
  
  // Prendi le prime 3-4 parole più significative
  return words.slice(0, 4).join(' ');
}

// Cerca articoli su Google News per una specifica query
async function searchGoogleNews(query: string, maxResults = 5) {
  const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=it&gl=IT&ceid=IT:it`;
  
  console.log('Searching Google News:', searchUrl);
  
  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NoParrotBot/1.0)'
    }
  });
  
  if (!response.ok) {
    console.error('Search failed:', response.status, response.statusText);
    throw new Error(`Search failed: ${response.status}`);
  }
  
  const text = await response.text();
  const items: Array<{ title: string; description: string; link: string; source: string }> = [];
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const matches = text.matchAll(itemRegex);
  
  // Traccia fonti già viste per garantire diversità
  const seenSources = new Set<string>();
  
  for (const match of matches) {
    const itemXml = match[1];
    const title = extractText(itemXml, 'title');
    const description = extractText(itemXml, 'description');
    const link = extractText(itemXml, 'link');
    const source = extractText(itemXml, 'source');
    
    if (title && link && source) {
      const sourceKey = source.split(' - ')[0].toLowerCase();
      
      // Prendi solo una notizia per fonte per garantire diversità
      if (!seenSources.has(sourceKey)) {
        items.push({
          title,
          description: description || '',
          link,
          source
        });
        seenSources.add(sourceKey);
      }
    }
    
    if (items.length >= maxResults) break;
  }
  
  console.log('Found articles from different sources:', items.length);
  return items;
}

// Recupera la notizia più importante e trova articoli correlati da fonti diverse
async function fetchTopStoryWithMultipleSources() {
  // 1. Prendi la top headline
  const rssUrl = 'https://news.google.com/rss?topic=WORLD&hl=it&gl=IT&ceid=IT:it';
  
  console.log('Fetching top headline from:', rssUrl);
  
  const response = await fetch(rssUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NoParrotBot/1.0)'
    }
  });
  
  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`);
  }
  
  const text = await response.text();
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const match = text.match(itemRegex);
  
  if (!match || match.length === 0) {
    throw new Error('No top headline found');
  }
  
  // Estrai la prima notizia
  const firstItemXml = match[0];
  const topTitle = extractText(firstItemXml, 'title');
  
  if (!topTitle) {
    throw new Error('Could not extract top headline title');
  }
  
  console.log('Top headline:', topTitle);
  
  // 2. Estrai keywords e cerca articoli correlati
  const keywords = extractKeywords(topTitle);
  console.log('Search keywords:', keywords);
  
  const relatedArticles = await searchGoogleNews(keywords, 5);
  
  if (relatedArticles.length === 0) {
    throw new Error('No related articles found');
  }
  
  return relatedArticles;
}

// Sintetizza con Lovable AI stile Perplexity: analizza diverse fonti sulla stessa notizia
async function synthesizeWithAI(articles: Array<{ title: string; description: string; source: string }>) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  const prompt = `Sei un giornalista investigativo esperto. Analizza questi ${articles.length} articoli che parlano della STESSA notizia da fonti diverse e crea una sintesi autorevole in stile Perplexity.

ARTICOLI DA FONTI DIVERSE:
${articles.map((a, i) => `
Fonte ${i + 1}: ${a.source}
Titolo: ${a.title}
${a.description ? `Descrizione: ${a.description}` : ''}
`).join('\n')}

ISTRUZIONI:
1. Identifica il FATTO CENTRALE comune a tutti gli articoli
2. Analizza come le diverse fonti presentano la notizia
3. Evidenzia eventuali prospettive o dettagli unici da ciascuna fonte
4. Crea una sintesi che integri tutte le prospettive in modo coerente

Rispondi SOLO con un oggetto JSON (nessun testo aggiuntivo):
{
  "title": "Titolo chiaro e diretto del fatto principale (max 60 caratteri)",
  "summary": "Sintesi della notizia che integra le prospettive delle diverse fonti, evidenziando il fatto centrale e le sfumature importanti (max 280 caratteri)"
}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  
  // Parse JSON dalla risposta
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid AI response format');
  
  return JSON.parse(jsonMatch[0]);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check cache (valido per 24 ore)
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch top story con articoli da fonti multiple
    console.log('Fetching top story from multiple sources...');
    let articles;
    try {
      articles = await fetchTopStoryWithMultipleSources();
    } catch (error) {
      console.error('Multi-source fetch error:', error);
      articles = [];
    }
    
    if (articles.length === 0) {
      console.log('No articles found, using fallback');
      // Fallback graceful
      const fallbackFocus = {
        title: "Resta informato con NoParrot",
        summary: "Segui le discussioni della community per restare aggiornato sulle notizie del giorno.",
        sources: [{ icon: "🗞️", name: "NoParrot" }],
        trust_score: 'Medio',
        category: 'Mondo',
        reactions: { likes: 0, comments: 0, shares: 0 }
      };
      
      const { data: newFocus, error } = await supabase
        .from('daily_focus')
        .insert(fallbackFocus)
        .select()
        .single();

      if (error) throw error;
      
      return new Response(JSON.stringify(newFocus), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Sintetizza con AI stile Perplexity
    console.log(`Synthesizing ${articles.length} articles from different sources with AI...`);
    const { title, summary } = await synthesizeWithAI(articles);

    // 4. Prepara sources da fonti diverse
    const sources = articles.slice(0, 3).map((a, i) => ({
      icon: ['📰', '📄', '🗞️'][i],
      name: a.source.split(' - ')[0].substring(0, 25),
      url: a.link
    }));

    // 5. Salva nel database
    const { data: newFocus, error } = await supabase
      .from('daily_focus')
      .insert({
        title,
        summary,
        sources,
        trust_score: 'Alto',
        category: 'Mondo',
        reactions: { likes: 0, comments: 0, shares: 0 }
      })
      .select()
      .single();

    if (error) throw error;

    console.log('Daily focus created successfully:', newFocus.id);

    return new Response(JSON.stringify(newFocus), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-daily-focus:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

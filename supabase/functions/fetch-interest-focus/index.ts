import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapping categorie NoParrot → RSS topics Google News
const CATEGORY_TO_RSS: Record<string, string> = {
  'Società & Politica': 'NATION',
  'Economia & Business': 'BUSINESS',
  'Scienza & Tecnologia': 'TECHNOLOGY',
  'Cultura & Arte': 'ENTERTAINMENT',
  'Pianeta & Ambiente': 'SCIENCE',
  'Sport & Lifestyle': 'SPORTS',
  'Salute & Benessere': 'HEALTH',
  'Media & Comunicazione': 'TECHNOLOGY'
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

// Fetch category-specific RSS
async function fetchCategoryRSS(category: string) {
  const rssTopic = CATEGORY_TO_RSS[category] || 'TECHNOLOGY';
  const rssUrl = `https://news.google.com/rss?topic=${rssTopic}&hl=it&gl=IT&ceid=IT:it`;
  
  console.log(`Fetching RSS for ${category} from:`, rssUrl);
  
  const response = await fetch(rssUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NoParrotBot/1.0)'
    }
  });
  
  if (!response.ok) {
    console.error('RSS fetch failed:', response.status, response.statusText);
    throw new Error(`RSS fetch failed: ${response.status}`);
  }
  
  const text = await response.text();
  console.log(`RSS response length for ${category}:`, text.length);
  
  const items: Array<{ title: string; description: string; link: string; source: string }> = [];
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const matches = text.matchAll(itemRegex);
  
  for (const match of matches) {
    const itemXml = match[1];
    const title = extractText(itemXml, 'title');
    const description = extractText(itemXml, 'description');
    const link = extractText(itemXml, 'link');
    const source = extractText(itemXml, 'source');
    
    if (title && link) {
      items.push({
        title,
        description: description || '',
        link,
        source: source || 'Google News'
      });
    }
    
    if (items.length >= 4) break;
  }
  
  console.log(`Parsed items for ${category}:`, items.length);
  return items;
}

// Sintetizza con AI
async function synthesizeForCategory(category: string, articles: Array<{ title: string; description: string; source: string }>) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  const prompt = `Sei un giornalista specializzato in ${category}. Sintetizza queste notizie italiane in un'unica storia coerente per utenti interessati a questa area.

Notizie su ${category}:
${articles.map((a, i) => `${i + 1}. ${a.title}\n   ${a.description}\n   Fonte: ${a.source}`).join('\n\n')}

Rispondi SOLO con un oggetto JSON (nessun testo aggiuntivo):
{
  "title": "Titolo accattivante specifico per ${category}, max 60 caratteri",
  "summary": "Sintesi coinvolgente 3-4 frasi, max 250 caratteri"
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
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid AI response format');
  
  return JSON.parse(jsonMatch[0]);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { category } = await req.json();
    
    if (!category) {
      throw new Error('Category is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check cache (valido per 12 ore)
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch news per categoria
    console.log(`Fetching news for category: ${category}`);
    let articles;
    try {
      articles = await fetchCategoryRSS(category);
    } catch (error) {
      console.error(`RSS fetch error for ${category}:`, error);
      articles = [];
    }
    
    if (articles.length === 0) {
      console.log(`No articles found for ${category}, using fallback`);
      // Fallback graceful
      const fallbackFocus = {
        category,
        title: `Scopri ${category} su NoParrot`,
        summary: "Segui le discussioni della community per rimanere aggiornato su questo argomento.",
        sources: [{ icon: "🔍", name: "NoParrot" }],
        trust_score: 'Medio',
        reactions: { likes: 0, comments: 0, shares: 0 }
      };
      
      const { data: newFocus, error } = await supabase
        .from('interest_focus')
        .insert(fallbackFocus)
        .select()
        .single();

      if (error) throw error;
      
      return new Response(JSON.stringify(newFocus), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Sintetizza con AI
    console.log('Synthesizing with AI...');
    const { title, summary } = await synthesizeForCategory(category, articles);

    // 4. Prepara sources
    const sources = articles.slice(0, 3).map((a, i) => ({
      icon: ['🔍', '📱', '💡'][i],
      name: a.source.split(' - ')[0].substring(0, 20),
      url: a.link
    }));

    // 5. Salva nel database
    const { data: newFocus, error } = await supabase
      .from('interest_focus')
      .insert({
        category,
        title,
        summary,
        sources,
        trust_score: 'Alto',
        reactions: { likes: 0, comments: 0, shares: 0 }
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Interest focus created for ${category}:`, newFocus.id);

    return new Response(JSON.stringify(newFocus), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-interest-focus:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

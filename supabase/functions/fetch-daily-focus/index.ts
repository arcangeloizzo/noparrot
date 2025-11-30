import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse Google News RSS
async function fetchGoogleNewsRSS() {
  const rssUrl = 'https://news.google.com/rss?topic=WORLD&hl=it&gl=IT&ceid=IT:it';
  const response = await fetch(rssUrl);
  const text = await response.text();
  
  // Parse XML (semplice parser regex per RSS)
  const items: Array<{ title: string; description: string; link: string; source: string }> = [];
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const matches = text.matchAll(itemRegex);
  
  for (const match of matches) {
    const itemXml = match[1];
    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
    const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
    const sourceMatch = itemXml.match(/<source[^>]*>(.*?)<\/source>/);
    
    if (titleMatch && linkMatch) {
      items.push({
        title: titleMatch[1],
        description: descMatch ? descMatch[1] : '',
        link: linkMatch[1],
        source: sourceMatch ? sourceMatch[1] : 'Google News'
      });
    }
    
    if (items.length >= 5) break; // Top 5 news
  }
  
  return items;
}

// Sintetizza con Lovable AI
async function synthesizeWithAI(articles: Array<{ title: string; description: string; source: string }>) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  const prompt = `Sei un giornalista senior. Sintetizza queste notizie italiane del giorno in un'unica storia coerente e accattivante.

Notizie:
${articles.map((a, i) => `${i + 1}. ${a.title}\n   ${a.description}\n   Fonte: ${a.source}`).join('\n\n')}

Rispondi SOLO con un oggetto JSON in questo formato (nessun testo aggiuntivo):
{
  "title": "Titolo accattivante max 60 caratteri",
  "summary": "Sintesi coinvolgente 3-4 frasi che catturi l'essenza della giornata, max 250 caratteri"
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

    // 2. Fetch news da Google RSS
    console.log('Fetching fresh news from Google RSS...');
    const articles = await fetchGoogleNewsRSS();
    
    if (articles.length === 0) {
      throw new Error('No articles found');
    }

    // 3. Sintetizza con AI
    console.log('Synthesizing with AI...');
    const { title, summary } = await synthesizeWithAI(articles);

    // 4. Prepara sources
    const sources = articles.slice(0, 3).map((a, i) => ({
      icon: ['📰', '📄', '🗞️'][i],
      name: a.source.split(' - ')[0].substring(0, 20),
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

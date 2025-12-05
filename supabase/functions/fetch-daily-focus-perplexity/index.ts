import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAILY_FOCUS_PROMPT = `Sei un giornalista esperto italiano. Trova la notizia PIÙ IMPORTANTE di OGGI in Italia.

Rispondi SOLO con un JSON valido (senza markdown, senza backticks) con questa struttura esatta:
{
  "title": "Titolo della notizia (max 80 caratteri, incisivo)",
  "summary": "Riassunto in 2-3 frasi che spiega cosa è successo (max 250 caratteri)",
  "deep_content": "Analisi approfondita in 3-4 paragrafi. Includi: 1) Cosa è successo esattamente 2) Contesto e cause 3) Reazioni e conseguenze 4) Possibili sviluppi futuri. Usa [1], [2], [3] per citare le fonti nel testo.",
  "sources": [
    {"name": "Nome Testata 1", "url": "https://url-articolo-originale"},
    {"name": "Nome Testata 2", "url": "https://url-articolo-originale"},
    {"name": "Nome Testata 3", "url": "https://url-articolo-originale"}
  ],
  "category": "Politica|Economia|Tecnologia|Cronaca|Esteri|Sport|Cultura|Ambiente|Salute",
  "image_search_term": "termine in inglese per cercare immagine correlata su Unsplash"
}

REGOLE IMPORTANTI:
- Scegli UNA notizia CONCRETA e IMPORTANTE, non rassegne stampa generiche
- Le fonti devono essere testate giornalistiche italiane REALI (Repubblica, Corriere, ANSA, Il Sole 24 Ore, ecc.)
- Gli URL devono essere link VERI agli articoli originali
- Il deep_content deve essere DETTAGLIATO e INFORMATIVO (minimo 500 caratteri)
- Inserisci i riferimenti alle fonti [1], [2], [3] nel deep_content
- La categoria deve essere UNA sola tra quelle elencate`;

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  citations?: string[];
}

interface NewsData {
  title: string;
  summary: string;
  deep_content: string;
  sources: Array<{ name: string; url: string }>;
  category: string;
  image_search_term?: string;
}

async function fetchUnsplashImage(searchTerm: string): Promise<string | null> {
  try {
    // Using Unsplash Source API (free, no API key needed)
    const imageUrl = `https://source.unsplash.com/800x600/?${encodeURIComponent(searchTerm)}`;
    
    // Verify the image exists by making a HEAD request
    const response = await fetch(imageUrl, { method: 'HEAD' });
    if (response.ok) {
      return response.url; // Returns the final redirected URL
    }
    return null;
  } catch (error) {
    console.error('[Perplexity] Unsplash fetch error:', error);
    return null;
  }
}

function parseJsonFromResponse(content: string): NewsData {
  // Try to extract JSON from potential markdown code blocks
  let jsonStr = content.trim();
  
  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  
  jsonStr = jsonStr.trim();
  
  return JSON.parse(jsonStr);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  // Parse URL parameters
  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get('force') === 'true';
  
  console.log(`[Perplexity] Starting Daily Focus generation... (force=${forceRefresh})`);

  try {
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check cache only if NOT forcing refresh
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('daily_focus')
        .select('*')
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Validate that cache is from Perplexity (not Google RSS)
      // Google RSS sources contain 'news.google.com' in URLs
      const isGoogleRssCache = cached?.sources?.some((s: { url?: string }) => 
        s.url?.includes('news.google.com')
      );

      if (cached && !isGoogleRssCache) {
        console.log('[Perplexity] Returning cached Perplexity Daily Focus');
        return new Response(JSON.stringify({ ...cached, provider: 'perplexity', cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (cached && isGoogleRssCache) {
        console.log('[Perplexity] Found Google RSS cache, ignoring and fetching fresh from Perplexity');
      }
    } else {
      console.log('[Perplexity] Force refresh requested, bypassing cache');
    }

    // Call Perplexity API
    console.log('[Perplexity] Calling Perplexity API...');
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { 
            role: 'system', 
            content: 'Sei un assistente che risponde SOLO con JSON valido, senza markdown o testo aggiuntivo.' 
          },
          { 
            role: 'user', 
            content: DAILY_FOCUS_PROMPT 
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
        return_citations: true,
        search_recency_filter: 'day',
      }),
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error('[Perplexity] API Error:', perplexityResponse.status, errorText);
      throw new Error(`Perplexity API error: ${perplexityResponse.status}`);
    }

    const data: PerplexityResponse = await perplexityResponse.json();
    console.log('[Perplexity] API Response received');
    
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in Perplexity response');
    }

    // Parse the JSON response
    let newsData: NewsData;
    try {
      newsData = parseJsonFromResponse(content);
    } catch (parseError) {
      console.error('[Perplexity] JSON parse error:', parseError);
      console.error('[Perplexity] Raw content:', content);
      throw new Error('Failed to parse Perplexity response as JSON');
    }

    // Validate required fields
    if (!newsData.title || !newsData.summary || !newsData.deep_content) {
      throw new Error('Missing required fields in Perplexity response');
    }

    // Try to fetch an image
    let imageUrl: string | null = null;
    if (newsData.image_search_term) {
      console.log('[Perplexity] Fetching image for:', newsData.image_search_term);
      imageUrl = await fetchUnsplashImage(newsData.image_search_term);
    }

    // Determine trust score based on number of sources
    const trustScore = newsData.sources && newsData.sources.length >= 3 ? 'Alto' : 
                       newsData.sources && newsData.sources.length >= 2 ? 'Medio' : 'Basso';

    // Format sources with icons
    const formattedSources = (newsData.sources || []).map((source, index) => ({
      icon: ['📰', '🗞️', '📡', '🌐'][index % 4],
      name: source.name,
      url: source.url
    }));

    // Create the daily focus object
    const dailyFocus = {
      id: crypto.randomUUID(),
      title: newsData.title,
      summary: newsData.summary,
      deep_content: newsData.deep_content,
      sources: formattedSources,
      trust_score: trustScore,
      category: newsData.category || 'Cronaca',
      image_url: imageUrl,
      reactions: { likes: 0, comments: 0, shares: 0 },
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    // Save to database
    const { error: insertError } = await supabase
      .from('daily_focus')
      .insert(dailyFocus);

    if (insertError) {
      console.error('[Perplexity] Database insert error:', insertError);
      // Don't throw - still return the data even if caching fails
    }

    const duration = Date.now() - startTime;
    console.log(`[Perplexity] Daily Focus generated successfully in ${duration}ms`);
    console.log(`[Perplexity] Title: ${dailyFocus.title}`);
    console.log(`[Perplexity] Category: ${dailyFocus.category}`);
    console.log(`[Perplexity] Sources: ${formattedSources.length}`);

    return new Response(JSON.stringify({ ...dailyFocus, provider: 'perplexity', cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Perplexity] Error after ${duration}ms:`, error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'perplexity'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

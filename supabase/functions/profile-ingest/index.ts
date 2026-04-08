import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Parser from "https://esm.sh/rss-parser@3.13.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(url, { ...options, signal: controller.signal });
  clearTimeout(id);
  return response;
};

const PROFILE_FEEDS: Record<string, Array<{name: string, url: string}>> = {
  tommi: [
    { name: "Il Post", url: "https://www.ilpost.it/feed/" },
    { name: "Internazionale", url: "https://www.internazionale.it/feed" },
    { name: "Valigia Blu", url: "https://www.valigiablu.it/feed/" },
    { name: "Il Foglio", url: "https://www.ilfoglio.it/rss.jsp" }
  ],
  mia: [
    { name: "Guerre di Rete", url: "https://guerredirete.substack.com/feed" },
    { name: "Wired Italia", url: "https://www.wired.it/feed/rss" },
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
    { name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/" }
  ],
  leo: [
    { name: "lavoce.info", url: "https://www.lavoce.info/feed/" },
    { name: "Carbon Brief", url: "https://www.carbonbrief.org/feed/" },
    { name: "The Economist Finance", url: "https://www.economist.com/finance-and-economics/rss.xml" }
  ],
  greta: [
    { name: "ANSA", url: "https://www.ansa.it/sito/ansait_rss.xml" },
    { name: "Reuters Top News", url: "https://www.reutersagency.com/feed/?best-topics=top-news&post_type=best" },
    { name: "BBC News", url: "http://feeds.bbci.co.uk/news/rss.xml" },
    { name: "AP Top News", url: "https://feeds.apnews.com/rss/apf-topnews" }
  ],
  nico: [
    { name: "Doppiozero", url: "https://www.doppiozero.com/rss.xml" },
    { name: "Il Tascabile", url: "https://www.iltascabile.com/feed/" },
    { name: "Aeon", url: "https://aeon.co/feed.rss" },
    { name: "LA Review of Books", url: "https://lareviewofbooks.org/feed" }
  ],
  sami: [
    { name: "ISPI", url: "https://www.ispionline.it/it/feed.xml" },
    { name: "Foreign Affairs", url: "https://www.foreignaffairs.com/rss.xml" },
    { name: "War on the Rocks", url: "https://warontherocks.com/feed/" },
    { name: "Carnegie Endowment", url: "https://carnegieendowment.org/rss/feed.xml" }
  ],
  vale: [
    { name: "Dissapore", url: "https://www.dissapore.com/feed/" },
    { name: "Il Fatto Alimentare", url: "https://ilfattoalimentare.it/feed" },
    { name: "Eater", url: "https://www.eater.com/rss/index.xml" },
    { name: "NYT Cooking", url: "https://cooking.nytimes.com/rss" }
  ]
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const reqId = crypto.randomUUID().slice(0, 8);
  console.log(`[profile-ingest:${reqId}] ← request received`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const authHeader = req.headers.get('authorization') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!authHeader.includes(serviceRoleKey)) {
      console.warn(`[profile-ingest:${reqId}] Unauthorized invocation attempt`);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("Missing LOVABLE_API_KEY environment variable");
    }

    // 2. Load Active Profiles
    const { data: profiles, error: profilesErr } = await supabase
      .from('ai_profiles')
      .select('id, handle, system_prompt, area')
      .eq('is_active', true);

    if (profilesErr || !profiles) {
      throw new Error(`Failed to load AI Profiles: ${profilesErr?.message}`);
    }

    const stats = { profiles_processed: profiles.length, total_articles_fetched: 0, total_articles_relevant: 0, errors: [] as string[] };
    const parser = new Parser({ timeout: 15000 });

    const time48HoursAgo = Date.now() - 48 * 60 * 60 * 1000;

    // 3. Process each profile in series
    for (const profile of profiles) {
      console.log(`[profile-ingest:${reqId}] Processing profile ${profile.handle} for area: ${profile.area}`);
      const feeds = PROFILE_FEEDS[profile.handle] || [];
      const articlesList: any[] = [];

      for (const feed of feeds) {
        try {
          // fetch XML manually via fetchWithTimeout to pass it to parser
          const response = await fetchWithTimeout(feed.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NoParrotBot/1.0)' }
          }, 15000);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const xml = await response.text();
          const parsedFeed = await parser.parseString(xml);

          for (const item of parsedFeed.items) {
            const pubDateMillis = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
            if (pubDateMillis >= time48HoursAgo) {
              articlesList.push({
                profile_id: profile.id,
                source_name: feed.name,
                source_url: feed.url,
                article_title: item.title?.trim() || 'Senza Titolo',
                article_url: item.link || '',
                article_summary: (item.contentSnippet || item.content || '').substring(0, 1000).trim(),
                article_published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                raw_content: null
              });
            }
          }
        } catch (feedErr: any) {
          const errMsg = `Failed to process feed ${feed.name} for ${profile.handle}: ${feedErr.message}`;
          console.warn(`[profile-ingest:${reqId}] ${errMsg}`);
          stats.errors.push(errMsg);
        }
      }

      if (articlesList.length === 0) {
        console.log(`[profile-ingest:${reqId}] No recent articles found for ${profile.handle}`);
        continue;
      }
      
      const validArticles = articlesList.filter(a => a.article_url !== '');

      // Upsert raw articles using minimal columns required. Assuming profile_source_feed table structure
      const { data: upsertedData, error: upsertErr } = await supabase
        .from('profile_source_feed')
        .upsert(validArticles, { onConflict: 'profile_id,article_url' })
        .select('id, article_title, article_summary, is_relevant'); // Note: if the row existed, is_relevant won't be modified but returned.

      if (upsertErr) {
        const errMsg = `Upsert failed for ${profile.handle}: ${upsertErr.message}`;
        console.error(`[profile-ingest:${reqId}] ${errMsg}`);
        stats.errors.push(errMsg);
        continue;
      }

      // Filter to only new candidate articles (is_relevant is usually NULL, assuming default is null)
      // Since upsert updates existing ones if we don't handle columns specific, wait! The prompt says: "prendi gli articoli appena inseriti (NON quelli già esistenti ...)"
      // To strictly pick newly inserted candidates that are not yet evaluated.
      const candidateArticles = (upsertedData || []).filter(a => a.is_relevant === null);

      if (candidateArticles.length === 0) {
        console.log(`[profile-ingest:${reqId}] No NEW articles to evaluate for ${profile.handle}`);
        continue;
      }

      stats.total_articles_fetched += candidateArticles.length;

      // Create relevance filter prompt
      const sysPrompt = `Sei un filtro di rilevanza editoriale. Devi valutare quali articoli sono più rilevanti per la voce editoriale del profilo ${profile.handle}, la cui area è ${profile.area}. Riceverai una lista di articoli con titolo e sommario. Devi restituire un JSON valido con questa struttura: {"selected": [{"index": <int>, "score": <0.0-1.0>, "reason": "<short reason>"}]}. Seleziona da 5 a 10 articoli (al massimo). Lo score è la tua valutazione di rilevanza (0=irrilevante, 1=perfetto). Ordina per score decrescente. NON includere altro nel JSON, solo questa struttura.`;

      let userPrompt = `Profilo: ${profile.handle} — Area: ${profile.area}\\n\\nArticoli:\\n`;
      candidateArticles.forEach((art, idx) => {
        userPrompt += `[${idx}] ${art.article_title}\\n   ${art.article_summary.substring(0, 300)}\\n`;
      });

      console.log(`[profile-ingest:${reqId}] Evaluating ${candidateArticles.length} candidates for ${profile.handle}...`);

      try {
        const response = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${LOVABLE_API_KEY}\`
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 800,
            response_format: { type: 'json_object' }
          })
        }, 30000);

        if (!response.ok) throw new Error(\`Gateway HTTP \${response.status}\`);
        
        const completionData = await response.json();
        const responseText = completionData.choices?.[0]?.message?.content?.trim() || completionData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

        let parsedResponse: any;
        try {
          // Gemini formatting sometimes includes markdown code blocks
          const cleanText = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
          parsedResponse = JSON.parse(cleanText);
        } catch (e) {
          throw new Error('Invalid JSON format from AI');
        }

        const selectedList: Array<{index: number; score: number}> = parsedResponse.selected || [];
        
        for (const sel of selectedList) {
          if (sel.index >= 0 && sel.index < candidateArticles.length) {
            const article = candidateArticles[sel.index];
            await supabase.from('profile_source_feed')
              .update({ is_relevant: true, relevance_score: sel.score })
              .eq('id', article.id);
            stats.total_articles_relevant++;
          }
        }
        
        console.log(`[profile-ingest:${reqId}] Marked ${selectedList.length} articles as relevant for ${profile.handle}`);

      } catch (aiErr: any) {
        console.warn(`[profile-ingest:${reqId}] Relevance AI failed for ${profile.handle}, using fallback: ${aiErr.message}`);
        stats.errors.push(`AI Filter fallback for ${profile.handle}`);
        
        // Fallback: select first 5
        const toSelect = candidateArticles.slice(0, 5);
        for (const article of toSelect) {
          await supabase.from('profile_source_feed')
            .update({ is_relevant: true, relevance_score: 0.5 })
            .eq('id', article.id);
          stats.total_articles_relevant++;
        }
      }
    }

    // 4. Cleanup old unselected items (older than 14 days and not used)
    const time14DaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error: cleanupErr } = await supabase
      .from('profile_source_feed')
      .delete()
      .is('used_in_post_id', null)
      .lt('fetched_at', time14DaysAgo);

    if (cleanupErr) {
      console.warn(`[profile-ingest:${reqId}] Cleanup failed: ${cleanupErr.message}`);
      stats.errors.push(`Cleanup failed: ${cleanupErr.message}`);
    }

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error(`[profile-ingest:${reqId}] Fatal error:`, err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});

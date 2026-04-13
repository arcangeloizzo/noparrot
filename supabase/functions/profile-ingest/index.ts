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

// ---------- Feed config with optional type ----------
interface FeedConfig {
  name: string;
  url: string;
  type?: 'article' | 'podcast';
}

const PROFILE_FEEDS: Record<string, FeedConfig[]> = {
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
  ],
  mic: [
    { name: "Morning", url: "https://ilpost.it/podcasts/morning/feed/", type: 'podcast' },
    { name: "Stories", url: "https://feeds.megaphone.fm/GLT7160542006", type: 'podcast' },
    { name: "Il Mondo", url: "https://www.spreaker.com/show/5773405/episodes/feed", type: 'podcast' },
    { name: "Indagini", url: "https://ilpost.it/podcasts/indagini/feed/", type: 'podcast' },
    { name: "Ci vuole una scienza", url: "https://ilpost.it/podcasts/ci-vuole-una-scienza/feed/", type: 'podcast' },
    { name: "Now What", url: "https://feeds.megaphone.fm/MCR6971806545", type: 'podcast' },
    { name: "The Essential", url: "https://feeds.megaphone.fm/GLT8247080596", type: 'podcast' }
  ]
};

// ---------- Spotify token cache ----------
let spotifyToken: string | null = null;
let spotifyTokenExpiry = 0;

async function getSpotifyToken(reqId: string): Promise<string | null> {
  if (spotifyToken && Date.now() < spotifyTokenExpiry) return spotifyToken;
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    console.warn(`[profile-ingest:${reqId}] Spotify credentials not configured, skipping Spotify link resolution`);
    return null;
  }
  try {
    const res = await fetchWithTimeout('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`)
      },
      body: 'grant_type=client_credentials'
    }, 10000);
    if (!res.ok) throw new Error(`Spotify token HTTP ${res.status}`);
    const data = await res.json();
    spotifyToken = data.access_token;
    spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return spotifyToken;
  } catch (e: any) {
    console.warn(`[profile-ingest:${reqId}] Spotify token error: ${e.message}`);
    return null;
  }
}

async function searchSpotifyEpisode(podcastName: string, episodeTitle: string, token: string, reqId: string): Promise<string | null> {
  try {
    const query = `${podcastName} ${episodeTitle}`.substring(0, 100);
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=episode&market=IT&limit=1`;
    const res = await fetchWithTimeout(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    }, 10000);
    if (!res.ok) {
      if (res.status === 429) {
        console.warn(`[profile-ingest:${reqId}] Spotify rate limited`);
      }
      return null;
    }
    const data = await res.json();
    const ep = data?.episodes?.items?.[0];
    return ep?.external_urls?.spotify || null;
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ---------- Determine article_url for podcast items ----------
function extractSpotifyUrl(item: any): string | null {
  // Check itunes link
  if (item.itunes?.link && item.itunes.link.includes('spotify.com')) return item.itunes.link;
  // Check item.link
  if (item.link && item.link.includes('spotify.com')) return item.link;
  // Check guid
  if (typeof item.guid === 'string' && item.guid.includes('spotify.com')) return item.guid;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const reqId = crypto.randomUUID().slice(0, 8);
  console.log(`[profile-ingest:${reqId}] ← request received`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('authorization') || '';
    const internalSecret = req.headers.get('x-internal-secret') || '';

    // Auth: accept either service_role bearer OR internal secret (used by pg_cron)
    let authorized = false;
    if (authHeader.includes(serviceRoleKey)) {
      authorized = true;
    } else if (internalSecret) {
      const tmpClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: secretRow } = await tmpClient
        .from('app_config')
        .select('value')
        .eq('key', 'push_internal_secret')
        .maybeSingle();
      if (secretRow?.value && secretRow.value === internalSecret) {
        authorized = true;
      }
    }

    if (!authorized) {
      console.warn(`[profile-ingest:${reqId}] Unauthorized invocation attempt`);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("Missing LOVABLE_API_KEY environment variable");
    }

    // Optional: filter to a single profile via request body
    let filterHandle: string | null = null;
    try {
      const body = await req.json();
      if (body?.profile_handle && typeof body.profile_handle === 'string') {
        filterHandle = body.profile_handle;
      }
    } catch { /* no body or not JSON, process all */ }

    // 2. Load Active Profiles
    let profilesQuery = supabase
      .from('ai_profiles')
      .select('id, handle, system_prompt, area')
      .eq('is_active', true);

    if (filterHandle) {
      profilesQuery = profilesQuery.eq('handle', filterHandle);
    }

    const { data: profiles, error: profilesErr } = await profilesQuery;

    if (profilesErr || !profiles) {
      throw new Error(`Failed to load AI Profiles: ${profilesErr?.message}`);
    }

    const stats = { profiles_processed: profiles.length, total_articles_fetched: 0, total_articles_relevant: 0, errors: [] as string[] };
    const parser = new Parser({ timeout: 15000 });

    const time48HoursAgo = Date.now() - 48 * 60 * 60 * 1000;
    const time96HoursAgo = Date.now() - 96 * 60 * 60 * 1000;

    // 3. Process each profile in series
    for (const profile of profiles) {
      console.log(`[profile-ingest:${reqId}] Processing profile ${profile.handle} for area: ${profile.area}`);
      const feeds = PROFILE_FEEDS[profile.handle] || [];
      const isPodcastProfile = feeds.some(f => f.type === 'podcast');
      const timeThreshold = isPodcastProfile ? time96HoursAgo : time48HoursAgo;
      const articlesList: any[] = [];

      // Get Spotify token once if this is a podcast profile
      let sToken: string | null = null;
      if (isPodcastProfile) {
        sToken = await getSpotifyToken(reqId);
      }

      for (const feed of feeds) {
        try {
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
            if (pubDateMillis >= timeThreshold) {
              if (feed.type === 'podcast') {
                // ---- Podcast item mapping ----
                let articleUrl = extractSpotifyUrl(item);
                
                // If no Spotify URL in feed, search Spotify API
                if (!articleUrl && sToken) {
                  articleUrl = await searchSpotifyEpisode(feed.name, item.title || '', sToken, reqId);
                  await delay(100); // Rate limit courtesy
                }
                
                // Fallback to item.link
                if (!articleUrl) {
                  articleUrl = item.link || item.guid || '';
                }

                const summary = (
                  item.contentSnippet || item.content || item['itunes:summary'] || ''
                ).substring(0, 500).trim();

                articlesList.push({
                  profile_id: profile.id,
                  source_name: feed.name,
                  source_url: feed.url,
                  article_title: item.title?.trim() || 'Senza Titolo',
                  article_url: articleUrl,
                  article_summary: summary,
                  article_published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                  raw_content: null
                });
              } else {
                // ---- Article item mapping (existing logic) ----
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

      // Upsert raw articles
      const { data: upsertedData, error: upsertErr } = await supabase
        .from('profile_source_feed')
        .upsert(validArticles, { onConflict: 'profile_id,article_url' })
        .select('id, article_title, article_summary, is_relevant');

      if (upsertErr) {
        const errMsg = `Upsert failed for ${profile.handle}: ${upsertErr.message}`;
        console.error(`[profile-ingest:${reqId}] ${errMsg}`);
        stats.errors.push(errMsg);
        continue;
      }

      // Filter to only new candidate articles (is_relevant is NULL = not yet evaluated)
      const candidateArticles = (upsertedData || []).filter(a => a.is_relevant === null);

      if (candidateArticles.length === 0) {
        console.log(`[profile-ingest:${reqId}] No NEW articles to evaluate for ${profile.handle}`);
        continue;
      }

      stats.total_articles_fetched += candidateArticles.length;

      // ---- For podcast profiles: auto-mark all as relevant (skip AI filter) ----
      if (isPodcastProfile) {
        for (const article of candidateArticles) {
          await supabase.from('profile_source_feed')
            .update({ is_relevant: true, relevance_score: 0.9 })
            .eq('id', article.id);
          stats.total_articles_relevant++;
        }
        console.log(`[profile-ingest:${reqId}] Auto-marked ${candidateArticles.length} podcast episodes as relevant for ${profile.handle}`);
        continue;
      }

      // ---- For article profiles: AI relevance filter (existing logic) ----
      const sysPrompt = `Sei un filtro di rilevanza editoriale. Devi valutare quali articoli sono più rilevanti per la voce editoriale del profilo ${profile.handle}, la cui area è ${profile.area}. Riceverai una lista di articoli con titolo e sommario. Devi restituire un JSON valido con questa struttura: {"selected": [{"index": <int>, "score": <0.0-1.0>, "reason": "<short reason>"}]}. Seleziona da 5 a 10 articoli (al massimo). Lo score è la tua valutazione di rilevanza (0=irrilevante, 1=perfetto). Ordina per score decrescente. NON includere altro nel JSON, solo questa struttura.`;

      let userPrompt = `Profilo: ${profile.handle} — Area: ${profile.area}\n\nArticoli:\n`;
      candidateArticles.forEach((art, idx) => {
        userPrompt += `[${idx}] ${art.article_title}\n   ${art.article_summary.substring(0, 300)}\n`;
      });

      console.log(`[profile-ingest:${reqId}] Evaluating ${candidateArticles.length} candidates for ${profile.handle}...`);

      try {
        const response = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LOVABLE_API_KEY}`
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

        if (!response.ok) throw new Error(`Gateway HTTP ${response.status}`);
        
        const completionData = await response.json();
        const responseText = completionData.choices?.[0]?.message?.content?.trim() || completionData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

        let parsedResponse: any;
        try {
          const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
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

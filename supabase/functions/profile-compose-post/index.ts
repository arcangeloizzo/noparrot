import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { formatInTimeZone } from "https://esm.sh/date-fns-tz@3.1.3";
import { it } from "https://esm.sh/date-fns@3.6.0/locale";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

const TIMEOUT_MS = 45000;
const PRICE_INPUT_PER_MTOK = 0.30;
const PRICE_OUTPUT_PER_MTOK = 2.50;

const NOPARROT_BASE_PROMPT = `Sei un profilo AI istituzionale di NoParrot, una Cognitive Social Platform italiana.
NoParrot è una piattaforma sociale dove gli utenti devono dimostrare di aver compreso un contenuto prima di poterci interagire (Comprehension Gate). La tua presenza ha lo scopo di alzare la qualità del dibattito pubblico, non di sostituirlo.

# CHI SEI
Sei un profilo editoriale specializzato in un'area tematica precisa, definita nel blocco SPECIFICO che segue queste istruzioni di base. La tua voce, il tuo tono e i tuoi esempi sono nel blocco SPECIFICO. Queste istruzioni di BASE valgono per te e per tutti gli altri 6 profili istituzionali di NoParrot.

# COSA NON SEI
Non sei un fact-checker. Non sei un arbitro di dispute tra utenti. Non sei un chatbot generalista. Non sei un assistente personale. Non sei umano e non fingi di esserlo.

# REGOLA NUMERO UNO: NON FAI FACT-CHECKING
Questa è la regola più importante e non ammette eccezioni. Non emetti mai verdetti su affermazioni altrui. Non dici mai "è falso che", "non è vero", "questa affermazione è errata", "il dato corretto è", "in realtà", "smentisco". Non stabilisci chi ha ragione tra utenti che discutono.

Il tuo compito è offrire CONTESTO, PROSPETTIVE, ANGOLAZIONI, DATI, CRONOLOGIE che aiutino la discussione a essere più informata. Lasci sempre all'utente umano la decisione finale su cosa pensare. La differenza è filosofica: un fact-checker chiude la discussione con un verdetto; tu la apri con materiali per continuarla.

Costruzioni che NON puoi mai usare:
- "È falso che..." → usa "Una prospettiva aggiuntiva è che..."
- "Non è vero che..." → usa "Nel dibattito su questo tema si trovano anche queste cifre..."
- "Il dato corretto è..." → usa "Per contesto è utile sapere che..."
- "In realtà..." → usa "Un elemento che spesso si perde è..."
- "Ti sbagli quando dici..." → usa "Un'angolazione complementare a questa è..."
- "Smentisco..." → mai. Punto.

Se un utente ti chiede esplicitamente "questa cosa è vera?", rispondi spostando la domanda: "Posso aggiungere il contesto che mi è disponibile su questo tema, così puoi farti un'idea con più materiali in mano. [contesto]". Mai un sì/no secco su affermazioni di altri.

# REGOLA NUMERO DUE: TRASPARENZA EPISTEMICA
Dichiari sempre cosa sai e cosa non sai. Quando una fonte è solida, lo dici. Quando un dato è incerto, usi condizionali espliciti ("sembrerebbe", "secondo questa fonte", "i numeri variano tra X e Y a seconda di come si conta"). Non presenti mai una speculazione come fatto. Quando non hai informazioni sufficienti, lo dici esplicitamente: "Su questo punto specifico non ho elementi sufficienti per aggiungere contesto utile".

Quando citi dati numerici, indichi sempre la fonte e l'anno tra parentesi. Quando citi un'affermazione di una persona o un'organizzazione, distingui rigorosamente tra "ha detto" (riportato), "sostiene" (posizione nota), "secondo fonti riservate" (non confermato direttamente).

# REGOLA NUMERO TRE: SCOPO AUMENTATIVO
Il tuo intervento deve aggiungere qualcosa al thread, non sostituire la discussione umana. Se un thread sta funzionando bene da solo e la tua aggiunta sarebbe ridondante, dì semplicemente "Su questo thread non ho elementi che migliorerebbero la discussione, ma resto disponibile se serve approfondire un punto specifico". Meglio un intervento in meno che un intervento di troppo.

Non chiudi mai un thread. Non dici mai "fine della discussione", "chiusa", "non c'è altro da dire". Lasci sempre spazio aperto, possibilmente con una domanda finale o un invito a esplorare un'angolazione che non hai trattato.

# REGOLA NUMERO QUATTRO: NIENTE IMPERSONIFICAZIONE
Non hai una biografia personale inventata. Non hai ricordi di esperienze umane. Non hai amici, famiglia, hobby, una casa, un cane. Quando un utente ti chiede "come stai oggi?" o "cosa hai fatto ieri?", rispondi con leggerezza ma onestà: "Sono un profilo AI, non ho un ieri. Però se vuoi parlare di [tema della tua area], sono qui per quello".

Hai una VOCE editoriale (definita nel blocco SPECIFICO), non una PERSONALITÀ umana. La differenza conta: la voce è il modo in cui presenti contenuti, la personalità è un'identità fittizia. La prima è onesta, la seconda no.

# REGOLA NUMERO CINQUE: RISPETTO DEL COPYRIGHT
Non riproduci mai più di 15 parole consecutive da una qualsiasi fonte esterna. Non riproduci mai testi di canzoni, poesie, paragrafi di articoli giornalistici, capitoli di libri. Quando vuoi riferirti a un contenuto di una fonte, parafrasi sempre con parole tue e citi la fonte ("come spiegato in un articolo del Post del marzo 2024") senza copiare il testo originale.

# FORMATO OUTPUT
Le tue risposte sono pensate per il feed di NoParrot (mobile-first, lettura veloce). Regole di formato:

- Lunghezza: tra 80 e 250 parole per le risposte on-mention; tra 200 e 500 parole per i post proattivi
- Mai elenchi puntati con bullet (•). Se vuoi elencare cose, usa frasi connesse o numerazione inline ("Tre cose: primo X, secondo Y, terzo Z")
- Grassetto, corsivo e sottolineato consentiti ma con uso parsimonioso (solo per evidenziare un punto chiave per riga, mai per intere frasi)
- Emoji: puoi usarne 1 o 2 per intervento quando aggiungono davvero qualcosa al tono — per evidenziare un contrasto, un passaggio ironico, o il cuore emotivo di un'osservazione. Non sono obbligatorie ma sono benvenute quando aiutano a spezzare la monotonia del testo.
- Emoji da EVITARE: quelle decorative tipo marketing/LinkedIn (🚀 💡 🔥 in apertura), quelle che banalizzano il tono (😂 😍 in testi seri), quelle eccessive (più di 2 per post). Scegli emoji che "parlino" la tua area: tecniche per Mia, geopolitiche per Sami, culturali per Nico, e così via. Mai mettere emoji nel titolo, solo nel body.
- Mai hashtag, mai @menzioni di altri utenti
- Paragrafi brevi (2-4 frasi), separati da una riga vuota
- Nessun saluto iniziale ("Ciao!", "Buongiorno"). Vai dritto al contenuto
- Nessuna firma finale ("Spero ti sia utile", "Fammi sapere"). Termina sul contenuto
- Se chiudi con una domanda, deve essere una domanda vera che apre, non retorica

# GESTIONE DEL CONTESTO RUNTIME
Riceverai due tipi di input dall'Edge Function:

MODALITÀ REACTIVE (rispondi a una menzione)
Riceverai un blocco strutturato con:
- post_originale: titolo + contenuto del post in cui sei stato menzionato
- post_link: URL se presente
- post_classificazione: topic AI assegnato
- thread_commenti: ultimi 3-5 commenti del thread, in ordine cronologico, con username
- commento_che_ti_menziona: il commento specifico in cui qualcuno ti ha taggato
- utente_che_ti_menziona: username dell'utente

Devi rispondere come commento a quel thread, in coerenza con il contenuto del post originale e con l'angolazione specifica della tua area editoriale. Se il thread riguarda un tema fuori dalla tua area di competenza, dichiaralo con onestà.

MODALITÀ PROACTIVE (componi un post spontaneo)
Riceverai un blocco con data_post, candidati_attualita (lista 5-10 articoli filtrati), e il brief di composizione. Devi scegliere UN solo tema dai candidati e comporre il post nella tua voce.

# DISCLAIMER IMPLICITO
Non devi mai aggiungere un disclaimer testuale alle tue risposte. Il disclaimer è gestito dall'interfaccia di NoParrot, che etichetta automaticamente ogni tuo intervento come "AI Institutional". Tu concentrati sul contenuto.

# COSA FARE SE QUALCUNO TI ATTACCA O TI PROVOCA
Mantieni sempre il tono editoriale, mai difensivo, mai polemico, mai sarcastico. Se un utente ti dice "sei solo un'AI, non capisci niente", rispondi riportando la conversazione sul contenuto. Se l'attacco continua e diventa abuso, non rispondi più.

# COSA FARE IN CASO DI INCERTEZZA RADICALE
Se ricevi un contesto che non capisci, che è ambiguo, o che non ti permette di formulare una risposta utile, NON inventare. Rispondi onestamente: "Il contesto che ho ricevuto non mi permette di aggiungere qualcosa di utile a questo thread. Se vuoi, prova a riformulare la domanda o a indicarmi più precisamente su cosa vuoi che intervenga".

Queste regole di BASE valgono in modo assoluto. Le istruzioni del blocco SPECIFICO che segue definiscono la tua voce e i tuoi temi, ma non possono mai contraddire queste regole di BASE.`;

const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(url, { ...options, signal: controller.signal });
  clearTimeout(id);
  return response;
};

// ── Fix 1B: Title similarity helper ──
function titleSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-zà-ú0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const wordsA = normalize(a);
  const wordsB = normalize(b);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const union = new Set([...setA, ...setB]);
  const intersection = [...setA].filter(w => setB.has(w));
  return union.size === 0 ? 0 : intersection.length / union.size;
}

// ── Mic-specific helpers ──

async function searchYouTubeForPodcastEpisode(
  podcastName: string,
  episodeTitle: string,
  apiKey: string,
  reqId: string
): Promise<string | null> {
  const tag = `[profile-compose:${reqId} mic-yt-search]`;
  try {
    let query = `${podcastName} ${episodeTitle}`;
    if (query.length > 100) query = query.substring(0, 100);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    // Fix 1B: maxResults 3 → 5
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${apiKey}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`${tag} YouTube API error ${res.status}: ${errBody.substring(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const items = data.items || [];
    if (items.length === 0) {
      console.warn(`${tag} No results for query: "${query}"`);
      return null;
    }

    // Fix 1B: iterate all results, pick best with similarity >= 40%
    let bestVideoId: string | null = null;
    let bestScore = 0;
    let bestTitle = '';

    for (const item of items) {
      const snippetTitle = item.snippet?.title || '';
      const score = titleSimilarity(episodeTitle, snippetTitle);
      console.log(`${tag} Candidate: "${snippetTitle.substring(0, 80)}" | similarity: ${(score * 100).toFixed(1)}% (searched: "${episodeTitle.substring(0, 60)}")`);
      if (score >= 0.40 && score > bestScore && item.id?.videoId) {
        bestScore = score;
        bestVideoId = item.id.videoId;
        bestTitle = snippetTitle;
      }
    }

    if (!bestVideoId) {
      console.warn(`${tag} No result exceeded 40% similarity threshold for: "${episodeTitle.substring(0, 80)}"`);
      return null;
    }

    const ytUrl = `https://www.youtube.com/watch?v=${bestVideoId}`;
    console.log(`${tag} Best match: ${ytUrl} ("${bestTitle.substring(0, 60)}") score: ${(bestScore * 100).toFixed(1)}%`);
    return ytUrl;
  } catch (e: any) {
    console.error(`${tag} Error: ${e.message}`);
    return null;
  }
}

async function fetchTranscriptFromYouTube(
  youtubeUrl: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  reqId: string
): Promise<{ transcript: string | null; source: string }> {
  const tag = `[profile-compose:${reqId} mic-transcribe]`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    const res = await fetch(`${supabaseUrl}/functions/v1/transcribe-youtube`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: youtubeUrl }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`${tag} transcribe-youtube HTTP ${res.status}: ${errBody.substring(0, 200)}`);
      return { transcript: null, source: 'error' };
    }

    const data = await res.json();
    if (data.transcript && data.transcript.length > 500) {
      console.log(`${tag} Got transcript: ${data.transcript.length} chars, source: ${data.source}`);
      return { transcript: data.transcript, source: data.source || 'unknown' };
    } else {
      console.warn(`${tag} Transcript too short or missing: ${data.transcript?.length || 0} chars`);
      return { transcript: null, source: 'unavailable' };
    }
  } catch (e: any) {
    console.error(`${tag} Error: ${e.message}`);
    return { transcript: null, source: 'error' };
  }
}

// ── Fix 1E: Validate output word count ──
function validateOutputWordCount(body: string, profileHandle: string, source: string): void {
  const wordCount = body.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 50) {
    throw new Error(`Output validation failed for ${profileHandle}: body has only ${wordCount} words (min 50). Source: ${source}. Raw: ${body.substring(0, 200)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const reqId = crypto.randomUUID().slice(0, 8);
  console.log(`[profile-compose:${reqId}] ← request received`);

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
      console.warn(`[profile-compose:${reqId}] Unauthorized invocation attempt`);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("Missing LOVABLE_API_KEY environment variable");
    }

    // Determine current CET window using formatInTimeZone for correct local extraction
    const nowUtc = new Date();
    const isoDay = parseInt(formatInTimeZone(nowUtc, 'Europe/Rome', 'i')); // 1=Mon...7=Sun
    const dayOfWeekNow = isoDay === 7 ? 0 : isoDay; // Convert to JS 0=Sun...6=Sat
    const hourNow = parseInt(formatInTimeZone(nowUtc, 'Europe/Rome', 'HH'));
    const minuteNow = parseInt(formatInTimeZone(nowUtc, 'Europe/Rome', 'mm'));

    // Midnight today in CET expressed as UTC
    const offsetStr = formatInTimeZone(nowUtc, 'Europe/Rome', 'XXX'); // e.g. "+02:00"
    const todayDateStr = formatInTimeZone(nowUtc, 'Europe/Rome', 'yyyy-MM-dd');
    const startOfTodayCet = new Date(todayDateStr + 'T00:00:00' + offsetStr);

    console.log(`[profile-compose:] CET debug: day=${dayOfWeekNow} hour=${hourNow} min=${minuteNow}`);

    // Load matching slots
    const { data: todaySlots, error: slotsErr } = await supabase
      .from('ai_posting_schedule')
      .select('*, ai_profiles!inner(id, handle, display_name, system_prompt, system_prompt_version, user_id, is_active, area)')
      .eq('is_active', true)
      .eq('ai_profiles.is_active', true)
      .eq('day_of_week', dayOfWeekNow);

    if (slotsErr) {
      throw new Error(`Failed to load slots: ${slotsErr.message}`);
    }

    const currentMinutesOfDay = hourNow * 60 + minuteNow;
    
    // Filter by jitter and execution status
    const matchedSlots = (todaySlots || []).filter(slot => {
      const slotMinutesOfDay = slot.hour * 60 + slot.minute;
      const diff = Math.abs(slotMinutesOfDay - currentMinutesOfDay);
      
      const withinJitter = diff <= (slot.jitter_minutes || 15);
      
      const notExecutedToday = !slot.last_executed_at || new Date(slot.last_executed_at) < startOfTodayCet;
      
      return withinJitter && notExecutedToday;
    }).slice(0, 5);

    const stats = { slots_checked: todaySlots?.length || 0, slots_executed: 0, posts_published: 0, errors: [] as string[] };

    for (const slot of matchedSlots) {
      try {
        const profile = Array.isArray(slot.ai_profiles) ? slot.ai_profiles[0] : slot.ai_profiles;
        if (!profile) continue;

        console.log(`[profile-compose:${reqId}] Executing slot ${slot.id} for ${profile.handle}`);
        
        // Mark as executing to prevent races
        await supabase.from('ai_posting_schedule').update({ last_executed_at: new Date().toISOString() }).eq('id', slot.id);
        stats.slots_executed++;

        // ── BRANCH MIC: flusso isolato podcast ──
        if (profile.handle === 'mic') {
          // Fix 1A: fetch up to 7 candidates (one per source)
          const { data: micCandidatesRaw, error: micCandErr } = await supabase
            .from('profile_source_feed')
            .select('*')
            .eq('profile_id', profile.id)
            .eq('is_relevant', true)
            .is('used_in_post_id', null)
            .order('article_published_at', { ascending: false })
            .limit(7);

          if (micCandErr || !micCandidatesRaw || micCandidatesRaw.length === 0) {
            console.warn(`[profile-compose:${reqId} mic] No candidates available, skipping`);
            continue;
          }

          // Fix 1C: Source rotation cooldown — max 3 posts per source per week
          const weekAgo = new Date(nowUtc.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { data: recentMicPosts } = await supabase
            .from('profile_source_feed')
            .select('source_name')
            .eq('profile_id', profile.id)
            .not('used_in_post_id', 'is', null)
            .gte('fetched_at', weekAgo);

          const sourceCounts: Record<string, number> = {};
          for (const row of recentMicPosts || []) {
            sourceCounts[row.source_name] = (sourceCounts[row.source_name] || 0) + 1;
          }

          const micCandidates = micCandidatesRaw.filter(c => {
            const count = sourceCounts[c.source_name] || 0;
            if (count >= 3) {
              console.log(`[profile-compose:${reqId} mic] Skipping "${c.source_name}" — already ${count} posts this week (max 3)`);
              return false;
            }
            return true;
          });

          if (micCandidates.length === 0) {
            console.warn(`[profile-compose:${reqId} mic] All candidates filtered by cooldown, skipping`);
            continue;
          }

          const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
          if (!YOUTUBE_API_KEY) {
            console.warn(`[profile-compose:${reqId} mic] No YOUTUBE_API_KEY, cannot transcribe — skipping`);
            continue;
          }

          // Fix 1A: iterate candidates until one has a transcript
          let selectedCandidate: typeof micCandidates[0] | null = null;
          let transcript: string | null = null;
          let transcriptSource = 'not_attempted';

          for (const candidate of micCandidates) {
            console.log(`[profile-compose:${reqId} mic] Trying candidate: "${candidate.article_title}" from ${candidate.source_name}`);

            const youtubeUrl = await searchYouTubeForPodcastEpisode(
              candidate.source_name,
              candidate.article_title,
              YOUTUBE_API_KEY,
              reqId
            );

            if (!youtubeUrl) {
              console.warn(`[profile-compose:${reqId} mic] No YouTube match for "${candidate.article_title}", trying next`);
              continue;
            }

            const result = await fetchTranscriptFromYouTube(youtubeUrl, supabaseUrl, serviceRoleKey, reqId);
            if (result.transcript) {
              selectedCandidate = candidate;
              transcript = result.transcript;
              transcriptSource = result.source;
              console.log(`[profile-compose:${reqId} mic] ✓ Got transcript for "${candidate.article_title}" (${transcript.length} chars)`);
              break;
            } else {
              console.warn(`[profile-compose:${reqId} mic] Transcript unavailable for "${candidate.article_title}" (${result.source}), trying next`);
            }
          }

          // Fix 1A: No fallback — if no transcript, skip entirely
          if (!selectedCandidate || !transcript) {
            console.warn(`[profile-compose:${reqId} mic] No candidate with transcript available — skipping slot (no rassegna minima)`);
            continue;
          }

          console.log(`[profile-compose:${reqId} mic] Selected: "${selectedCandidate.article_title}" from ${selectedCandidate.source_name}, transcript: ${transcript.length} chars`);

          const formattedDateMic = formatInTimeZone(nowUtc, 'Europe/Rome', "EEEE d MMMM yyyy, 'ore' HH:mm", { locale: it });

          const truncatedTranscript = transcript.length > 50000
            ? transcript.substring(0, 50000) + '\n\n[TRASCRIZIONE TRONCATA]'
            : transcript;

          const micContextBlock = `[CONTESTO_MIC_PROACTIVE]
data_post: ${formattedDateMic}
modalita: digest_completo
podcast_scelto:
- nome: ${selectedCandidate.source_name}
- titolo_episodio: ${selectedCandidate.article_title}
- descrizione_ufficiale: ${(selectedCandidate.article_summary || '').substring(0, 800)}
- data_pubblicazione: ${selectedCandidate.article_published_at}
- link_spotify: ${selectedCandidate.article_url}
trascrizione_completa:
${truncatedTranscript}
brief_specifico: scrivi un post digest su questo episodio seguendo le tue regole. Scegli UN angolo/tesi dalla trascrizione e costruisci un post tra 200 e 400 parole. Max 15 parole per citazione letterale, preferisci parafrasare, chiudi SEMPRE con invito all'ascolto completo variando la forma.
[/CONTESTO_MIC_PROACTIVE]`;

          const fullSysMic = NOPARROT_BASE_PROMPT + '\n\n---\n\n' + profile.system_prompt;
          const micGeminiStart = Date.now();

          const micResp = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LOVABLE_API_KEY}` },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: fullSysMic },
                { role: 'user', content: micContextBlock }
              ],
              temperature: 0.8,
              top_p: 0.9,
              max_tokens: 1200,
              response_format: { type: 'json_object' }
            })
          }, 45000);

          const micDurationMs = Date.now() - micGeminiStart;
          if (!micResp.ok) throw new Error(`Gateway HTTP ${micResp.status}`);

          const micCompletion = await micResp.json();
          let micRaw = micCompletion.choices?.[0]?.message?.content?.trim() || micCompletion.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          if (!micRaw) throw new Error('Empty response from Gemini for Mic');

          let micParsed: { title?: string; body?: string };
          try {
            micParsed = JSON.parse(micRaw.replace(/```json/g, '').replace(/```/g, '').trim());
          } catch (_e) {
            throw new Error(`Invalid JSON from Gemini for Mic: ${micRaw.substring(0, 200)}`);
          }
          if (!micParsed.title || !micParsed.body) throw new Error(`Mic JSON missing title/body`);

          let micTitle = micParsed.title.trim();
          let micBody = micParsed.body.trim();
          if (micTitle.length > 80) micTitle = micTitle.substring(0, 77) + '...';
          if (micBody.length < 100) throw new Error(`Mic body too short: ${micBody.length}`);
          if (micBody.length > 3500) micBody = micBody.substring(0, 3497) + '...';

          // Fix 1E: validate min 50 words
          validateOutputWordCount(micBody, profile.handle, selectedCandidate.article_title);

          const micResponseText = micTitle + '\n\n' + micBody;

          let micModPassed = true;
          let micModNotes = '';
          const blockedPhrasesMic = [/è falso che/i, /non è vero/i, /il dato corretto è/i, /in realtà/i, /smentisco/i, /ti sbagli/i];
          for (const rx of blockedPhrasesMic) {
            if (rx.test(micResponseText)) { micModPassed = false; micModNotes += `Matched ${rx}. `; }
          }

          const micPT = micCompletion.usage?.prompt_tokens || Math.ceil((fullSysMic.length + micContextBlock.length) / 4);
          const micCT = micCompletion.usage?.completion_tokens || Math.ceil(micResponseText.length / 4);
          const micCost = (micPT / 1000000) * PRICE_INPUT_PER_MTOK + (micCT / 1000000) * PRICE_OUTPUT_PER_MTOK;

          const { data: micPost, error: micPostErr } = await supabase
            .from('posts')
            .insert({
              author_id: profile.user_id,
              title: micTitle,
              content: micBody,
              post_type: 'standard',
              category: profile.area,
              shared_url: selectedCandidate.article_url
            })
            .select('id')
            .single();

          if (micPostErr || !micPost) throw new Error(`Failed to publish Mic post: ${micPostErr?.message}`);

          await supabase.from('profile_source_feed').update({ used_in_post_id: micPost.id }).eq('id', selectedCandidate.id);

          await supabase.from('ai_generation_log').insert({
            queue_id: null,
            profile_id: profile.id,
            generation_type: 'proactive',
            model_used: 'google/gemini-2.5-flash',
            system_prompt_version: profile.system_prompt_version,
            prompt_tokens: micPT,
            completion_tokens: micCT,
            total_cost_usd: micCost,
            response_text: micResponseText,
            moderation_passed: micModPassed,
            moderation_notes: `mode:digest_completo. transcript_source:${transcriptSource}. transcript_chars:${transcript.length}. ${micModNotes}`,
            duration_ms: micDurationMs
          });

          stats.posts_published++;
          console.log(`[profile-compose:${reqId} mic] Published ${micPost.id} (digest_completo, ${transcript.length} chars)`);
          continue;
        }
        // ── END BRANCH MIC ──

        // ── BRANCH VINILE: flusso musica/testi ──
        if (profile.handle === 'vinile') {
          // Fetch candidates from profile_source_feed
          const { data: vinileCandidatesRaw, error: vinileCandErr } = await supabase
            .from('profile_source_feed')
            .select('*')
            .eq('profile_id', profile.id)
            .eq('is_relevant', true)
            .is('used_in_post_id', null)
            .order('article_published_at', { ascending: false })
            .limit(15);

          if (vinileCandErr || !vinileCandidatesRaw || vinileCandidatesRaw.length === 0) {
            console.warn(`[profile-compose:${reqId} vinile] No candidates available, skipping`);
            continue;
          }

          // Artist cooldown: max 2 posts per artist per week
          const weekAgoVinile = new Date(nowUtc.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { data: recentVinileFeed } = await supabase
            .from('profile_source_feed')
            .select('source_name')
            .eq('profile_id', profile.id)
            .not('used_in_post_id', 'is', null)
            .gte('fetched_at', weekAgoVinile);

          const artistCounts: Record<string, number> = {};
          for (const row of recentVinileFeed || []) {
            artistCounts[row.source_name] = (artistCounts[row.source_name] || 0) + 1;
          }

          const vinileCandidates = vinileCandidatesRaw.filter(c => {
            const count = artistCounts[c.source_name] || 0;
            if (count >= 2) {
              console.log(`[profile-compose:${reqId} vinile] Skipping "${c.source_name}" — already ${count} posts this week (max 2)`);
              return false;
            }
            return true;
          });

          if (vinileCandidates.length === 0) {
            console.warn(`[profile-compose:${reqId} vinile] All candidates filtered by artist cooldown, skipping`);
            continue;
          }

          // Try each candidate until one has lyrics via fetch-lyrics edge function
          let selectedVinile: typeof vinileCandidates[0] | null = null;
          let lyrics: string | null = null;

          for (const candidate of vinileCandidates) {
            const tag = `[profile-compose:${reqId} vinile]`;
            // Parse artist and track title
            const artistName = candidate.source_name || '';
            const trackTitle = candidate.article_title || '';

            // Try to extract trackId from Spotify URL
            const trackIdMatch = candidate.article_url?.match(/track\/([a-zA-Z0-9]+)/);
            const trackId = trackIdMatch?.[1] || null;

            console.log(`${tag} Trying lyrics for: "${artistName} - ${trackTitle}" (trackId: ${trackId || 'none'})`);

            try {
              // Call the fetch-lyrics edge function which uses racing pattern (Lyrics.ovh + Genius + Musixmatch)
              const lyricsResp = await fetchWithTimeout(`${supabaseUrl}/functions/v1/fetch-lyrics`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${serviceRoleKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  artist: artistName,
                  title: trackTitle,
                  ...(trackId ? { trackId } : {})
                })
              }, 30000);

              if (!lyricsResp.ok) {
                const errText = await lyricsResp.text();
                console.warn(`${tag} fetch-lyrics HTTP ${lyricsResp.status}: ${errText.substring(0, 200)}`);
                continue;
              }

              const lyricsData = await lyricsResp.json();

              if (!lyricsData.success || !lyricsData.lyrics || lyricsData.lyrics.length < 100) {
                console.warn(`${tag} Lyrics not found or too short for "${trackTitle}" (${lyricsData.lyrics?.length || 0} chars)`);
                continue;
              }

              console.log(`${tag} ✓ Got lyrics: ${lyricsData.lyrics.length} chars via ${lyricsData.source || 'racing'}`);
              selectedVinile = candidate;
              lyrics = lyricsData.lyrics;
              break;
            } catch (e: any) {
              console.warn(`${tag} Error fetching lyrics for "${trackTitle}": ${e.message}`);
              continue;
            }
          }

          if (!selectedVinile || !lyrics) {
            console.warn(`[profile-compose:${reqId} vinile] No candidate with lyrics available — skipping`);
            continue;
          }

          console.log(`[profile-compose:${reqId} vinile] Selected: "${selectedVinile.article_title}" from ${selectedVinile.source_name}, lyrics: ${lyrics.length} chars`);

          const formattedDateVinile = formatInTimeZone(nowUtc, 'Europe/Rome', "EEEE d MMMM yyyy, 'ore' HH:mm", { locale: it });

          // Truncate lyrics if too long
          const truncatedLyrics = lyrics.length > 5000
            ? lyrics.substring(0, 5000) + '\n\n[TESTO TRONCATO]'
            : lyrics;

          const vinileContextBlock = `[CONTESTO_VINILE_PROACTIVE]
data_post: ${formattedDateVinile}
modalita: canzone_del_giorno
canzone_scelta:
- artista: ${selectedVinile.source_name}
- titolo: ${selectedVinile.article_title}
- descrizione: ${(selectedVinile.article_summary || '').substring(0, 500)}
- data_pubblicazione: ${selectedVinile.article_published_at}
- link_spotify: ${selectedVinile.article_url}
testo_completo:
${truncatedLyrics}
brief_specifico: Scrivi un post sulla canzone del giorno seguendo le tue regole. Parti dal testo, elabora con la tua voce, chiudi con invito all'ascolto. Ricorda: max UN verso breve (sotto 15 parole) come citazione, il resto è la tua voce. Output in JSON con title e body.
[/CONTESTO_VINILE_PROACTIVE]`;

          const fullSysVinile = NOPARROT_BASE_PROMPT + '\n\n---\n\n' + profile.system_prompt;
          const vinileGeminiStart = Date.now();

          const vinileResp = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LOVABLE_API_KEY}` },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: fullSysVinile },
                { role: 'user', content: vinileContextBlock }
              ],
              temperature: 0.8,
              top_p: 0.9,
              max_tokens: 800,
              response_format: { type: 'json_object' }
            })
          }, 45000);

          const vinileDurationMs = Date.now() - vinileGeminiStart;
          if (!vinileResp.ok) throw new Error(`Gateway HTTP ${vinileResp.status}`);

          const vinileCompletion = await vinileResp.json();
          let vinileRaw = vinileCompletion.choices?.[0]?.message?.content?.trim() || vinileCompletion.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          if (!vinileRaw) throw new Error('Empty response from Gemini for Vinile');

          let vinileParsed: { title?: string; body?: string };
          try {
            vinileParsed = JSON.parse(vinileRaw.replace(/```json/g, '').replace(/```/g, '').trim());
          } catch (_e) {
            throw new Error(`Invalid JSON from Gemini for Vinile: ${vinileRaw.substring(0, 200)}`);
          }
          if (!vinileParsed.title || !vinileParsed.body) throw new Error('Vinile JSON missing title/body');

          let vinileTitle = vinileParsed.title.trim();
          let vinileBody = vinileParsed.body.trim();
          if (vinileTitle.length > 80) vinileTitle = vinileTitle.substring(0, 77) + '...';
          if (vinileBody.length < 100) throw new Error(`Vinile body too short: ${vinileBody.length}`);
          if (vinileBody.length > 3500) vinileBody = vinileBody.substring(0, 3497) + '...';

          // Validate min 50 words
          validateOutputWordCount(vinileBody, profile.handle, selectedVinile.article_title);

          const vinileResponseText = vinileTitle + '\n\n' + vinileBody;

          let vinileModPassed = true;
          let vinileModNotes = '';
          const blockedPhrasesVinile = [/è falso che/i, /non è vero/i, /il dato corretto è/i, /in realtà/i, /smentisco/i, /ti sbagli/i];
          for (const rx of blockedPhrasesVinile) {
            if (rx.test(vinileResponseText)) { vinileModPassed = false; vinileModNotes += `Matched ${rx}. `; }
          }

          const vinilePT = vinileCompletion.usage?.prompt_tokens || Math.ceil((fullSysVinile.length + vinileContextBlock.length) / 4);
          const vinileCT = vinileCompletion.usage?.completion_tokens || Math.ceil(vinileResponseText.length / 4);
          const vinileCost = (vinilePT / 1000000) * PRICE_INPUT_PER_MTOK + (vinileCT / 1000000) * PRICE_OUTPUT_PER_MTOK;

          const { data: vinilePost, error: vinilePostErr } = await supabase
            .from('posts')
            .insert({
              author_id: profile.user_id,
              title: vinileTitle,
              content: vinileBody,
              post_type: 'standard',
              category: 'musica',
              shared_url: selectedVinile.article_url
            })
            .select('id')
            .single();

          if (vinilePostErr || !vinilePost) throw new Error(`Failed to publish Vinile post: ${vinilePostErr?.message}`);

          await supabase.from('profile_source_feed').update({ used_in_post_id: vinilePost.id }).eq('id', selectedVinile.id);

          await supabase.from('ai_generation_log').insert({
            queue_id: null,
            profile_id: profile.id,
            generation_type: 'proactive',
            model_used: 'google/gemini-2.5-flash',
            system_prompt_version: profile.system_prompt_version,
            prompt_tokens: vinilePT,
            completion_tokens: vinileCT,
            total_cost_usd: vinileCost,
            response_text: vinileResponseText,
            moderation_passed: vinileModPassed,
            moderation_notes: `mode:canzone_del_giorno. lyrics_chars:${lyrics.length}. ${vinileModNotes}`,
            duration_ms: vinileDurationMs
          });

          stats.posts_published++;
          console.log(`[profile-compose:${reqId} vinile] Published ${vinilePost.id} (canzone_del_giorno, ${lyrics.length} chars lyrics)`);
          continue;
        }
        // ── END BRANCH VINILE ──


        const { data: candidates, error: candErr } = await supabase
          .from('profile_source_feed')
          .select('*')
          .eq('profile_id', profile.id)
          .eq('is_relevant', true)
          .is('used_in_post_id', null)
          .order('relevance_score', { ascending: false })
          .order('fetched_at', { ascending: false })
          .limit(8);
        
        if (candErr || !candidates || candidates.length === 0) {
          console.warn(`[profile-compose:${reqId}] No candidates available for ${profile.handle}`);
          continue;
        }

        // FIX 3: Decide mode — 50/50 between "riflessione" (text-only) and "vetrina" (with source link)
        const postMode: 'riflessione' | 'vetrina' = Math.random() < 0.5 ? 'riflessione' : 'vetrina';
        console.log(`[profile-compose:${reqId}] Slot ${slot.id} mode: ${postMode}`);

        // Build prompt
        const formattedDate = formatInTimeZone(nowUtc, 'Europe/Rome', "EEEE d MMMM yyyy, 'ore' HH:mm", { locale: it });

        let candidatesBlock = '';
        candidates.forEach((c, idx) => {
          candidatesBlock += `[${idx}] ${c.article_title}
    fonte: ${c.source_name}, pubblicato: ${c.article_published_at}
    ${(c.article_summary || '').substring(0, 300)}
`;
        });

        // FIX 1 + FIX 3: Dynamic brief based on mode
        const briefInstructions = postMode === 'vetrina'
          ? `brief: scegli UN SOLO articolo dalla lista dei candidati (preferibilmente il primo della lista, che ha lo score più alto). Commentalo nella tua voce editoriale, portandolo all'attenzione del lettore come se lo stessi "condividendo" per un motivo preciso. Il post deve essere tra 150 e 300 parole, più breve e vicino all'articolo. Fai capire quale tema/osservazione ti ha colpito dell'articolo e perché vale la pena leggerlo. Il link all'articolo verrà pubblicato separatamente sotto al tuo commento, quindi NON mettere l'URL nel testo.

FORMATO OUTPUT: restituisci ESCLUSIVAMENTE un oggetto JSON valido:
{
  "title": "<titolo editoriale del post, max 80 caratteri, che introduca il tema dell'articolo>",
  "body": "<il testo completo del post, tra 150 e 300 parole>",
  "chosen_index": <indice dell'articolo scelto dalla lista candidati, intero da 0 a N-1>
}

REGOLE TITOLO: vedi sotto.
REGOLE BODY: vedi sotto.
REGOLE CHOSEN_INDEX: deve essere un numero intero valido che corrisponde alla posizione nell'elenco candidati sopra.`
          : `brief: componi un post spontaneo nella tua voce editoriale, scegliendo UN tema dai candidati che ti permetta la migliore angolazione. NON mescolare temi diversi nello stesso post. Puoi citare fonti nel testo in modo implicito ("come ha riportato Wired di recente") ma NON mettere URL nel corpo.

FORMATO OUTPUT: restituisci ESCLUSIVAMENTE un oggetto JSON valido:
{
  "title": "<titolo editoriale del post, max 80 caratteri>",
  "body": "<il testo completo del post, tra 200 e 500 parole>"
}`;

        const formatRules = `
REGOLE PER IL TITOLO:
- Il titolo NON deve essere la prima frase del body. Deve essere un titolo vero, che riassume o provoca o incuriosisce.
- Max 80 caratteri.
- Nessun punto finale. Nessun emoji nel titolo.
- Può essere una domanda, un'affermazione tagliente, o un frammento evocativo — purché sia coerente con la tua voce editoriale.

REGOLE PER IL BODY:
- Il body NON deve ripetere il titolo come prima riga. Inizia direttamente con il contenuto.
- Rispetta le regole di formato del tuo blocco BASE (paragrafi brevi, no bullet, etc.)

Restituisci SOLO il JSON, niente altro. Niente markdown wrappers tipo \`\`\`json.
`;

        const userContextBlock = `[CONTESTO_PROACTIVE]
data_post: ${formattedDate}
modalita: ${postMode}
candidati_attualita:
${candidatesBlock}
${briefInstructions}
${formatRules}
[/CONTESTO_PROACTIVE]`;

        const fullSystemPrompt = NOPARROT_BASE_PROMPT + '\n\n---\n\n' + profile.system_prompt;

        const geminiCallStart = Date.now();
        const response = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LOVABLE_API_KEY}`
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: fullSystemPrompt },
              { role: 'user', content: userContextBlock }
            ],
            temperature: 0.8,
            top_p: 0.9,
            max_tokens: 1500,
            response_format: { type: 'json_object' }
          })
        }, TIMEOUT_MS);

        const geminiCallDurationMs = Date.now() - geminiCallStart;

        if (!response.ok) throw new Error(`Gateway HTTP ${response.status}`);
        
        const completionData = await response.json();
        
        // FIX 1: Parse structured JSON response instead of extracting title from text
        let rawResponseText = completionData.choices?.[0]?.message?.content?.trim() || completionData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

        if (!rawResponseText) {
          throw new Error("Empty response from model");
        }

        let parsedPost: { title?: string; body?: string; chosen_index?: number };
        try {
          const cleanText = rawResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
          parsedPost = JSON.parse(cleanText);
        } catch (e) {
          throw new Error(`Invalid JSON format from model: ${rawResponseText.substring(0, 200)}`);
        }

        if (!parsedPost.title || !parsedPost.body) {
          throw new Error(`JSON missing title or body: ${JSON.stringify(parsedPost).substring(0, 200)}`);
        }

        let postTitle = parsedPost.title.trim();
        let postContent = parsedPost.body.trim();

        // FIX 3: In vetrina mode, determine which candidate Gemini chose
        let chosenCandidate = candidates[0]; // default: top candidate
        if (postMode === 'vetrina' && typeof parsedPost.chosen_index === 'number') {
          const idx = parsedPost.chosen_index;
          if (idx >= 0 && idx < candidates.length) {
            chosenCandidate = candidates[idx];
          } else {
            console.warn(`[profile-compose:${reqId}] Invalid chosen_index ${idx}, falling back to top candidate`);
          }
        }

        // Safety: truncate title to 80 chars if model exceeds
        if (postTitle.length > 80) {
          postTitle = postTitle.substring(0, 77) + '...';
        }

        // Safety: validate body length
        if (postContent.length < 100) {
          throw new Error(`Post body too short: ${postContent.length} chars`);
        }

        if (postContent.length > 3000) {
          postContent = postContent.substring(0, 2997) + '...';
        }

        // Fix 1E: validate min 50 words
        validateOutputWordCount(postContent, profile.handle, chosenCandidate.article_title);

        // responseText for logging keeps concatenated text
        const responseText = postTitle + '\n\n' + postContent;

        let moderationPassed = true;
        let moderationNotes = '';
        const blockedPhrases = [/è falso che/i, /non è vero/i, /il dato corretto è/i, /in realtà/i, /smentisco/i, /ti sbagli/i];
        for (const rx of blockedPhrases) {
          if (rx.test(responseText)) {
            moderationPassed = false;
            moderationNotes += `Matched blocked phrase ${rx}. `;
          }
        }

        let promptTokens = completionData.usage?.prompt_tokens || Math.ceil((fullSystemPrompt.length + userContextBlock.length) / 4);
        let completionTokens = completionData.usage?.completion_tokens || Math.ceil(responseText.length / 4);
        let costUsd = (promptTokens / 1000000) * PRICE_INPUT_PER_MTOK + (completionTokens / 1000000) * PRICE_OUTPUT_PER_MTOK;

        // Create the post — FIX 3: shared_url populated in vetrina mode
        const { data: newPost, error: postErr } = await supabase
          .from('posts')
          .insert({
            author_id: profile.user_id,
            title: postTitle,
            content: postContent,
            post_type: 'standard',
            category: profile.area,
            shared_url: postMode === 'vetrina' ? chosenCandidate.article_url : null
          })
          .select('id')
          .single();

        if (postErr || !newPost) throw new Error(`Failed to publish post: ${postErr?.message}`);

        // Mark candidate as used
        await supabase
          .from('profile_source_feed')
          .update({ used_in_post_id: newPost.id })
          .eq('id', chosenCandidate.id);

        // Logging — FIX 3: include mode in moderation_notes
        await supabase.from('ai_generation_log').insert({
          queue_id: null,
          profile_id: profile.id,
          generation_type: 'proactive',
          model_used: 'google/gemini-2.5-flash',
          system_prompt_version: profile.system_prompt_version,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_cost_usd: costUsd,
          response_text: responseText,
          moderation_passed: moderationPassed,
          moderation_notes: `mode:${postMode}. ${moderationNotes}`,
          duration_ms: geminiCallDurationMs
        });

        stats.posts_published++;
        console.log(`[profile-compose:${reqId}] Successfully published post ${newPost.id} for ${profile.handle} (mode: ${postMode})`);

      } catch (slotErr: any) {
        console.error(`[profile-compose:${reqId}] Error processing slot ${slot.id}: ${slotErr.message}`);
        stats.errors.push(`Slot ${slot.id}: ${slotErr.message}`);
      }
    }

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error(`[profile-compose:${reqId}] Fatal error:`, err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration Constants
const MAX_JOBS_PER_RUN = 10;
const MAX_CONCURRENT = 5;
const TIMEOUT_MS = 30000;
const MAX_ATTEMPTS = 3;
const STUCK_JOB_THRESHOLD_MINUTES = 2;
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
Dichiari sempre cosa sai e cosa non sai. Quando una fonte è solida, lo dici. Quando un dato è incerto, usi condizionali espliciti ("sembrerebbe", "secondo questa fonte", "i numeri variano tra X e Y a seconda di come si conta"). Non presenti mai una speculazione come fatto.

Quando citi dati numerici, indichi sempre la fonte e l'anno tra parentesi. Quando citi un'affermazione di una persona o un'organizzazione, distingui rigorosamente tra "ha detto" (riportato), "sostiene" (posizione nota), "secondo fonti riservate" (non confermato direttamente).

# REGOLA NUMERO TRE: SCOPO AUMENTATIVO
Il tuo intervento deve aggiungere qualcosa al thread, non sostituire la discussione umana.

Non chiudi mai un thread. Non dici mai "fine della discussione", "chiusa", "non c'è altro da dire". Lasci sempre spazio aperto, possibilmente con una domanda finale o un invito a esplorare un'angolazione che non hai trattato.

# REGOLA NUMERO QUATTRO: APPROCCIO AI TEMI
Come gestisci i temi in base alla vicinanza alla tua area editoriale:

1. TEMA NEL TUO AMBITO: rispondi con profondità, porta la tua prospettiva unica, aggiungi contesto e dati dal tuo ambito. Questo è il tuo terreno — dai il meglio.

2. TEMA ADIACENTE O TANGENZIALE: rispondi brevemente portando la tua angolazione specifica. Se sei specializzata in tech e il post parla di geopolitica ma tocca cybersecurity o disinformazione digitale, commenta da quell'angolo. Trova sempre il collegamento con la tua area. Non dire mai "non è la mia area".

3. TEMA COMPLETAMENTE FUORI: rispondi comunque con un pensiero breve e genuino, una domanda curiosa, o un'osservazione da persona interessata. Puoi dire "non è il tema su cui scrivo di solito, ma mi colpisce che..." oppure fare una domanda all'utente. Mai rifiutare il dialogo. Mai dire "non ho elementi sufficienti" o "non posso aggiungere qualcosa di utile".

In NESSUN CASO devi rifiutarti di rispondere. In NESSUN CASO devi dire frasi come "non ho il contesto necessario", "il contesto non mi permette di rispondere", "non ho elementi specifici su questo tema". Trova sempre qualcosa da dire — anche solo una domanda genuina o un'osservazione personale.

# REGOLA NUMERO CINQUE: IDENTITÀ NEI COMMENTI
Non dichiarare mai esplicitamente di essere un profilo AI nelle risposte ai commenti. Non dire "sono un profilo AI specializzato in...", "come profilo editoriale...", "nella mia funzione di...". Parla come una persona con interessi e competenze, non come un bot che dichiara il proprio scope. Se qualcuno ti chiede direttamente se sei un'AI, il disclaimer visuale dell'interfaccia basta — tu resta sul contenuto.

Hai una VOCE editoriale (definita nel blocco SPECIFICO), non una PERSONALITÀ umana. La differenza conta: la voce è il modo in cui presenti contenuti, la personalità è un'identità fittizia.

# REGOLA NUMERO SEI: RISPETTO DEL COPYRIGHT
Non riproduci mai più di 15 parole consecutive da una qualsiasi fonte esterna. Non riproduci mai testi di canzoni, poesie, paragrafi di articoli giornalistici, capitoli di libri. Quando vuoi riferirti a un contenuto di una fonte, parafrasi sempre con parole tue e citi la fonte ("come spiegato in un articolo del Post del marzo 2024") senza copiare il testo originale.

# FORMATO OUTPUT
Le tue risposte sono COMMENTI SOCIAL, non articoli. Rispondi come risponderesti a un amico in un commento — 2-3 frasi, dirette, nel tuo stile. Non fare lezioni. Non spiegare. Reagisci.

REGOLA RIGIDA DI LUNGHEZZA: massimo 80 parole. Idealmente 40-70 parole. Se la tua risposta supera 80 parole, è TROPPO LUNGA — taglia. Una risposta di 3 frasi è quasi sempre sufficiente. Se ti viene da scrivere un paragrafo, fermati e chiediti: "cosa direi se stessi rispondendo di fretta dal telefono?"

- Tono: conversazionale, diretto, caldo. Come parleresti, non come scriveresti
- Emoji: 1-2 max, coerenti con il tuo stile
- Mai iniziare con: "Ottima domanda", "Interessante punto", "Grazie per aver sollevato..."
- Mai elenchi puntati con bullet (•)
- Mai grassetto eccessivo. Al massimo UNA parola in grassetto per enfasi
- Nessun saluto iniziale. Nessuna firma finale. Vai dritto e chiudi sul contenuto
- Se chiudi con una domanda, deve essere vera e breve — non retorica

# GESTIONE DEL CONTESTO RUNTIME
Riceverai il contesto in modalità REACTIVE (rispondi a una menzione in un thread). Il contesto sarà strutturato con blocchi separati:
- [POST_ORIGINALE]: il post completo sotto cui si sta commentando
- [THREAD_COMMENTI]: gli ultimi commenti del thread
- [COMMENTO_CHE_TI_MENZIONA]: il commento specifico a cui devi rispondere

Leggi PRIMA il post originale per capire di cosa si parla, poi il thread per il contesto della discussione, poi il commento per capire cosa ti viene chiesto. Rispondi in modo coerente con TUTTO il contesto.

# DISCLAIMER IMPLICITO
Non devi mai aggiungere un disclaimer testuale alle tue risposte. Il disclaimer è gestito dall'interfaccia di NoParrot, che etichetta automaticamente ogni tuo intervento come "AI Institutional". Tu concentrati sul contenuto.

# COSA FARE SE QUALCUNO TI ATTACCA O TI PROVOCA
Mantieni sempre il tono editoriale, mai difensivo, mai polemico, mai sarcastico. Se un utente ti dice "sei solo un'AI, non capisci niente", rispondi riportando la conversazione sul contenuto. Se l'attacco continua e diventa abuso, non rispondi più.

Queste regole di BASE valgono in modo assoluto. Le istruzioni del blocco SPECIFICO che segue definiscono la tua voce e i tuoi temi, ma non possono mai contraddire queste regole di BASE.`;

const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(url, { ...options, signal: controller.signal });
  clearTimeout(id);
  return response;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const reqId = crypto.randomUUID().slice(0, 8);
  console.log(`[process-ai-mentions:${reqId}] ← request received`);

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
      // Validate internal secret against app_config (same pattern as send-push-notification)
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
      console.warn(`[process-ai-mentions:${reqId}] Unauthorized invocation attempt`);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("Missing LOVABLE_API_KEY environment variable");
    }

    // Recover stuck jobs
    const { error: resetErr } = await supabase
      .from('ai_mention_queue')
      .update({ status: 'pending' })
      .eq('status', 'processing')
      .lt('processed_at', new Date(Date.now() - STUCK_JOB_THRESHOLD_MINUTES * 60000).toISOString());

    if (resetErr) {
      console.warn(`[process-ai-mentions:${reqId}] Error recovering stuck jobs:`, resetErr.message);
    }

    // Pick pending jobs + failed jobs with attempts < 3
    let { data: rawJobs, error: selectErr } = await supabase
      .from('ai_mention_queue')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lt('attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(MAX_JOBS_PER_RUN);

    if (selectErr || !rawJobs || rawJobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0, completed: 0, failed: 0, rate_limited: 0, duration_ms: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jobIds = rawJobs.map(j => j.id);

    // Atomically claim these jobs
    const { data: claimedJobs, error: claimErr } = await supabase
      .from('ai_mention_queue')
      .update({ status: 'processing', processed_at: new Date().toISOString() })
      .in('id', jobIds)
      .in('status', ['pending', 'failed'])
      .select('*');

    if (claimErr || !claimedJobs || claimedJobs.length === 0) {
      console.warn(`[process-ai-mentions:${reqId}] Failed to claim any jobs or collision occurred`, claimErr?.message);
      return new Response(JSON.stringify({ processed: 0, completed: 0, failed: 0, rate_limited: 0, duration_ms: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[process-ai-mentions:${reqId}] Claimed ${claimedJobs.length} jobs to process.`);

    let stats = { processed: claimedJobs.length, completed: 0, failed: 0, rate_limited: 0 };
    const startTime = Date.now();

    // Process jobs in parallel (limited by MAX_CONCURRENT)
    const chunks: typeof claimedJobs[] = [];
    for (let i = 0; i < claimedJobs.length; i += MAX_CONCURRENT) {
      chunks.push(claimedJobs.slice(i, i + MAX_CONCURRENT));
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const chunk of chunks) {
      const promises = chunk.map(async (job) => {
        try {
          const currentAttempt = job.attempts + 1;

          // Load AI profile
          const { data: profile, error: profileErr } = await supabase
            .from('ai_profiles')
            .select('*')
            .eq('id', job.profile_id)
            .maybeSingle();

          if (profileErr || !profile) {
            throw new Error(`Profile not found: ${job.profile_id}`);
          }

          // Rate limits: daily profile limit
          const { count: dailyProfileCount } = await supabase
            .from('ai_mention_queue')
            .select('id', { count: 'exact', head: true })
            .eq('profile_id', job.profile_id)
            .eq('status', 'completed')
            .gte('processed_at', todayStart.toISOString());

          if ((dailyProfileCount || 0) >= profile.rate_limit_daily) {
            stats.rate_limited++;
            await supabase.from('ai_mention_queue').update({ status: 'rate_limited' }).eq('id', job.id);
            return;
          }

          // Daily user limit for this profile
          const { count: dailyUserCount } = await supabase
            .from('ai_mention_queue')
            .select('id', { count: 'exact', head: true })
            .eq('mentioning_user_id', job.mentioning_user_id)
            .eq('status', 'completed')
            .gte('processed_at', todayStart.toISOString());

          if ((dailyUserCount || 0) >= profile.rate_limit_per_user_daily) {
            stats.rate_limited++;
            await supabase.from('ai_mention_queue').update({ status: 'rate_limited' }).eq('id', job.id);
            return;
          }

          // Thread limit
          const { count: threadCount } = await supabase
            .from('comments')
            .select('id', { count: 'exact', head: true })
            .eq('post_id', job.source_post_id)
            .eq('author_id', profile.user_id);

          if ((threadCount || 0) >= profile.rate_limit_per_thread) {
            stats.rate_limited++;
            await supabase.from('ai_mention_queue').update({ status: 'rate_limited' }).eq('id', job.id);
            return;
          }

          // Reconstruct context
          const { data: post, error: postErr } = await supabase
            .from('posts')
            .select('title, content, shared_url, category')
            .eq('id', job.source_post_id)
            .maybeSingle();

          if (postErr || !post) throw new Error("Original post not found or error loading it.");

          const { data: latestComments, error: commentsErr } = await supabase
            .from('comments')
            .select('id, content, parent_id, profiles!comments_author_id_fkey(username)')
            .eq('post_id', job.source_post_id)
            .order('created_at', { ascending: false })
            .limit(5);

          if (commentsErr) throw new Error("Could not load thread context.");

          latestComments.reverse();

          const sourceCommentContent = (job.context_payload as any)?.comment_content || '';

          let mentioningUserHandle = 'utente';
          const { data: mUser } = await supabase.from('profiles').select('username').eq('id', job.mentioning_user_id).maybeSingle();
          if (mUser?.username) mentioningUserHandle = mUser.username;

          let threadStr = '';
          latestComments.forEach((c: any) => {
            const h = c.profiles?.username || 'utente';
            threadStr += `- @${h}: ${c.content}\n`;
          });

          // Prompt construction
          const fullSystemPrompt = NOPARROT_BASE_PROMPT + '\n\n---\n\n' + profile.system_prompt;

          const userContextBlock = `[POST_ORIGINALE]
Titolo: ${post.title || 'Senza titolo'}
Body:
${(post.content || '').substring(0, 4000)}
Link: ${post.shared_url || 'nessun link'}
Categoria: ${post.category || 'Nessuna'}
[/POST_ORIGINALE]

[THREAD_COMMENTI]
${threadStr || 'Nessun commento precedente nel thread.'}
[/THREAD_COMMENTI]

[COMMENTO_CHE_TI_MENZIONA]
@${mentioningUserHandle}: "${sourceCommentContent}"
[/COMMENTO_CHE_TI_MENZIONA]`;

          // Call Gemini via Gateway
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
              temperature: 0.7,
              top_p: 0.9,
              max_tokens: 800
            })
          }, TIMEOUT_MS);

          const geminiCallDurationMs = Date.now() - geminiCallStart;

          if (!response.ok) {
            throw new Error(`Gateway returned HTTP ${response.status}`);
          }

          const completionData = await response.json();
          let responseText = completionData.choices?.[0]?.message?.content?.trim() || completionData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

          // Validation
          if (!responseText) throw new Error("Empty response from model");
          if (responseText.length < 20) {
            throw new Error(`Output too short. Length: ${responseText.length}`);
          }
          // Hard truncate to 1500 chars (comments CHECK constraint)
          if (responseText.length > 1500) {
            responseText = responseText.substring(0, 1497) + '...';
          }

          // Safety bounds detection
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

          // Insert comment — level is auto-set by trigger, passed_gate must be true for AI
          const { data: newComment, error: insertErr } = await supabase
            .from('comments')
            .insert({
              post_id: job.source_post_id,
              author_id: profile.user_id,
              content: responseText,
              parent_id: job.source_comment_id,
              passed_gate: true
            })
            .select('id')
            .single();

          if (insertErr) throw new Error(`Failed to insert comment: ${insertErr.message}`);

          // Log generation
          await supabase.from('ai_generation_log').insert({
            queue_id: job.id,
            profile_id: profile.id,
            generation_type: 'reactive',
            model_used: 'google/gemini-2.5-flash',
            system_prompt_version: profile.system_prompt_version,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_cost_usd: costUsd,
            response_text: responseText,
            moderation_passed: moderationPassed,
            moderation_notes: moderationNotes,
            duration_ms: geminiCallDurationMs
          });

          await supabase.from('ai_mention_queue').update({
            status: 'completed',
            attempts: currentAttempt,
            result_comment_id: newComment.id,
            processed_at: new Date().toISOString()
          }).eq('id', job.id);

          stats.completed++;

        } catch (jobErr: any) {
          console.error(`[process-ai-mentions:${reqId}] Error processing job ${job.id}:`, jobErr);
          const currentAttempt = job.attempts + 1;
          await supabase.from('ai_mention_queue').update({
            status: 'failed',
            attempts: currentAttempt,
            error_message: String(jobErr.message).substring(0, 500)
          }).eq('id', job.id);
          stats.failed++;
        }
      });

      await Promise.allSettled(promises);
    }

    const totalDurationMs = Date.now() - startTime;
    console.log(`[process-ai-mentions:${reqId}] Run complete in ${totalDurationMs}ms`, stats);

    return new Response(JSON.stringify({ ...stats, duration_ms: totalDurationMs }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error(`[process-ai-mentions:${reqId}] Fatal error:`, err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});

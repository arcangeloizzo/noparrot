// Edge Function: generate-pulse-narrative
// Genera (o ritorna da cache 24h) una sintesi narrativa AI della
// "traiettoria intellettuale" di un utente basata sulle sue ultime
// comprensioni (post per cui ha completato il Comprehension Gate).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const CACHE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_COMPREHENSIONS = 10;

const FALLBACK = {
  narrative:
    "Settimana tranquilla — pochi contenuti compresi. A volte rallentare serve a riprendere slancio. Riparti dalle categorie che ti interessano di più per ritrovare il ritmo.",
  trajectory_label: "",
  focus_phrase: "",
  _fallback: true as const,
};

const CATEGORY_NAMES = [
  "Società", "Politica", "Economia", "Tecnologia",
  "Scienza", "Cultura", "Ambiente", "Benessere",
];

const SYSTEM_PROMPT = `Sei il narratore della "Pulse Settimanale" su NoParrot, una piattaforma di comprensione cognitiva.

Ricevi i dati delle attività dell'utente nell'ultima settimana:
- Categorie dei contenuti compresi (con conteggio per categoria)
- Titoli dei contenuti compresi
- Streak (giorni consecutivi con almeno 1 comprensione)
- Totale comprensioni della settimana

Scrivi un paragrafo di 2-3 frasi in italiano, seconda persona singolare ("hai", "stai", "ti").

REGOLE OBBLIGATORIE:
1. Nomina SEMPRE le 1-2 categorie dominanti della settimana (es. "Tecnologia", "Politica"). Usa esattamente i nomi canonici tra: ${CATEGORY_NAMES.join(", ")}.
2. Se ci sono pattern osservabili (es. due categorie collegate, o focus su un singolo tema), descrivili in modo concreto.
3. Se lo streak è ≥3, menzionalo naturalmente (es. "5 giorni di fila").
4. Chiudi con un'osservazione orientata al futuro: cosa potrebbe esplorare dopo, basandoti sulle categorie meno attive o su connessioni tra quelle attive.

REGOLE DI STILE:
- Tono: curioso e incoraggiante, MAI professorale o giudicante.
- Linguaggio concreto: niente metafore astratte (no "esploratore di idee", no "punto cardinale", no "mappa mentale", no "bussola intellettuale").
- Lunghezza: 40-70 parole. Mai oltre 70.
- Non usare emoji.
- Non iniziare con "Questa settimana" (troppo meccanico). Inizia con un'osservazione sul pattern.

ESEMPI DI OUTPUT CORRETTO:
Input: 5 comprensioni Tecnologia, 3 Politica, 1 Cultura, streak 4
Output: "Tecnologia e Politica hanno dominato i tuoi ultimi giorni — 8 contenuti in 4 giorni consecutivi. Stai costruendo una visione che collega innovazione e regolamentazione. Economia potrebbe essere il tassello mancante per completare il quadro."

Input: 7 comprensioni Cultura, 2 Società, streak 1
Output: "Forte immersione nella Cultura questa settimana, con 7 contenuti compresi. Hai toccato anche Società, ma il grosso della tua attenzione è rimasto su un asse umanistico. Scienza o Tecnologia potrebbero offrirti un contrappunto interessante."

Input: 1 comprensione Economia, streak 0
Output: "Settimana tranquilla — un solo contenuto, in Economia. A volte rallentare serve a riprendere slancio. Il tuo profilo mostra forza in Cultura e Società: potresti ripartire da lì."

Output JSON STRETTO con questo schema:
{
  "narrative": "il paragrafo di 40-70 parole, secondo le regole sopra",
  "dominant_categories": ["Categoria1", "Categoria2"]
}

- dominant_categories: array di 1-2 categorie dominanti nominate dentro narrative (nomi canonici esatti).
- Output SOLO JSON valido. Niente preamboli, niente markdown.`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function startOfDayUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function computeStreakDays(timestamps: string[]): number {
  if (timestamps.length === 0) return 0;
  // Set of unique day-buckets (UTC) where user completed at least one gate
  const days = new Set<number>();
  for (const ts of timestamps) {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) days.add(startOfDayUTC(d));
  }
  const today = startOfDayUTC(new Date());
  let streak = 0;
  let cursor = today;
  // Allow today to be empty: streak starts from yesterday in that case
  if (!days.has(cursor)) {
    cursor -= 24 * 60 * 60 * 1000;
    if (!days.has(cursor)) return 0;
  }
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 24 * 60 * 60 * 1000;
  }
  return streak;
}

function countLastWeek(timestamps: string[]): number {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let n = 0;
  for (const ts of timestamps) {
    const t = new Date(ts).getTime();
    if (!isNaN(t) && t >= cutoff) n += 1;
  }
  return n;
}

function tryParseAiJson(raw: string): Record<string, unknown> | null {
  // Strip code fences and surrounding whitespace
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  // Best-effort: locate first { and last }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ── 1. Auth: verify JWT and extract user_id ─────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  if (!token) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userRes, error: userErr } = await supabaseAuth.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return jsonResponse({ error: "Invalid or expired token" }, 401);
  }
  const userId = userRes.user.id;

  // Service-role client for DB operations (bypasses RLS by design)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let forceRefresh = false;
  try {
    const body = await req.json().catch(() => ({}));
    forceRefresh = body?.force_refresh === true;
  } catch {
    // ignore
  }

  // ── 3. Cache check ───────────────────────────────────────────────────────
  if (!forceRefresh) {
    const { data: cached, error: cacheErr } = await supabase
      .from("user_pulse_snapshots")
      .select(
        "narrative, trajectory_label, focus_phrase, streak_days, count_week, generated_at",
      )
      .eq("user_id", userId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cacheErr) {
      console.error("[generate-pulse-narrative] cache lookup error:", cacheErr.message);
    } else if (cached) {
      const age = Date.now() - new Date(cached.generated_at).getTime();
      if (age < CACHE_WINDOW_MS) {
        return jsonResponse({ ...cached, from_cache: true });
      }
    }
  }

  // ── 4. Gather data: last-week passed gate attempts ──────────────────────
  // Gates can be tied to a post via post_id OR completed during composition
  // (gate_type='composer') with only a source_url. We resolve both paths.
  const weekCutoffIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: weekAttempts, error: gatedErr } = await supabase
    .from("post_gate_attempts")
    .select("created_at, post_id, source_url")
    .eq("user_id", userId)
    .eq("passed", true)
    .gte("created_at", weekCutoffIso)
    .order("created_at", { ascending: false });

  if (gatedErr) {
    console.error("[generate-pulse-narrative] gated query error:", gatedErr.message);
    return jsonResponse({ error: "Failed to load comprehensions" }, 500);
  }

  // Collect distinct post_ids and source_urls to resolve
  const postIds = Array.from(
    new Set(
      (weekAttempts ?? [])
        .map((r: any) => r.post_id)
        .filter((x: unknown): x is string => typeof x === "string" && x.length > 0),
    ),
  );
  const sourceUrls = Array.from(
    new Set(
      (weekAttempts ?? [])
        .filter((r: any) => !r.post_id && typeof r.source_url === "string" && r.source_url.length > 0)
        .map((r: any) => r.source_url as string),
    ),
  );

  type PostInfo = { content: string | null; shared_title: string | null; category: string | null };
  const postsById = new Map<string, PostInfo>();
  const postsByUrl = new Map<string, PostInfo>();

  if (postIds.length > 0) {
    const { data: postsA } = await supabase
      .from("posts")
      .select("id, content, shared_title, category")
      .in("id", postIds);
    for (const p of postsA ?? []) postsById.set((p as any).id, p as PostInfo);
  }
  if (sourceUrls.length > 0) {
    // Try to match user's own posts created from the same source URL.
    const { data: postsB } = await supabase
      .from("posts")
      .select("shared_url, content, shared_title, category")
      .eq("author_id", userId)
      .in("shared_url", sourceUrls);
    for (const p of postsB ?? []) {
      const url = (p as any).shared_url as string | null;
      if (url && !postsByUrl.has(url)) postsByUrl.set(url, p as PostInfo);
    }
  }

  const resolved = (weekAttempts ?? []).map((row: any) => {
    const info: PostInfo | undefined =
      (row.post_id && postsById.get(row.post_id)) ||
      (row.source_url && postsByUrl.get(row.source_url)) ||
      undefined;
    const title =
      (info?.shared_title && String(info.shared_title).trim()) ||
      (info?.content ? String(info.content).slice(0, 80).trim() : "") ||
      (row.source_url ? String(row.source_url).slice(0, 80) : "Senza titolo");
    const category = (info?.category && String(info.category).trim()) || "Generale";
    return { title, category, created_at: row.created_at as string };
  });

  // Streak/week need ALL recent timestamps (not capped at 10).
  // Pull the last 60 days of attempts for accurate streak/week metrics.
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: tsRows, error: tsErr } = await supabase
    .from("post_gate_attempts")
    .select("created_at")
    .eq("user_id", userId)
    .eq("passed", true)
    .gte("created_at", sixtyDaysAgo);

  if (tsErr) {
    console.error("[generate-pulse-narrative] timestamps query error:", tsErr.message);
  }
  const allTimestamps: string[] = (tsRows ?? [])
    .map((r: { created_at: string | null }) => r.created_at)
    .filter((x): x is string => !!x);

  const streakDays = computeStreakDays(allTimestamps);
  const countWeek = countLastWeek(allTimestamps);

  // Audit payload: what we actually fed the model
  const auditPayload = resolved.slice(0, MAX_COMPREHENSIONS).map((c) => ({
    title: c.title,
    category: c.category,
  }));

  // ── 5. Build user prompt ─────────────────────────────────────────────────
  const weekComps = resolved;

  const categoryCounts: Record<string, number> = {};
  for (const c of weekComps) {
    categoryCounts[c.category] = (categoryCounts[c.category] ?? 0) + 1;
  }
  const sortedCounts = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const countsLine = sortedCounts.length
    ? sortedCounts.map(([cat, n]) => `${cat}: ${n}`).join(", ")
    : "(nessuna categoria)";

  const titlesList = weekComps
    .slice(0, 5)
    .map((c) => `- [${c.category}] ${c.title}`)
    .join("\n");

  const userPrompt = `DATI ATTIVITÀ DELL'UTENTE (ultima settimana):

Totale comprensioni settimana: ${countWeek}
Streak (giorni consecutivi): ${streakDays}

Conteggi per categoria:
${countsLine}

Ultimi titoli compresi (max 5):
${titlesList || "(nessuno)"}

Genera la pulse narrativa secondo lo schema JSON.`;

  // ── 6. Call Lovable AI Gateway ───────────────────────────────────────────
  let parsed: Record<string, unknown> | null = null;
  let usedFallback = false;

  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiResp.status === 429) {
      console.warn("[generate-pulse-narrative] AI rate-limited (429)");
      usedFallback = true;
    } else if (aiResp.status === 402) {
      console.warn("[generate-pulse-narrative] AI credits exhausted (402)");
      usedFallback = true;
    } else if (!aiResp.ok) {
      const txt = await aiResp.text().catch(() => "");
      console.error("[generate-pulse-narrative] AI error:", aiResp.status, txt.slice(0, 200));
      usedFallback = true;
    } else {
      const aiJson = await aiResp.json();
      const raw: string = aiJson?.choices?.[0]?.message?.content ?? "";
      parsed = tryParseAiJson(raw);
      if (!parsed) {
        console.warn("[generate-pulse-narrative] failed to parse AI output:", raw.slice(0, 200));
        usedFallback = true;
      }
    }
  } catch (e) {
    console.error("[generate-pulse-narrative] AI gateway exception:", (e as Error).message);
    usedFallback = true;
  }

  // ── 7. Validate and assemble final result ────────────────────────────────
  let narrative: string;
  let trajectory_label: string;
  let focus_phrase: string;
  let dominant_categories: string[] = [];

  if (usedFallback || !parsed) {
    narrative = FALLBACK.narrative;
    trajectory_label = FALLBACK.trajectory_label;
    focus_phrase = FALLBACK.focus_phrase;
  } else {
    narrative = String(parsed.narrative ?? "").trim();
    const rawDom = parsed.dominant_categories;
    if (Array.isArray(rawDom)) {
      dominant_categories = rawDom
        .map((s) => String(s ?? "").trim())
        .filter((s) => s.length > 0)
        .slice(0, 2);
    }
    // Map dominant_categories → legacy fields for DB back-compat
    trajectory_label = dominant_categories[0] ?? "";
    focus_phrase = dominant_categories[1] ?? "";

    if (!narrative) {
      console.warn("[generate-pulse-narrative] missing narrative in AI output");
      narrative = FALLBACK.narrative;
      trajectory_label = FALLBACK.trajectory_label;
      focus_phrase = FALLBACK.focus_phrase;
      usedFallback = true;
    }
  }

  // ── 8. Persist snapshot ──────────────────────────────────────────────────
  const { data: inserted, error: insertErr } = await supabase
    .from("user_pulse_snapshots")
    .insert({
      user_id: userId,
      narrative,
      trajectory_label,
      focus_phrase,
      streak_days: streakDays,
      count_week: countWeek,
      comprehensions_analyzed: auditPayload,
    })
    .select("generated_at")
    .single();

  if (insertErr) {
    console.error("[generate-pulse-narrative] insert error:", insertErr.message);
    // Still return result to caller even if persistence fails.
  }

  const generatedAt =
    inserted?.generated_at ?? new Date().toISOString();

  return jsonResponse({
    narrative,
    trajectory_label,
    focus_phrase,
    streak_days: streakDays,
    count_week: countWeek,
    generated_at: generatedAt,
    from_cache: false,
    ...(usedFallback ? { _fallback: true } : {}),
  });
});
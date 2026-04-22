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
    "La tua traiettoria sta prendendo forma. Continua a esplorare per vedere emergere un disegno.",
  trajectory_label: "esploratore in formazione",
  focus_phrase: "un disegno",
  _fallback: true as const,
};

const SYSTEM_PROMPT = `Sei l'AI di NoParrot, una piattaforma cognitiva italiana dove gli utenti devono comprendere i contenuti prima di commentarli. Il tuo compito è analizzare le ultime comprensioni di un utente e scrivere una breve sintesi narrativa che interpreti la DIREZIONE della sua curiosità intellettuale.

Tono richiesto:
- Lucido, intelligente, leggermente poetico ma mai retorico.
- Mai motivazionale spiccio ("continua così!", "bravo!").
- Mai esclamativi.
- Mai banale (evita "stai esplorando vari temi").
- Italiano colto ma non oscuro.
- Parla SEMPRE all'utente in seconda persona singolare ("tu", "tua", "stai", "ti"). Mai in terza persona ("la sua", "lui/lei", "rivelandosi"). L'utente sta leggendo una riflessione su se stesso, non un profilo di terzi.
- Niente giudizi morali sui temi esplorati. Descrivi cosa l'utente sta esplorando, non valutarlo (no "particolarmente oscure", "preoccupanti", "controverse"). Lascia che sia l'utente a interpretare.
- Verbi al presente indicativo, mai al gerundio iniziale ("rivelandosi", "diventando" come prima parola sono pesanti).

ESEMPIO DI BUONA NARRATIVE (per calibrare il tono):
"La tua attenzione si concentra su come l'attenzione diventa merce. Stai diventando un osservatore della polarizzazione che cerca pattern dove altri vedono solo rumore."

ESEMPIO DA EVITARE:
"La sua curiosità si rivolge a temi oscuri della società contemporanea, rivelando un osservatore attento ma forse troppo concentrato sulla negatività."

Output JSON STRETTO con questo schema:
{
  "narrative": "frase italiana di 20-35 parole che descrive la traiettoria intellettuale, contenente sia la trajectory_label che la focus_phrase come parti integrate del testo",
  "trajectory_label": "etichetta breve di 3-6 parole che identifica chi sta diventando l'utente intellettualmente, es. 'osservatore della polarizzazione' / 'cartografo dell'intelligenza artificiale' / 'studioso di sistemi sociali' / 'esploratore della psiche collettiva'",
  "focus_phrase": "frase di 4-8 parole che identifica il tema più ricorrente nelle comprensioni, es. 'come l'attenzione diventa merce' / 'il declino della fiducia istituzionale' / 'i limiti della razionalità umana'"
}

REGOLE:
1. La trajectory_label DEVE comparire letteralmente dentro narrative.
2. La focus_phrase DEVE comparire letteralmente dentro narrative.
3. Output SOLO JSON valido. Niente preamboli, niente markdown, niente testo extra.
4. Se i dati sono insufficienti (meno di 3 comprensioni), genera comunque qualcosa di sensato basato su ciò che c'è, ma con tono che suggerisca "early stages".`;

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

  // ── 4. Gather data: last N comprehensions (post_gate_attempts passed) ───
  // Same source feeding the Cognitive Diary in Profile.tsx / UserProfile.tsx.
  const { data: gatedAttempts, error: gatedErr } = await supabase
    .from("post_gate_attempts")
    .select(
      `created_at,
       posts:post_id (
         id, content, shared_title, category
       )`,
    )
    .eq("user_id", userId)
    .eq("passed", true)
    .order("created_at", { ascending: false })
    .limit(MAX_COMPREHENSIONS);

  if (gatedErr) {
    console.error("[generate-pulse-narrative] gated query error:", gatedErr.message);
    return jsonResponse({ error: "Failed to load comprehensions" }, 500);
  }

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

  // Build comprehension list for the prompt
  const comprehensions = (gatedAttempts ?? [])
    .map((row: any) => {
      const post = row?.posts;
      if (!post) return null;
      const title: string =
        (post.shared_title && String(post.shared_title).trim()) ||
        (post.content ? String(post.content).slice(0, 80).trim() : "Senza titolo");
      const category: string =
        (post.category && String(post.category).trim()) || "Generale";
      const snippet: string = post.content
        ? String(post.content).replace(/\s+/g, " ").trim().slice(0, 100)
        : "";
      return { title, category, snippet };
    })
    .filter((x): x is { title: string; category: string; snippet: string } => x !== null);

  const auditPayload = comprehensions.map((c) => ({
    title: c.title,
    category: c.category,
  }));

  // ── 5. Build user prompt ─────────────────────────────────────────────────
  const userLines = comprehensions
    .map(
      (c) =>
        `- [${c.category}] ${c.title}` + (c.snippet ? `\n    ${c.snippet}` : ""),
    )
    .join("\n");

  const userPrompt = `ULTIME COMPRENSIONI DELL'UTENTE (le più recenti per prime):

${userLines || "(nessuna comprensione registrata)"}

Genera la pulse narrativa secondo lo schema.`;

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

  if (usedFallback || !parsed) {
    narrative = FALLBACK.narrative;
    trajectory_label = FALLBACK.trajectory_label;
    focus_phrase = FALLBACK.focus_phrase;
  } else {
    narrative = String(parsed.narrative ?? "").trim();
    trajectory_label = String(parsed.trajectory_label ?? "").trim();
    focus_phrase = String(parsed.focus_phrase ?? "").trim();

    if (!narrative || !trajectory_label || !focus_phrase) {
      console.warn("[generate-pulse-narrative] missing required fields in AI output");
      narrative = FALLBACK.narrative;
      trajectory_label = FALLBACK.trajectory_label;
      focus_phrase = FALLBACK.focus_phrase;
      usedFallback = true;
    } else {
      const lower = narrative.toLowerCase();
      if (!lower.includes(trajectory_label.toLowerCase())) {
        console.warn(
          "[generate-pulse-narrative] trajectory_label not contained in narrative",
        );
      }
      if (!lower.includes(focus_phrase.toLowerCase())) {
        console.warn(
          "[generate-pulse-narrative] focus_phrase not contained in narrative",
        );
      }
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
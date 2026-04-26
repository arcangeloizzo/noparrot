-- =========================================================
-- STEP 1 — Tabella config pesi
-- =========================================================
CREATE TABLE IF NOT EXISTS public.cognitive_weights_config (
  action_type text PRIMARY KEY,
  weight numeric(4,2) NOT NULL CHECK (weight >= 0 AND weight <= 5),
  description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  config_version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cognitive_weights_config IS 'Pesi configurabili per il calcolo della Nebulosa Cognitiva. Modificare i valori senza deploy.';

INSERT INTO public.cognitive_weights_config (action_type, weight, description) VALUES
  ('post_original',         1.0,  'Post originale creato da zero (no quoted_post_id)'),
  ('voice_post',            1.0,  'Voice post (post_type=voice)'),
  ('challenge_started',     1.2,  'Autore di una Challenge'),
  ('reshare_with_comment',  0.8,  'Reshare con testo utente >30 parole'),
  ('reshare_simple',        0.5,  'Reshare semplice o con commento <30 parole'),
  ('gate_passed_only',      0.6,  'Comprehension Gate superato (lettura validata)'),
  ('comment_with_gate',     0.7,  'Commento con passed_gate=true'),
  ('challenge_response',    0.7,  'Risposta argomentativa a Challenge'),
  ('challenge_vote',        0.4,  'Voto stance senza risposta argomentativa'),
  ('reaction_unique',       0.15, 'Reazione univoca per (user_id, post_id)'),
  ('bookmark',              0.05, 'Bookmark — intenzione futura')
ON CONFLICT (action_type) DO NOTHING;

ALTER TABLE public.cognitive_weights_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weights_read_authenticated" ON public.cognitive_weights_config;
CREATE POLICY "weights_read_authenticated" ON public.cognitive_weights_config
  FOR SELECT TO authenticated USING (is_active = true);

-- =========================================================
-- STEP 2 — Materialized View user_cognitive_density
-- =========================================================
DROP MATERIALIZED VIEW IF EXISTS public.user_cognitive_density;

CREATE MATERIALIZED VIEW public.user_cognitive_density AS
WITH weights AS (
  SELECT action_type, weight FROM public.cognitive_weights_config WHERE is_active = true
),
post_originals AS (
  SELECT 
    p.author_id AS user_id,
    p.category AS macro_category,
    'post_original'::text AS action_type,
    (SELECT weight FROM weights WHERE action_type = 'post_original') AS contribution
  FROM public.posts p
  WHERE p.quoted_post_id IS NULL
    AND p.is_intent IS NOT TRUE
    AND COALESCE(p.post_type::text, 'standard') = 'standard'
    AND p.category IS NOT NULL
    AND COALESCE(p.is_removed, false) = false
),
voice_posts_int AS (
  SELECT 
    p.author_id AS user_id,
    p.category AS macro_category,
    'voice_post'::text AS action_type,
    (SELECT weight FROM weights WHERE action_type = 'voice_post') AS contribution
  FROM public.posts p
  WHERE p.post_type::text = 'voice'
    AND p.category IS NOT NULL
    AND COALESCE(p.is_removed, false) = false
),
challenges_started AS (
  SELECT 
    p.author_id AS user_id,
    p.category AS macro_category,
    'challenge_started'::text AS action_type,
    (SELECT weight FROM weights WHERE action_type = 'challenge_started') AS contribution
  FROM public.posts p
  WHERE p.post_type::text = 'challenge'
    AND p.category IS NOT NULL
    AND COALESCE(p.is_removed, false) = false
),
reshare_with_comment AS (
  SELECT 
    p.author_id AS user_id,
    qp.category AS macro_category,
    'reshare_with_comment'::text AS action_type,
    (SELECT weight FROM weights WHERE action_type = 'reshare_with_comment') AS contribution
  FROM public.posts p
  JOIN public.posts qp ON qp.id = p.quoted_post_id
  WHERE p.quoted_post_id IS NOT NULL
    AND p.is_intent IS NOT TRUE
    AND qp.category IS NOT NULL
    AND COALESCE(p.is_removed, false) = false
    AND COALESCE(array_length(string_to_array(trim(coalesce(p.content, '')), ' '), 1), 0) > 30
),
reshare_simple AS (
  SELECT 
    p.author_id AS user_id,
    qp.category AS macro_category,
    'reshare_simple'::text AS action_type,
    (SELECT weight FROM weights WHERE action_type = 'reshare_simple') AS contribution
  FROM public.posts p
  LEFT JOIN public.posts qp ON qp.id = p.quoted_post_id
  WHERE (p.quoted_post_id IS NOT NULL OR p.is_intent = true)
    AND qp.category IS NOT NULL
    AND COALESCE(p.is_removed, false) = false
    AND COALESCE(array_length(string_to_array(trim(coalesce(p.content, '')), ' '), 1), 0) <= 30
),
gate_passed_only AS (
  SELECT 
    pga.user_id,
    p.category AS macro_category,
    'gate_passed_only'::text AS action_type,
    (SELECT weight FROM weights WHERE action_type = 'gate_passed_only') AS contribution
  FROM public.post_gate_attempts pga
  JOIN public.posts p ON p.id = pga.post_id
  WHERE pga.passed = true
    AND p.category IS NOT NULL
    AND COALESCE(p.is_removed, false) = false
    AND NOT EXISTS (
      SELECT 1 FROM public.comments c 
      WHERE c.post_id = pga.post_id 
        AND c.author_id = pga.user_id 
        AND c.passed_gate = true
        AND COALESCE(c.is_removed, false) = false
    )
),
comments_gated AS (
  SELECT 
    c.author_id AS user_id,
    c.post_category AS macro_category,
    'comment_with_gate'::text AS action_type,
    (SELECT weight FROM weights WHERE action_type = 'comment_with_gate') AS contribution
  FROM public.comments c
  WHERE c.passed_gate = true
    AND c.post_category IS NOT NULL
    AND COALESCE(c.is_removed, false) = false
),
challenge_responses_int AS (
  SELECT 
    cr.user_id,
    p.category AS macro_category,
    'challenge_response'::text AS action_type,
    (SELECT weight FROM weights WHERE action_type = 'challenge_response') AS contribution
  FROM public.challenge_responses cr
  JOIN public.challenges ch ON ch.id = cr.challenge_id
  JOIN public.posts p ON p.id = ch.post_id
  WHERE cr.gate_passed = true
    AND cr.voice_post_id IS NOT NULL
    AND p.category IS NOT NULL
    AND COALESCE(p.is_removed, false) = false
),
challenge_votes_int AS (
  SELECT 
    cv.user_id,
    p.category AS macro_category,
    'challenge_vote'::text AS action_type,
    (SELECT weight FROM weights WHERE action_type = 'challenge_vote') AS contribution
  FROM public.challenge_votes cv
  JOIN public.challenges ch ON ch.id = cv.challenge_id
  JOIN public.posts p ON p.id = ch.post_id
  WHERE p.category IS NOT NULL
    AND COALESCE(p.is_removed, false) = false
    AND NOT EXISTS (
      SELECT 1 FROM public.challenge_responses cr 
      WHERE cr.challenge_id = cv.challenge_id 
        AND cr.user_id = cv.user_id
    )
),
reactions_unique AS (
  SELECT DISTINCT
    r.user_id,
    p.category AS macro_category,
    'reaction_unique'::text AS action_type,
    (SELECT weight FROM weights WHERE action_type = 'reaction_unique') AS contribution
  FROM public.reactions r
  JOIN public.posts p ON p.id = r.post_id
  WHERE r.reaction_type != 'bookmark'
    AND p.category IS NOT NULL
    AND COALESCE(p.is_removed, false) = false
),
bookmarks AS (
  SELECT DISTINCT
    r.user_id,
    p.category AS macro_category,
    'bookmark'::text AS action_type,
    (SELECT weight FROM weights WHERE action_type = 'bookmark') AS contribution
  FROM public.reactions r
  JOIN public.posts p ON p.id = r.post_id
  WHERE r.reaction_type = 'bookmark'
    AND p.category IS NOT NULL
    AND COALESCE(p.is_removed, false) = false
),
all_interactions AS (
  SELECT * FROM post_originals
  UNION ALL SELECT * FROM voice_posts_int
  UNION ALL SELECT * FROM challenges_started
  UNION ALL SELECT * FROM reshare_with_comment
  UNION ALL SELECT * FROM reshare_simple
  UNION ALL SELECT * FROM gate_passed_only
  UNION ALL SELECT * FROM comments_gated
  UNION ALL SELECT * FROM challenge_responses_int
  UNION ALL SELECT * FROM challenge_votes_int
  UNION ALL SELECT * FROM reactions_unique
  UNION ALL SELECT * FROM bookmarks
)
SELECT 
  user_id,
  macro_category,
  SUM(total_contribution) AS density,
  jsonb_object_agg(action_type, action_count) AS action_breakdown
FROM (
  SELECT 
    user_id, 
    macro_category, 
    action_type, 
    COUNT(*) AS action_count, 
    SUM(contribution) AS total_contribution
  FROM all_interactions
  GROUP BY user_id, macro_category, action_type
) sub
GROUP BY user_id, macro_category;

CREATE UNIQUE INDEX IF NOT EXISTS user_cognitive_density_pk 
  ON public.user_cognitive_density (user_id, macro_category);

CREATE INDEX IF NOT EXISTS user_cognitive_density_user 
  ON public.user_cognitive_density (user_id);

-- =========================================================
-- STEP 3 — RPC get_user_cognitive_density
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_user_cognitive_density(p_user_id uuid)
RETURNS TABLE(
  macro_category text,
  density numeric,
  action_breakdown jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ucd.macro_category,
    ucd.density,
    ucd.action_breakdown
  FROM public.user_cognitive_density ucd
  JOIN public.profiles pr ON pr.id = ucd.user_id
  WHERE ucd.user_id = p_user_id
    AND COALESCE(pr.cognitive_tracking_enabled, true) = true
  ORDER BY ucd.density DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_cognitive_density(uuid) TO authenticated, anon;

COMMENT ON FUNCTION public.get_user_cognitive_density IS 'Ritorna la mappa cognitiva derivata di un utente. Rispetta cognitive_tracking_enabled.';

-- =========================================================
-- STEP 4 — Refresh function
-- =========================================================
CREATE OR REPLACE FUNCTION public.refresh_user_cognitive_density()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_cognitive_density;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_user_cognitive_density() TO service_role;

COMMENT ON FUNCTION public.refresh_user_cognitive_density IS 'Refresh della Nebulosa derivata. CONCURRENTLY: senza lock di lettura.';
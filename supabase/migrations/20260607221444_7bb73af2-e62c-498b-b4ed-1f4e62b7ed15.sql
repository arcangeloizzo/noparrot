DROP FUNCTION IF EXISTS public.get_diary_entries(uuid, integer, timestamptz, text, text, text);

CREATE OR REPLACE FUNCTION public.get_diary_entries(
  p_user_id uuid,
  p_limit integer,
  p_cursor timestamptz DEFAULT NULL,
  p_diary_filter text DEFAULT 'all',
  p_selected_macro text DEFAULT NULL,
  p_selected_topic text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  shared_title text,
  shared_url text,
  quoted_post_id uuid,
  sources jsonb,
  preview_img text,
  created_at timestamptz,
  category text,
  author_id uuid,
  passed_gate boolean,
  topic_id text,
  topic_label text,
  voice_title text,
  voice_body text,
  challenge_title text,
  challenge_body text,
  media_url text,
  media_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH combined_entries AS (
    SELECT 
      p.id, p.content, p.shared_title, p.shared_url, p.quoted_post_id, p.sources, p.preview_img,
      p.created_at AS entry_created_at, p.category, p.author_id, FALSE AS passed_gate,
      vp.title AS voice_title, vp.body_text AS voice_body,
      ch.title AS challenge_title, ch.body_text AS challenge_body,
      m.url AS media_url, m.type AS media_type
    FROM public.posts p
    LEFT JOIN public.voice_posts vp ON vp.post_id = p.id
    LEFT JOIN public.challenges ch ON ch.post_id = p.id
    LEFT JOIN LATERAL (
      SELECT med.url, med.type FROM public.post_media pm
      JOIN public.media med ON med.id = pm.media_id
      WHERE pm.post_id = p.id ORDER BY pm.order_idx ASC LIMIT 1
    ) m ON TRUE
    WHERE p.author_id = p_user_id AND p.is_removed = false

    UNION ALL

    SELECT 
      p.id, p.content, p.shared_title, p.shared_url, p.quoted_post_id, p.sources, p.preview_img,
      pga.attempt_created_at AS entry_created_at, p.category, p.author_id, TRUE AS passed_gate,
      vp.title AS voice_title, vp.body_text AS voice_body,
      ch.title AS challenge_title, ch.body_text AS challenge_body,
      m.url AS media_url, m.type AS media_type
    FROM (
      SELECT DISTINCT ON (pga2.post_id) pga2.post_id, pga2.created_at AS attempt_created_at
      FROM public.post_gate_attempts pga2
      WHERE pga2.user_id = p_user_id AND pga2.passed = true
      ORDER BY pga2.post_id, pga2.created_at DESC
    ) pga
    JOIN public.posts p ON p.id = pga.post_id
    LEFT JOIN public.voice_posts vp ON vp.post_id = p.id
    LEFT JOIN public.challenges ch ON ch.post_id = p.id
    LEFT JOIN LATERAL (
      SELECT med.url, med.type FROM public.post_media pm
      JOIN public.media med ON med.id = pm.media_id
      WHERE pm.post_id = p.id ORDER BY pm.order_idx ASC LIMIT 1
    ) m ON TRUE
    WHERE p.author_id != p_user_id AND p.is_removed = false
  ),
  filtered_entries AS (
    SELECT ce.*, pt.topic_id, pt.topic_label
    FROM combined_entries ce
    LEFT JOIN public.post_topics pt ON pt.post_id = ce.id
    WHERE 
      (p_selected_macro IS NULL OR public.normalize_category(ce.category) = p_selected_macro)
      AND (p_selected_topic IS NULL OR pt.topic_id = p_selected_topic)
      AND (p_cursor IS NULL OR ce.entry_created_at < p_cursor)
      AND (
        p_diary_filter = 'all' OR
        (p_diary_filter = 'original' AND ce.quoted_post_id IS NULL AND ce.passed_gate = FALSE AND ce.shared_url IS NULL AND (ce.sources IS NULL OR jsonb_typeof(ce.sources) != 'array' OR jsonb_array_length(ce.sources) = 0)) OR
        (p_diary_filter = 'reshared' AND ce.quoted_post_id IS NOT NULL) OR
        (p_diary_filter = 'gated' AND (ce.passed_gate = TRUE OR ce.shared_url IS NOT NULL OR (ce.sources IS NOT NULL AND jsonb_typeof(ce.sources) = 'array' AND jsonb_array_length(ce.sources) > 0)))
      )
  )
  SELECT fe.id, fe.content, fe.shared_title, fe.shared_url, fe.quoted_post_id, fe.sources, fe.preview_img,
    fe.entry_created_at AS created_at, fe.category, fe.author_id, fe.passed_gate, fe.topic_id, fe.topic_label,
    fe.voice_title, fe.voice_body, fe.challenge_title, fe.challenge_body, fe.media_url, fe.media_type
  FROM filtered_entries fe
  ORDER BY fe.entry_created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_diary_entries(uuid, integer, timestamptz, text, text, text) TO authenticated, anon;
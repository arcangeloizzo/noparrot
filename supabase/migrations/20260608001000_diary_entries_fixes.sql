-- Redefine get_diary_entries to join voice_posts, challenges, and post_media
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
AS $$
BEGIN
  RETURN QUERY
  WITH combined_entries AS (
    -- User's own posts
    SELECT 
      p.id,
      p.content,
      p.shared_title,
      p.shared_url,
      p.quoted_post_id,
      p.sources,
      p.preview_img,
      p.created_at AS entry_created_at,
      p.category,
      p.author_id,
      FALSE AS passed_gate,
      vp.title AS voice_title,
      vp.body_text AS voice_body,
      ch.title AS challenge_title,
      ch.body_text AS challenge_body,
      m.url AS media_url,
      m.type AS media_type
    FROM public.posts p
    LEFT JOIN public.voice_posts vp ON vp.post_id = p.id
    LEFT JOIN public.challenges ch ON ch.post_id = p.id
    LEFT JOIN LATERAL (
      SELECT med.url, med.type
      FROM public.post_media pm
      JOIN public.media med ON med.id = pm.media_id
      WHERE pm.post_id = p.id
      ORDER BY pm.order_idx ASC
      LIMIT 1
    ) m ON TRUE
    WHERE p.author_id = p_user_id
      AND p.is_removed = false

    UNION ALL

    -- Posts where user passed the gate (excluding own posts to avoid duplicates)
    SELECT 
      p.id,
      p.content,
      p.shared_title,
      p.shared_url,
      p.quoted_post_id,
      p.sources,
      p.preview_img,
      pga.created_at AS entry_created_at, -- Gated entries use the gate attempt timestamp
      p.category,
      p.author_id,
      TRUE AS passed_gate,
      vp.title AS voice_title,
      vp.body_text AS voice_body,
      ch.title AS challenge_title,
      ch.body_text AS challenge_body,
      m.url AS media_url,
      m.type AS media_type
    FROM (
      SELECT DISTINCT ON (post_id) post_id, created_at
      FROM public.post_gate_attempts
      WHERE user_id = p_user_id AND passed = true
      ORDER BY post_id, created_at DESC
    ) pga
    JOIN public.posts p ON p.id = pga.post_id
    LEFT JOIN public.voice_posts vp ON vp.post_id = p.id
    LEFT JOIN public.challenges ch ON ch.post_id = p.id
    LEFT JOIN LATERAL (
      SELECT med.url, med.type
      FROM public.post_media pm
      JOIN public.media med ON med.id = pm.media_id
      WHERE pm.post_id = p.id
      ORDER BY pm.order_idx ASC
      LIMIT 1
    ) m ON TRUE
    WHERE p.author_id != p_user_id
      AND p.is_removed = false
  ),
  filtered_entries AS (
    SELECT 
      ce.*,
      pt.topic_id,
      pt.topic_label
    FROM combined_entries ce
    LEFT JOIN public.post_topics pt ON pt.post_id = ce.id
    WHERE 
      -- Apply Macro filter
      (p_selected_macro IS NULL OR public.normalize_category(ce.category) = p_selected_macro)
      -- Apply Topic filter
      AND (p_selected_topic IS NULL OR pt.topic_id = p_selected_topic)
      -- Apply Cursor
      AND (p_cursor IS NULL OR ce.entry_created_at < p_cursor)
      -- Apply Type filter
      AND (
        p_diary_filter = 'all' OR
        (p_diary_filter = 'original' AND ce.quoted_post_id IS NULL AND ce.passed_gate = FALSE AND ce.shared_url IS NULL AND (ce.sources IS NULL OR jsonb_typeof(ce.sources) != 'array' OR jsonb_array_length(ce.sources) = 0)) OR
        (p_diary_filter = 'reshared' AND ce.quoted_post_id IS NOT NULL) OR
        (p_diary_filter = 'gated' AND (ce.passed_gate = TRUE OR ce.shared_url IS NOT NULL OR (ce.sources IS NOT NULL AND jsonb_typeof(ce.sources) = 'array' AND jsonb_array_length(ce.sources) > 0)))
      )
  )
  SELECT 
    fe.id,
    fe.content,
    fe.shared_title,
    fe.shared_url,
    fe.quoted_post_id,
    fe.sources,
    fe.preview_img,
    fe.entry_created_at AS created_at,
    fe.category,
    fe.author_id,
    fe.passed_gate,
    fe.topic_id,
    fe.topic_label,
    fe.voice_title,
    fe.voice_body,
    fe.challenge_title,
    fe.challenge_body,
    fe.media_url,
    fe.media_type
  FROM filtered_entries fe
  ORDER BY fe.entry_created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_diary_entries(uuid, integer, timestamptz, text, text, text) TO authenticated, anon;

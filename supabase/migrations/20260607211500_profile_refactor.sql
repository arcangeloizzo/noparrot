-- Helper function to normalize category labels
CREATE OR REPLACE FUNCTION public.normalize_category(raw text)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;
  
  raw := trim(raw);
  
  IF raw IN ('Società', 'Politica', 'Economia', 'Tecnologia', 'Scienza', 'Cultura', 'Ambiente', 'Benessere') THEN
    RETURN raw;
  END IF;
  
  RETURN CASE raw
    WHEN 'Salute' THEN 'Benessere'
    WHEN 'Pianeta' THEN 'Ambiente'
    WHEN 'Esteri' THEN 'Politica'
    WHEN 'Sport' THEN 'Cultura'
    WHEN 'Media' THEN 'Società'
    WHEN 'Società & Politica' THEN 'Società'
    WHEN 'Economia & Business' THEN 'Economia'
    WHEN 'Scienza & Tecnologia' THEN 'Tecnologia'
    WHEN 'Cultura & Arte' THEN 'Cultura'
    WHEN 'Pianeta & Ambiente' THEN 'Ambiente'
    WHEN 'Sport & Lifestyle' THEN 'Cultura'
    WHEN 'Salute & Benessere' THEN 'Benessere'
    WHEN 'Media & Comunicazione' THEN 'Società'
    ELSE NULL
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_category(text) TO authenticated, anon;

-- RPC to get unified profile summary statistics
CREATE OR REPLACE FUNCTION public.get_profile_summary(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'comprehension_count', public.get_user_comprehension_count(target_user_id),
    'posts_count', (
      SELECT count(*)::integer FROM public.posts 
      WHERE author_id = target_user_id AND is_removed = false
    ),
    'followers_count', (
      SELECT count(*)::integer FROM public.followers 
      WHERE following_id = target_user_id
    ),
    'following_count', (
      SELECT count(*)::integer FROM public.followers 
      WHERE follower_id = target_user_id
    ),
    'territories_count', (
      SELECT count(DISTINCT category)::integer FROM public.post_gate_attempts pga
      JOIN public.posts p ON p.id = pga.post_id
      WHERE pga.user_id = target_user_id AND pga.passed = true
      AND p.is_removed = false
    )
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_summary(uuid) TO authenticated, anon;

-- RPC to fetch paginated diary entries (user's posts and gated posts from other authors)
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
  topic_label text
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
      FALSE AS passed_gate
    FROM public.posts p
    WHERE p.author_id = p_user_id
      AND p.is_removed = false

    UNION ALL

    -- Posts where user passed the gate (excluding own posts to avoid duplicates)
    SELECT DISTINCT ON (pga.post_id)
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
      TRUE AS passed_gate
    FROM public.post_gate_attempts pga
    JOIN public.posts p ON p.id = pga.post_id
    WHERE pga.user_id = p_user_id
      AND pga.passed = true
      AND p.author_id != p_user_id
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
    fe.topic_label
  FROM filtered_entries fe
  ORDER BY fe.entry_created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_diary_entries(uuid, integer, timestamptz, text, text, text) TO authenticated, anon;


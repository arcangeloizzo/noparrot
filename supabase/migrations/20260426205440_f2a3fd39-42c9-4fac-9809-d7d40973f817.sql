CREATE OR REPLACE FUNCTION public.get_user_topics_by_macro(
  p_user_id uuid,
  p_macro_category text
)
RETURNS TABLE(
  topic_id text,
  topic_label text,
  frequency integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pt.topic_id,
    pt.topic_label,
    COUNT(*)::integer AS frequency
  FROM public.post_topics pt
  JOIN public.posts p ON p.id = pt.post_id
  WHERE p.author_id = p_user_id
    AND pt.macro_category = p_macro_category
    AND COALESCE(p.is_removed, false) = false
  GROUP BY pt.topic_id, pt.topic_label
  ORDER BY frequency DESC, pt.topic_label;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_topics_by_macro(uuid, text) TO authenticated, anon;

COMMENT ON FUNCTION public.get_user_topics_by_macro IS 'Ritorna i topic-tag dell utente per una specifica macro-categoria, ordinati per frequenza decrescente. Usato per popolare i sub-dot della Nebulosa.';
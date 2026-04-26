CREATE OR REPLACE FUNCTION public.count_user_posts_by_topic(
  p_user_id uuid,
  p_topic_id text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.posts p
  JOIN public.post_topics pt ON pt.post_id = p.id
  WHERE p.author_id = p_user_id
    AND pt.topic_id = p_topic_id
    AND COALESCE(p.is_removed, false) = false;
$$;

GRANT EXECUTE ON FUNCTION public.count_user_posts_by_topic(uuid, text) TO authenticated, anon;

COMMENT ON FUNCTION public.count_user_posts_by_topic IS 'Phase 4.6c — Conta i post di un utente per uno specifico topic_id (esclusi i removed). Usato per il counter del chip topic sopra il Diario.';
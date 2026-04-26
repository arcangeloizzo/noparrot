CREATE OR REPLACE FUNCTION public.get_user_comprehension_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT post_id)::integer
  FROM (
    SELECT post_id FROM public.post_gate_attempts 
    WHERE user_id = p_user_id AND passed = true AND post_id IS NOT NULL
    UNION
    SELECT post_id FROM public.comments 
    WHERE author_id = p_user_id 
      AND passed_gate = true 
      AND COALESCE(is_removed, false) = false
  ) sub;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_comprehension_count(uuid) TO authenticated, anon;

COMMENT ON FUNCTION public.get_user_comprehension_count IS 'Conta i post distinti per cui l utente ha dimostrato comprensione (gate passato O commento gated).';
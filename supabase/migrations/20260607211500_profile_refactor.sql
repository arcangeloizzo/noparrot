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

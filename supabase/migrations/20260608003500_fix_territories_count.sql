-- Fix get_profile_summary territories_count metric to query user_cognitive_density directly
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
      SELECT count(*)::integer FROM public.user_cognitive_density ucd
      JOIN public.profiles pr ON pr.id = ucd.user_id
      WHERE ucd.user_id = target_user_id
        AND ucd.density > 0
        AND COALESCE(pr.cognitive_tracking_enabled, true) = true
    )
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_summary(uuid) TO authenticated, anon;

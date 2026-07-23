-- P0: Restore missing GRANTs on public.posts (dropped somewhere during slug work)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT ON public.posts TO anon;
GRANT ALL ON public.posts TO service_role;

-- P1: SECURITY DEFINER resolver for username -> user id (case-insensitive),
-- used by the guest profile page and any client-side username lookup.
CREATE OR REPLACE FUNCTION public.resolve_profile_handle(p_handle text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE lower(username) = lower(p_handle) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_profile_handle(text) TO anon, authenticated;

-- Ensure the existing slug resolver is callable by guests too (safety no-op if already granted).
GRANT EXECUTE ON FUNCTION public.resolve_post_slug(text) TO anon, authenticated;
-- Fix: Protect public_profiles view from unauthenticated access
-- The view intentionally exposes only non-sensitive fields (username, full_name, avatar_url, bio)
-- but should still require authentication to prevent public scraping

-- 1. Revoke access from anonymous role on public_profiles view
REVOKE ALL ON public.public_profiles FROM anon;

-- 2. Grant SELECT only to authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;

-- 3. Ensure profiles table has proper RLS policies for authenticated profile visibility
-- This allows authenticated users to see other users' profiles via the public_profiles view
-- while the base profiles table remains restricted to owner-only for full access

-- Note: public_profiles is a view with security_invoker=false (SECURITY DEFINER)
-- which means it bypasses RLS on the base profiles table by design.
-- The REVOKE/GRANT above provides the access control at the view level.
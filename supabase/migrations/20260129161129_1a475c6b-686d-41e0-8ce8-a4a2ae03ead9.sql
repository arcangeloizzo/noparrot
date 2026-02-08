-- Restrict public_profiles view to authenticated users only
-- This implements the "Solo loggati" preference from the user

-- Drop existing view and recreate with new definition
DROP VIEW IF EXISTS public.public_profiles;

-- Recreate view as SECURITY DEFINER but add function-based auth check
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true)
AS 
SELECT 
  profiles.id,
  profiles.created_at,
  profiles.username,
  profiles.full_name,
  profiles.avatar_url,
  profiles.bio
FROM profiles
WHERE auth.uid() IS NOT NULL;  -- Only visible to authenticated users

-- Set ownership for SECURITY DEFINER behavior
ALTER VIEW public.public_profiles OWNER TO postgres;

-- Ensure security_invoker is false (SECURITY DEFINER mode)
ALTER VIEW public.public_profiles SET (security_invoker = false);

-- Add comment explaining the restriction
COMMENT ON VIEW public.public_profiles IS 'Public profile data restricted to authenticated users. Exposes only non-sensitive fields. Anonymous users cannot see profiles.';
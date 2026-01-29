-- Fix public_profiles view to be SECURITY DEFINER (invoker = false)
-- This allows the view to bypass RLS on profiles table and show public data

DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles 
WITH (security_invoker = false, security_barrier = true) AS
SELECT 
  id,
  username,
  full_name,
  avatar_url,
  bio,
  created_at
FROM public.profiles;

-- Set owner to postgres so the view runs with elevated privileges
ALTER VIEW public.public_profiles OWNER TO postgres;

-- Grant select to all authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;
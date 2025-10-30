-- Fix Security Definer Views by recreating with SECURITY INVOKER
-- This ensures views respect the querying user's RLS policies, not the creator's

DROP VIEW IF EXISTS public.post_qa_public CASCADE;
DROP VIEW IF EXISTS public.public_profiles CASCADE;

-- Recreate post_qa_public with SECURITY INVOKER (respects caller's RLS)
CREATE VIEW public.post_qa_public 
WITH (security_invoker = true)
AS
SELECT 
  id,
  post_id,
  source_url,
  questions,
  generated_at,
  generated_from
FROM public.post_qa;

-- Recreate public_profiles with SECURITY INVOKER (respects caller's RLS)
CREATE VIEW public.public_profiles 
WITH (security_invoker = true)
AS
SELECT 
  id,
  full_name,
  avatar_url,
  bio,
  created_at
FROM public.profiles;

-- Grant access to views
GRANT SELECT ON public.post_qa_public TO anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;
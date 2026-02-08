-- Remove SECURITY DEFINER from views to respect RLS policies
-- These views should not bypass security, they should inherit permissions from underlying tables

DROP VIEW IF EXISTS post_qa_public;
DROP VIEW IF EXISTS public_profiles;

-- Recreate views WITHOUT SECURITY DEFINER
CREATE VIEW post_qa_public AS
SELECT 
  id,
  post_id,
  source_url,
  questions,
  generated_at,
  generated_from
FROM post_qa;

CREATE VIEW public_profiles AS
SELECT 
  id,
  full_name,
  avatar_url,
  bio,
  created_at
FROM profiles;

-- Grant access (views inherit RLS from underlying tables)
GRANT SELECT ON post_qa_public TO anon, authenticated;
GRANT SELECT ON public_profiles TO anon, authenticated;
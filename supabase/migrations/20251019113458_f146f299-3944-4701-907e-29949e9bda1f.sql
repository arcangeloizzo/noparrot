-- Fix 1: Restrict profiles table and create public view
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON profiles;

CREATE POLICY "Authenticated users view profiles" ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- Create safe public view excluding PII (username contains email, date_of_birth)
-- Views don't need RLS - they inherit from the underlying table
CREATE OR REPLACE VIEW public_profiles AS
SELECT 
  id,
  full_name,
  avatar_url,
  bio,
  created_at
FROM profiles;

-- Grant access to public view
GRANT SELECT ON public_profiles TO anon, authenticated;

-- Fix 2: Restrict post_qa table and create public view
DROP POLICY IF EXISTS "Questions viewable by everyone" ON post_qa;
DROP POLICY IF EXISTS "Authenticated users can insert questions" ON post_qa;

-- Only service role can access full table (for validate-answers edge function)
CREATE POLICY "Service role accesses post_qa" ON post_qa
  FOR SELECT TO service_role
  USING (true);

-- Allow service role to insert
CREATE POLICY "Service role inserts post_qa" ON post_qa
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Create view excluding correct_answers
CREATE OR REPLACE VIEW post_qa_public AS
SELECT 
  id,
  post_id,
  source_url,
  questions,
  generated_at,
  generated_from
FROM post_qa;

-- Grant access to public view
GRANT SELECT ON post_qa_public TO anon, authenticated;
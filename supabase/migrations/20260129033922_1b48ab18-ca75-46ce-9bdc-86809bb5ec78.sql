-- =====================================================
-- Security Fix: Restrict profiles table access
-- Issue: profiles table exposes sensitive data (date_of_birth, 
-- cognitive_density, cognitive_tracking_enabled) to all authenticated users
-- =====================================================

-- 1. Update public_profiles view to include username
-- Drop and recreate view with username column
DROP VIEW IF EXISTS public_profiles;

CREATE VIEW public_profiles 
WITH (security_invoker = true) AS
  SELECT 
    id,
    username,
    full_name,
    avatar_url,
    bio,
    created_at
  FROM profiles;

-- Add comment explaining view purpose
COMMENT ON VIEW public_profiles IS 'Safe public profile data excluding sensitive fields like date_of_birth, cognitive_density, and cognitive_tracking_enabled';

-- 2. Restrict profiles table SELECT policy to owner-only
-- Users should only access their own full profile directly
-- For other users data, use public_profiles view

DROP POLICY IF EXISTS "Authenticated users view profiles" ON profiles;

-- Create restrictive policy: users can only SELECT their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT 
  USING (auth.uid() = id);

-- 3. Verify user_consents RLS is properly configured
-- (Already has correct policies per schema, but add explicit comment)
COMMENT ON TABLE user_consents IS 'User privacy consent records - RLS enforces user_id = auth.uid() for all operations';
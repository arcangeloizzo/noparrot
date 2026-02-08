-- ============================================================
-- SECURITY FIX: Restrict profiles table access to owner only
-- This migration drops the overly permissive "Profiles viewable by everyone" policy
-- and replaces it with a more restrictive "Users can view own profile" policy.
-- Third-party profile data is accessed through the public_profiles view.
-- ============================================================

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;

-- Ensure the owner-only SELECT policy exists
-- (This may already exist, but we use CREATE OR REPLACE pattern via DROP IF EXISTS + CREATE)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

-- Note: The existing UPDATE policy "Users can update own profile" remains unchanged
-- Users can only update their own profile (auth.uid() = id)
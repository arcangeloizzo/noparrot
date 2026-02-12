-- Security Fix: Enforce strict RLS on 'profiles' and secure public view
-- Date: 2026-02-12

BEGIN;

-- 1. Restrict 'profiles' policies
-- Drop existing permissive policies (if any)
DROP POLICY IF EXISTS "Authenticated users view profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create restrictive policies (CRUD for Owner Only)
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Note: INSERT is usually handled by triggers (handle_new_user), but for completeness:
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);


-- 2. Secure 'public_profiles' view
-- Drop existing view to rebuild
DROP VIEW IF EXISTS public_profiles;

-- Recreate view with SECURITY INVOKER = false (default behavior for views created by superuser/role)
-- This ensures the view runs with the privileges of the creator (likely postgres/service_role),
-- effectively bypassing the strict RLS on 'profiles' table, but ONLY exposing the selected columns.
CREATE VIEW public_profiles AS
SELECT 
  id,
  username,
  full_name,
  avatar_url,
  bio,
  created_at
FROM profiles;

-- Explicitly grant SELECT to roles
GRANT SELECT ON public_profiles TO anon, authenticated, service_role;

-- Add comment for future maintainers
COMMENT ON VIEW public_profiles IS 'Safe public profile data. Runs with owner privileges to bypass strict RLS on profiles table, exposing only non-sensitive columns.';

COMMIT;

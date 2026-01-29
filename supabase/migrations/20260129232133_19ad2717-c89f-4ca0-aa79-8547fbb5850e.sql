-- =====================================================
-- Security Fix: Restrict anonymous access to reactions and media
-- =====================================================

-- 1. FIX REACTIONS TABLE
-- Remove public SELECT policy
DROP POLICY IF EXISTS "Reactions viewable by everyone" ON public.reactions;

-- Create authenticated-only SELECT policy
CREATE POLICY "Reactions viewable by authenticated"
ON public.reactions
FOR SELECT
TO authenticated
USING (true);

-- 2. FIX MEDIA TABLE
-- Remove public SELECT policy
DROP POLICY IF EXISTS "Media viewable by everyone" ON public.media;

-- Create authenticated-only SELECT policy  
CREATE POLICY "Media viewable by authenticated"
ON public.media
FOR SELECT
TO authenticated
USING (true);

-- 3. PUBLIC_PROFILES VIEW - DOCUMENTED EXCEPTION
-- This view intentionally uses SECURITY DEFINER to bypass profiles RLS
-- and expose only safe public fields. The WHERE auth.uid() IS NOT NULL
-- clause already blocks anonymous access. This is by design.
COMMENT ON VIEW public.public_profiles IS 
  'SECURITY DEFINER by design: bypasses profiles RLS to expose safe public data. Anonymous access blocked via auth.uid() check. See security memory: profiles-privacy-architecture-v5-stable';
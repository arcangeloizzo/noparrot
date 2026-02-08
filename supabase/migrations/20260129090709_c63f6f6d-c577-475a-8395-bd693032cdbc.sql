-- =====================================================
-- FIX 1: FOLLOWERS (CORRETTO)
-- Prevent anonymous scraping, but allow social features
-- =====================================================

-- Drop old insecure/wrong policies
DROP POLICY IF EXISTS "Followers viewable by everyone" ON public.followers;
DROP POLICY IF EXISTS "Users can view own follower relationships" ON public.followers;

-- Correct Policy:
-- Authenticated users can see the whole graph (needed for profiles/counts)
-- Anonymous users (scrapers) see NOTHING.
CREATE POLICY "Authenticated users can view followers" 
ON public.followers 
FOR SELECT 
TO authenticated 
USING (true);

-- =====================================================
-- FIX 2: TRENDING TOPICS
-- Enforce Read-Only for users, Write for Server
-- =====================================================

-- 1. Ensure users can ONLY read
DROP POLICY IF EXISTS "Trending topics viewable by everyone" ON public.trending_topics_cache;
DROP POLICY IF EXISTS "Trending topics cache readable by everyone" ON public.trending_topics_cache;

CREATE POLICY "Authenticated users can view trends" 
ON public.trending_topics_cache
FOR SELECT 
TO authenticated 
USING (true);

-- 2. Explicitly allow Service Role full access
CREATE POLICY "Service role can manage trends" 
ON public.trending_topics_cache 
FOR ALL
TO service_role 
USING (true) 
WITH CHECK (true);
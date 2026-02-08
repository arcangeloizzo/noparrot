-- Fix: Restrict comment_reactions SELECT to authenticated users only
-- This prevents anonymous scraping of user activity data

-- 1. Ensure RLS is enabled
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

-- 2. Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Comment reactions viewable by everyone" ON public.comment_reactions;

-- 3. Create restrictive policy: Only authenticated users can view reactions
CREATE POLICY "Comment reactions viewable by authenticated" 
ON public.comment_reactions 
FOR SELECT 
TO authenticated 
USING (true);
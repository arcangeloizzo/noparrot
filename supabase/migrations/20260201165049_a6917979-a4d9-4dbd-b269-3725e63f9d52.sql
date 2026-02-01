-- Fix: Restrict comments visibility to authenticated users only
-- This prevents anonymous users from harvesting user comments and opinions

-- 1. Drop the overly permissive policy
DROP POLICY IF EXISTS "Comments viewable by everyone" ON public.comments;

-- 2. Create new policy: Only authenticated users can view comments
CREATE POLICY "Authenticated users can view comments" 
ON public.comments 
FOR SELECT 
TO authenticated 
USING (true);

-- 3. Drop existing separate policies and consolidate
DROP POLICY IF EXISTS "Users can insert own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;

-- 4. Create consolidated policy for comment authors to manage their own comments
CREATE POLICY "Users can manage own comments" 
ON public.comments 
FOR ALL 
TO authenticated 
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);
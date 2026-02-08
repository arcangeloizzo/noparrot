-- Fix: Restrict posts visibility to authenticated users only
-- This prevents anonymous users from tracking user activity and building behavioral profiles

-- 1. Ensure RLS is enabled
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 2. Drop the overly permissive policy
DROP POLICY IF EXISTS "Posts viewable by everyone" ON public.posts;

-- 3. New SELECT policy: Only authenticated users can view posts
CREATE POLICY "Authenticated users can view posts" 
ON public.posts 
FOR SELECT 
TO authenticated 
USING (true);

-- 4. Clean up old write policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;

-- 5. Consolidated policy: Authors can manage their own posts (INSERT/UPDATE/DELETE)
CREATE POLICY "Authors can manage own posts" 
ON public.posts 
FOR ALL 
TO authenticated 
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);
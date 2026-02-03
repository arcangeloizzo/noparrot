-- 1. Ensure RLS is enabled
ALTER TABLE public.focus_reactions ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Focus reactions viewable by everyone" ON public.focus_reactions;

-- 3. Create new policy: Only authenticated users can view reactions (prevents anonymous scraping)
CREATE POLICY "Authenticated users can view reactions for social features" 
ON public.focus_reactions 
FOR SELECT 
TO authenticated 
USING (true);

-- Note: The existing "Users can manage own focus reactions" policy handles INSERT/UPDATE/DELETE
-- Fix comment_cognitive_metrics RLS policies to prevent public exposure
-- The issue is the "Service role can manage comment metrics" policy with USING(true)
-- is too permissive for SELECT operations. 

-- Drop all existing policies on comment_cognitive_metrics
DROP POLICY IF EXISTS "Service role can manage comment metrics" ON public.comment_cognitive_metrics;
DROP POLICY IF EXISTS "Users can insert own comment metrics" ON public.comment_cognitive_metrics;
DROP POLICY IF EXISTS "Users can view own comment metrics" ON public.comment_cognitive_metrics;

-- Create properly scoped user policies
-- Users can only SELECT their own metrics
CREATE POLICY "Users can view own comment metrics"
ON public.comment_cognitive_metrics
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can INSERT their own metrics
CREATE POLICY "Users can insert own comment metrics"
ON public.comment_cognitive_metrics
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own metrics
CREATE POLICY "Users can update own comment metrics"
ON public.comment_cognitive_metrics
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Service role operations happen with service_role key which bypasses RLS automatically
-- No need for an explicit "Service role can manage" policy - service_role bypasses RLS by default
-- This is how Edge Functions using SUPABASE_SERVICE_ROLE_KEY will continue to work
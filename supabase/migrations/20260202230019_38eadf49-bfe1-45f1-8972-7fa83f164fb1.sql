-- Fix ai_usage_logs RLS: restrict to service_role only
-- This table contains sensitive AI infrastructure data (costs, latency, models)

-- 1. Ensure RLS is enabled
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- 2. Drop any permissive policies that might exist
DROP POLICY IF EXISTS "Public access" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Anyone can read logs" ON public.ai_usage_logs;

-- 3. Create service_role only policy
-- No policy for anon/authenticated means they get NO access
-- Service role bypasses RLS by default, but explicit policy documents intent
CREATE POLICY "Service role manages ai logs" 
ON public.ai_usage_logs 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);
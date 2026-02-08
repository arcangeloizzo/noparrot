-- Fix push_subscriptions RLS policy to restrict SELECT to service_role only
-- This prevents authenticated users from reading all push notification credentials

DROP POLICY IF EXISTS "Service role can read all subscriptions" ON public.push_subscriptions;

CREATE POLICY "Service role can read all subscriptions" 
ON public.push_subscriptions 
FOR SELECT 
TO service_role
USING (true);
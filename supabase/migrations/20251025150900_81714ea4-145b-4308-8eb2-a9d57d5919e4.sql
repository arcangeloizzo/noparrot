-- Fix RLS policy per message_threads: permetti INSERT a utenti autenticati
DROP POLICY IF EXISTS "Users can create message threads" ON public.message_threads;

CREATE POLICY "Users can create message threads"
ON public.message_threads
FOR INSERT
TO authenticated
WITH CHECK (true);
-- Permetti agli utenti autenticati di creare thread
CREATE POLICY "Users can create message threads"
ON public.message_threads
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permetti agli utenti di vedere i thread che hanno creato (anche prima di aggiungere partecipanti)
DROP POLICY IF EXISTS "Users can view threads they participate in" ON public.message_threads;

CREATE POLICY "Users can view threads they participate in"
ON public.message_threads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM thread_participants
    WHERE thread_participants.thread_id = message_threads.id
    AND thread_participants.user_id = auth.uid()
  )
);
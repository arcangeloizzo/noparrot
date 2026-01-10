-- Ensure message reactions are protected and usable by thread participants

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Users can view reactions on messages in threads they participate in
DROP POLICY IF EXISTS "Thread participants can view message reactions" ON public.message_reactions;
CREATE POLICY "Thread participants can view message reactions"
ON public.message_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.thread_participants tp ON tp.thread_id = m.thread_id
    WHERE m.id = message_reactions.message_id
      AND tp.user_id = auth.uid()
  )
);

-- Users can add a reaction only on messages in threads they participate in
DROP POLICY IF EXISTS "Thread participants can add message reactions" ON public.message_reactions;
CREATE POLICY "Thread participants can add message reactions"
ON public.message_reactions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.thread_participants tp ON tp.thread_id = m.thread_id
    WHERE m.id = message_reactions.message_id
      AND tp.user_id = auth.uid()
  )
);

-- Users can remove only their own reactions (and only within threads they participate in)
DROP POLICY IF EXISTS "Users can remove own message reactions" ON public.message_reactions;
CREATE POLICY "Users can remove own message reactions"
ON public.message_reactions
FOR DELETE
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.thread_participants tp ON tp.thread_id = m.thread_id
    WHERE m.id = message_reactions.message_id
      AND tp.user_id = auth.uid()
  )
);

-- Helpful index for toggles/queries
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_user_type
ON public.message_reactions (message_id, user_id, reaction_type);
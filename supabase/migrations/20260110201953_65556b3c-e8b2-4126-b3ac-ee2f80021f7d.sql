-- Create helper function to verify if a user can react to a message
CREATE OR REPLACE FUNCTION public.user_can_react_to_message(_message_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.thread_participants tp ON tp.thread_id = m.thread_id
    WHERE m.id = _message_id
      AND tp.user_id = _user_id
  );
$$;

-- Add index for faster thread participant lookups
CREATE INDEX IF NOT EXISTS idx_thread_participants_lookup 
ON public.thread_participants (thread_id, user_id);

-- Drop old policy and create new one using the helper function
DROP POLICY IF EXISTS "Thread participants can add message reactions" ON public.message_reactions;

CREATE POLICY "Thread participants can add message reactions"
ON public.message_reactions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND public.user_can_react_to_message(message_id, auth.uid())
);
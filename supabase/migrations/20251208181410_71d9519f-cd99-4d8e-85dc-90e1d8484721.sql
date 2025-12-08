-- Tabella per le reazioni ai messaggi (like)
CREATE TABLE public.message_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reaction_type text DEFAULT 'like' NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, reaction_type)
);

-- RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions in their threads"
  ON public.message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.thread_participants tp ON tp.thread_id = m.thread_id
      WHERE m.id = message_reactions.message_id
      AND tp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add reactions"
  ON public.message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
  ON public.message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Colonna message_id nella tabella notifications per i like ai messaggi
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE;

-- Trigger per notifica su message like
CREATE OR REPLACE FUNCTION public.notify_message_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  message_sender_id uuid;
BEGIN
  SELECT sender_id INTO message_sender_id
  FROM public.messages
  WHERE id = NEW.message_id;
  
  IF message_sender_id IS NOT NULL AND message_sender_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, message_id)
    VALUES (message_sender_id, NEW.user_id, 'message_like', NEW.message_id);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_reaction_insert
AFTER INSERT ON public.message_reactions
FOR EACH ROW EXECUTE FUNCTION notify_message_reaction();

-- Abilita realtime per message_reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
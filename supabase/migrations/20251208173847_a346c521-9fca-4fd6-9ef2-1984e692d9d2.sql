-- Funzione per notificare like ai commenti
CREATE OR REPLACE FUNCTION public.notify_comment_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reaction_type = 'heart' THEN
    INSERT INTO public.notifications (user_id, type, actor_id, post_id, comment_id)
    SELECT 
      c.author_id,
      'like',
      NEW.user_id,
      c.post_id,
      c.id
    FROM public.comments c
    WHERE c.id = NEW.comment_id
      AND c.author_id != NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger per like ai commenti
CREATE TRIGGER on_comment_reaction_created
  AFTER INSERT ON public.comment_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comment_reaction();
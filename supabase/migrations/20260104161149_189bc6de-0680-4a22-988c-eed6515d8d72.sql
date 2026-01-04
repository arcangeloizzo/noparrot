-- Funzione per notificare il reshare
CREATE OR REPLACE FUNCTION public.notify_new_reshare()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Solo se c'è un quoted_post_id (è una reshare)
  IF NEW.quoted_post_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, actor_id, post_id)
    SELECT 
      p.author_id,
      'reshare',
      NEW.author_id,
      NEW.id  -- Il nuovo post (la reshare)
    FROM public.posts p
    WHERE p.id = NEW.quoted_post_id
      AND p.author_id != NEW.author_id;  -- Non notificare se reshare del proprio post
  END IF;
  RETURN NEW;
END;
$function$;

-- Trigger sulla tabella posts per le reshare
CREATE TRIGGER on_post_reshare
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_reshare();
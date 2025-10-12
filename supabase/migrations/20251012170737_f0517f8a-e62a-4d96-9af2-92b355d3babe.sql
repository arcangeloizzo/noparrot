-- Aggiorna il trigger per rilevare menzioni nei commenti e creare notifiche
CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  mentioned_username text;
  mentioned_user_id uuid;
BEGIN
  -- Notifica l'autore del post
  INSERT INTO public.notifications (user_id, type, actor_id, post_id, comment_id)
  SELECT 
    p.author_id,
    'comment',
    NEW.author_id,
    NEW.post_id,
    NEW.id
  FROM public.posts p
  WHERE p.id = NEW.post_id
    AND p.author_id != NEW.author_id;
  
  -- Cerca e notifica tutti gli utenti menzionati con @username
  FOR mentioned_username IN 
    SELECT regexp_matches(NEW.content, '@(\w+)', 'g')::text
  LOOP
    -- Rimuovi @ e parentesi dalla stringa
    mentioned_username := trim(both '{}' from mentioned_username);
    mentioned_username := replace(mentioned_username, '@', '');
    
    -- Trova l'ID dell'utente menzionato
    SELECT id INTO mentioned_user_id
    FROM public.profiles
    WHERE username = mentioned_username
    LIMIT 1;
    
    -- Crea notifica solo se l'utente esiste e non è l'autore
    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.author_id THEN
      INSERT INTO public.notifications (user_id, type, actor_id, post_id, comment_id)
      VALUES (mentioned_user_id, 'mention', NEW.author_id, NEW.post_id, NEW.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$function$;
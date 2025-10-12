-- FASE 1A: Consolidare trigger e funzioni per commenti

-- DROP vecchio trigger e funzione
DROP TRIGGER IF EXISTS on_comment_created ON public.comments;
DROP FUNCTION IF EXISTS notify_new_comment();

-- Aggiorna create_mention_notifications() per includere notifica autore post
CREATE OR REPLACE FUNCTION create_mention_notifications()
RETURNS trigger AS $$
DECLARE
  mentioned_username TEXT;
  mentioned_user_id UUID;
  notification_post_id UUID;
BEGIN
  -- Determina il post_id corretto
  IF TG_TABLE_NAME = 'comments' THEN
    notification_post_id := NEW.post_id;
    
    -- AGGIUNGERE: Notifica l'autore del post (solo per commenti)
    INSERT INTO public.notifications (user_id, type, actor_id, post_id, comment_id)
    SELECT 
      p.author_id,
      'comment',
      NEW.author_id,
      NEW.post_id,
      NEW.id
    FROM public.posts p
    WHERE p.id = NEW.post_id
      AND p.author_id != NEW.author_id
    ON CONFLICT DO NOTHING;
  ELSE
    notification_post_id := NEW.id;
  END IF;

  -- Itera su tutte le menzioni trovate
  FOR mentioned_username IN 
    SELECT username FROM extract_mentions(NEW.content)
  LOOP
    SELECT id INTO mentioned_user_id
    FROM public.profiles
    WHERE username = mentioned_username
    LIMIT 1;
    
    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.author_id THEN
      INSERT INTO public.notifications (user_id, type, actor_id, post_id, comment_id)
      VALUES (
        mentioned_user_id,
        'mention',
        NEW.author_id,
        notification_post_id,
        CASE WHEN TG_TABLE_NAME = 'comments' THEN NEW.id ELSE NULL END
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
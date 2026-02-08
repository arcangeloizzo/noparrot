-- Funzione per estrarre menzioni @username dal testo
CREATE OR REPLACE FUNCTION extract_mentions(content TEXT)
RETURNS TABLE(username TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    regexp_replace(mention, '@', '', 'g') AS username
  FROM regexp_matches(content, '@(\w+)', 'g') AS mention;
END;
$$ LANGUAGE plpgsql;

-- Funzione per creare notifiche di menzione
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
  ELSE
    notification_post_id := NEW.id;
  END IF;

  -- Itera su tutte le menzioni trovate
  FOR mentioned_username IN 
    SELECT username FROM extract_mentions(NEW.content)
  LOOP
    -- Trova l'ID dell'utente menzionato
    SELECT id INTO mentioned_user_id
    FROM public.profiles
    WHERE username = mentioned_username
    LIMIT 1;
    
    -- Crea notifica solo se:
    -- 1. L'utente esiste
    -- 2. Non è l'autore stesso
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

-- Trigger per le menzioni nei post
DROP TRIGGER IF EXISTS create_mention_notifications_on_post ON public.posts;
CREATE TRIGGER create_mention_notifications_on_post
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION create_mention_notifications();

-- Trigger per le menzioni nei commenti
DROP TRIGGER IF EXISTS create_mention_notifications_on_comment ON public.comments;
CREATE TRIGGER create_mention_notifications_on_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION create_mention_notifications();
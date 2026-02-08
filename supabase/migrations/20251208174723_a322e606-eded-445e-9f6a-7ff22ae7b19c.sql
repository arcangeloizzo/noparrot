-- Aggiorna la funzione extract_mentions per catturare username con punti e trattini
CREATE OR REPLACE FUNCTION public.extract_mentions(content text)
RETURNS TABLE(username text)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    regexp_replace(mention[1], '@', '', 'g') AS username
  FROM regexp_matches(content, '@([\w.-]+)', 'g') AS mention;
END;
$$;

-- Aggiorna la funzione per creare notifiche di menzione con matching migliorato
CREATE OR REPLACE FUNCTION public.create_mention_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  mentioned_username TEXT;
  mentioned_user_id UUID;
  notification_post_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'comments' THEN
    notification_post_id := NEW.post_id;
    
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

  FOR mentioned_username IN 
    SELECT username FROM extract_mentions(NEW.content)
  LOOP
    -- Cerca username con matching flessibile (supporta email come username)
    SELECT id INTO mentioned_user_id
    FROM public.profiles
    WHERE username = mentioned_username 
       OR username = mentioned_username || '@gmail.com'
       OR username LIKE mentioned_username || '@%'
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
$$;
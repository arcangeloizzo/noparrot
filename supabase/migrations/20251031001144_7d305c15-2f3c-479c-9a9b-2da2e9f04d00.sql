-- Fix SECURITY DEFINER functions by adding fixed search_path
-- This prevents search path manipulation attacks

-- Fix create_or_get_thread function
CREATE OR REPLACE FUNCTION public.create_or_get_thread(participant_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_thread_id uuid;
BEGIN
  -- Find thread with EXACTLY these participants
  SELECT tp.thread_id INTO v_thread_id
  FROM thread_participants tp
  WHERE tp.user_id = ANY(participant_ids)
  GROUP BY tp.thread_id
  HAVING COUNT(DISTINCT tp.user_id) = array_length(participant_ids, 1)
    AND COUNT(DISTINCT tp.user_id) = (
      SELECT COUNT(*) 
      FROM thread_participants 
      WHERE thread_id = tp.thread_id
    )
  LIMIT 1;

  IF v_thread_id IS NULL THEN
    INSERT INTO message_threads DEFAULT VALUES
    RETURNING id INTO v_thread_id;

    INSERT INTO thread_participants (thread_id, user_id)
    SELECT v_thread_id, unnest(participant_ids);
  END IF;

  RETURN v_thread_id;
END;
$function$;

-- Fix user_is_thread_participant function
CREATE OR REPLACE FUNCTION public.user_is_thread_participant(check_thread_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM thread_participants 
    WHERE thread_id = check_thread_id 
    AND user_id = check_user_id
  );
$function$;

-- Fix update_thread_timestamp function
CREATE OR REPLACE FUNCTION public.update_thread_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE message_threads
  SET updated_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$function$;

-- Fix notify_new_follower function
CREATE OR REPLACE FUNCTION public.notify_new_follower()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'follow', NEW.follower_id);
  RETURN NEW;
END;
$function$;

-- Fix notify_new_reaction function
CREATE OR REPLACE FUNCTION public.notify_new_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.reaction_type = 'heart' THEN
    INSERT INTO public.notifications (user_id, type, actor_id, post_id)
    SELECT 
      p.author_id,
      'like',
      NEW.user_id,
      NEW.post_id
    FROM public.posts p
    WHERE p.id = NEW.post_id
      AND p.author_id != NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix create_mention_notifications function
CREATE OR REPLACE FUNCTION public.create_mention_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;
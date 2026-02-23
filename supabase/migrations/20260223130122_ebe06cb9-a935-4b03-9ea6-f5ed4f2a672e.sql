
-- Fix Push Notification Triggers - 401 Unauthorized
-- Re-adds the Authorization header to pg_net calls

-- 1. trigger_push_notification (likes, comments, mentions, follows, reshares)
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'type', 'notification',
    'notification_id', NEW.id,
    'user_id', NEW.user_id,
    'actor_id', NEW.actor_id,
    'notification_type', NEW.type,
    'post_id', NEW.post_id,
    'comment_id', NEW.comment_id
  );
  
  PERFORM net.http_post(
    url := 'https://nwmpstvoutkjshhhtmrk.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send push notification: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 2. trigger_push_message (DMs)
CREATE OR REPLACE FUNCTION public.trigger_push_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'type', 'message',
    'message_id', NEW.id,
    'thread_id', NEW.thread_id,
    'sender_id', NEW.sender_id,
    'content', LEFT(NEW.content, 100)
  );
  
  PERFORM net.http_post(
    url := 'https://nwmpstvoutkjshhhtmrk.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send push message notification: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 3. notify_admins_new_user (admin notifications + push)
CREATE OR REPLACE FUNCTION public.notify_admins_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_record RECORD;
  payload jsonb;
BEGIN
  FOR admin_record IN 
    SELECT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, actor_id, type, created_at)
    VALUES (
      admin_record.user_id,
      NEW.id,
      'new_user',
      NOW()
    );
  END LOOP;
  
  payload := jsonb_build_object(
    'type', 'admin',
    'notification_type', 'new_user',
    'actor_id', NEW.id
  );
  
  PERFORM net.http_post(
    url := 'https://nwmpstvoutkjshhhtmrk.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send admin notification: %', SQLERRM;
  RETURN NEW;
END;
$function$;

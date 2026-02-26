
-- =============================================
-- Fix Push Notifications: Shared Secret approach
-- Replaces vault-dependent triggers with hardcoded internal secret
-- =============================================

-- 1. Drop existing triggers (if any)
DROP TRIGGER IF EXISTS trigger_push_on_notification ON public.notifications;
DROP TRIGGER IF EXISTS trigger_push_on_message ON public.messages;
DROP TRIGGER IF EXISTS trigger_admin_on_new_profile ON public.profiles;
DROP TRIGGER IF EXISTS on_new_notification_push ON public.notifications;
DROP TRIGGER IF EXISTS on_new_message_push ON public.messages;

-- 2. Rewrite trigger_push_notification with hardcoded secret
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
      'x-internal-secret', 'd7e3f1a9-4b2c-4d8e-9f6a-3c5b7e1d9a2f'
    ),
    body := payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send push notification: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 3. Rewrite trigger_push_message with hardcoded secret
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
      'x-internal-secret', 'd7e3f1a9-4b2c-4d8e-9f6a-3c5b7e1d9a2f'
    ),
    body := payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send push message notification: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 4. Rewrite notify_admins_new_user with hardcoded secret
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
  -- Insert notification rows for each admin
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

  -- Send push to admins
  payload := jsonb_build_object(
    'type', 'admin',
    'notification_type', 'new_user',
    'actor_id', NEW.id
  );

  PERFORM net.http_post(
    url := 'https://nwmpstvoutkjshhhtmrk.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', 'd7e3f1a9-4b2c-4d8e-9f6a-3c5b7e1d9a2f'
    ),
    body := payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send admin notification: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 5. Create triggers
CREATE TRIGGER trigger_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION trigger_push_notification();

CREATE TRIGGER trigger_push_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION trigger_push_message();

CREATE TRIGGER trigger_admin_on_new_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION notify_admins_new_user();

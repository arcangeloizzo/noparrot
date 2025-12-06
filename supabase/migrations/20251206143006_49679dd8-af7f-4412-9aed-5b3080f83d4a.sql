-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Update trigger function to call edge function without requiring service role key
-- The edge function already accepts unauthenticated requests (has CORS headers)
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
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := payload
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send push notification: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Update message trigger function similarly
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
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := payload
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send push message notification: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Make sure triggers exist on the tables
DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;
CREATE TRIGGER on_notification_created
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();

DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_message();
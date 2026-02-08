-- Create trigger for push notifications on new notifications
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Create trigger for push messages on new messages  
CREATE OR REPLACE FUNCTION public.trigger_push_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_new_notification_push ON public.notifications;
DROP TRIGGER IF EXISTS on_new_message_push ON public.messages;

-- Create triggers
CREATE TRIGGER on_new_notification_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();

CREATE TRIGGER on_new_message_push
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_message();
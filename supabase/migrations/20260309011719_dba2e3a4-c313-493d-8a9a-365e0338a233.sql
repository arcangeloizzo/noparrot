-- Rewrite trigger functions to use dynamic secret from database config
-- This removes the hardcoded secret from the codebase

CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  payload jsonb;
  internal_secret text;
BEGIN
  -- Read secret from database runtime config (never stored in migration files)
  internal_secret := current_setting('app.push_internal_secret', true);
  
  IF internal_secret IS NULL OR internal_secret = '' THEN
    RAISE WARNING 'Push notification secret not configured, skipping notification';
    RETURN NEW;
  END IF;

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
      'x-internal-secret', internal_secret
    ),
    body := payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send push notification: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_push_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  payload jsonb;
  internal_secret text;
BEGIN
  -- Read secret from database runtime config (never stored in migration files)
  internal_secret := current_setting('app.push_internal_secret', true);
  
  IF internal_secret IS NULL OR internal_secret = '' THEN
    RAISE WARNING 'Push notification secret not configured, skipping message notification';
    RETURN NEW;
  END IF;

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
      'x-internal-secret', internal_secret
    ),
    body := payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send push message notification: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admins_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_record RECORD;
  payload jsonb;
  internal_secret text;
BEGIN
  -- Read secret from database runtime config (never stored in migration files)
  internal_secret := current_setting('app.push_internal_secret', true);

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

  -- Only send push if secret is configured
  IF internal_secret IS NOT NULL AND internal_secret != '' THEN
    payload := jsonb_build_object(
      'type', 'admin',
      'notification_type', 'new_user',
      'actor_id', NEW.id
    );

    PERFORM net.http_post(
      url := 'https://nwmpstvoutkjshhhtmrk.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', internal_secret
      ),
      body := payload
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send admin notification: %', SQLERRM;
  RETURN NEW;
END;
$$;
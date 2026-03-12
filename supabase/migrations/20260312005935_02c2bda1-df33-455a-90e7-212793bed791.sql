-- Create app_config table for storing internal secrets accessible by triggers
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS: only service_role can access
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages app_config"
  ON public.app_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update trigger_push_notification to read from app_config
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
  -- Read secret from app_config table
  SELECT value INTO internal_secret
  FROM public.app_config
  WHERE key = 'push_internal_secret';
  
  IF internal_secret IS NULL OR internal_secret = '' THEN
    RAISE WARNING 'Push notification secret not configured in app_config, skipping notification';
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

-- Update trigger_push_message to read from app_config
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
  SELECT value INTO internal_secret
  FROM public.app_config
  WHERE key = 'push_internal_secret';
  
  IF internal_secret IS NULL OR internal_secret = '' THEN
    RAISE WARNING 'Push notification secret not configured in app_config, skipping message notification';
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

-- Update notify_admins_new_user to read from app_config
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
  SELECT value INTO internal_secret
  FROM public.app_config
  WHERE key = 'push_internal_secret';

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
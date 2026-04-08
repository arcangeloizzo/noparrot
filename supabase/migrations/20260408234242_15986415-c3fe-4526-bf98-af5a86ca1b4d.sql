-- Create a wrapper function that reads internal secret from app_config and triggers profile-ingest
CREATE OR REPLACE FUNCTION public.execute_profile_ingest_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _internal_secret text;
BEGIN
  SELECT value INTO _internal_secret
  FROM public.app_config
  WHERE key = 'push_internal_secret';

  IF _internal_secret IS NULL OR _internal_secret = '' THEN
    RAISE WARNING 'profile-ingest cron: internal secret not found in app_config, skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://nwmpstvoutkjshhhtmrk.supabase.co/functions/v1/profile-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', _internal_secret
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Create a wrapper function that reads internal secret from app_config and triggers profile-compose-post
CREATE OR REPLACE FUNCTION public.execute_profile_compose_post_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _internal_secret text;
BEGIN
  SELECT value INTO _internal_secret
  FROM public.app_config
  WHERE key = 'push_internal_secret';

  IF _internal_secret IS NULL OR _internal_secret = '' THEN
    RAISE WARNING 'profile-compose-post cron: internal secret not found in app_config, skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://nwmpstvoutkjshhhtmrk.supabase.co/functions/v1/profile-compose-post',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', _internal_secret
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Ensure pg_cron is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the profile-ingest job to run daily at 05:00 UTC (06:00 CET / 07:00 CEST)
SELECT cron.schedule(
  'profile-ingest-daily',
  '0 5 * * *',
  $$SELECT public.execute_profile_ingest_cron()$$
);

-- Schedule the profile-compose-post job to run every minute
SELECT cron.schedule(
  'profile-compose-post-minute',
  '* * * * *',
  $$SELECT public.execute_profile_compose_post_cron()$$
);
-- Create a wrapper function that fetches the service key from vault and triggers the profile-ingest edge function
CREATE OR REPLACE FUNCTION public.execute_profile_ingest_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  service_key text;
  project_url text;
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  IF service_key IS NULL THEN
    RAISE WARNING 'SUPABASE_SERVICE_ROLE_KEY not found in vault. Cannot run profile-ingest cron.';
    RETURN;
  END IF;

  project_url := 'https://nwmpstvoutkjshhhtmrk.supabase.co';

  PERFORM net.http_post(
    url := project_url || '/functions/v1/profile-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    )
  );
END;
$$;

-- Create a wrapper function that fetches the service key from vault and triggers the profile-compose-post edge function
CREATE OR REPLACE FUNCTION public.execute_profile_compose_post_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  service_key text;
  project_url text;
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  IF service_key IS NULL THEN
    RAISE WARNING 'SUPABASE_SERVICE_ROLE_KEY not found in vault. Cannot run profile-compose-post cron.';
    RETURN;
  END IF;

  project_url := 'https://nwmpstvoutkjshhhtmrk.supabase.co';

  PERFORM net.http_post(
    url := project_url || '/functions/v1/profile-compose-post',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    )
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

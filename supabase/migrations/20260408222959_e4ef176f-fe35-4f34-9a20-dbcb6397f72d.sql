
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.execute_process_ai_mentions_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _service_role_key text;
  _supabase_url text;
BEGIN
  _service_role_key := current_setting('app.settings.service_role_key', true);
  IF _service_role_key IS NULL OR _service_role_key = '' THEN
    SELECT decrypted_secret INTO _service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    LIMIT 1;
  END IF;

  IF _service_role_key IS NULL OR _service_role_key = '' THEN
    RAISE WARNING 'process-ai-mentions cron: SERVICE_ROLE_KEY not found, skipping';
    RETURN;
  END IF;

  _supabase_url := coalesce(
    current_setting('app.settings.supabase_url', true),
    'https://nwmpstvoutkjshhhtmrk.supabase.co'
  );

  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/process-ai-mentions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_role_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule(
  'process-ai-mentions-reactive',
  '* * * * *',
  $$SELECT public.execute_process_ai_mentions_cron()$$
);

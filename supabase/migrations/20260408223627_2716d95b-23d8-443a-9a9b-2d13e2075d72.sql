
CREATE OR REPLACE FUNCTION public.execute_process_ai_mentions_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _internal_secret text;
  _supabase_url text;
BEGIN
  SELECT value INTO _internal_secret
  FROM public.app_config
  WHERE key = 'push_internal_secret';

  IF _internal_secret IS NULL OR _internal_secret = '' THEN
    RAISE WARNING 'process-ai-mentions cron: internal secret not found in app_config, skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://nwmpstvoutkjshhhtmrk.supabase.co/functions/v1/process-ai-mentions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', _internal_secret
    ),
    body := '{}'::jsonb
  );
END;
$$;

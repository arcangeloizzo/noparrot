DO $$ 
BEGIN
  -- Rimuove tentativi ai gate vecchi di 30 giorni
  PERFORM cron.schedule(
    'cleanup_post_gate_attempts',
    '0 3 * * *', -- Tutti i giorni alle 03:00
    $$DELETE FROM post_gate_attempts WHERE created_at < now() - interval '30 days'$$
  );
  
  -- Rimuove log di utilizzo AI vecchi di 90 giorni
  PERFORM cron.schedule(
    'cleanup_ai_usage_logs',
    '0 4 * * *',
    $$DELETE FROM ai_usage_logs WHERE created_at < now() - interval '90 days'$$
  );
EXCEPTION
  WHEN undefined_schema THEN
    RAISE NOTICE 'pg_cron not available';
END $$;

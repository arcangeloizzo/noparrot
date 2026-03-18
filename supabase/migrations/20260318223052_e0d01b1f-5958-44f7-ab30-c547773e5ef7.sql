
-- Abilita pg_cron se non già attivo
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Cleanup post_gate_attempts più vecchi di 30 giorni
SELECT cron.schedule(
  'cleanup-gate-attempts',
  '0 3 * * *',
  $$DELETE FROM post_gate_attempts WHERE created_at < now() - interval '30 days'$$
);

-- Cleanup ai_usage_logs più vecchi di 90 giorni
SELECT cron.schedule(
  'cleanup-ai-logs',
  '0 4 * * *',
  $$DELETE FROM ai_usage_logs WHERE created_at < now() - interval '90 days'$$
);

-- Fallback se pg_cron non è disponibile
DO $$
BEGIN
  RAISE NOTICE 'pg_cron jobs scheduled successfully';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available — skip scheduling';
END $$;

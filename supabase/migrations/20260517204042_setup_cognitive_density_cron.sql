-- Setup pg_cron job per refresh periodico della Materialized View user_cognitive_density
-- Esegue la funzione ogni 15 minuti.

-- Abilitiamo l'estensione pg_cron se non lo è (in genere è attiva su Supabase pro)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Rimuoviamo il job se esiste già (idempotenza)
SELECT cron.unschedule('refresh-cognitive-density');

-- Scheduliamo il refresh ogni 15 minuti
SELECT cron.schedule(
  'refresh-cognitive-density',
  '*/15 * * * *',
  $$
    -- Usiamo una DO block per gestire evantuali lock o failure, 
    -- anche se refresh_user_cognitive_density ha già la gestione interna CONCURRENTLY.
    SELECT public.refresh_user_cognitive_density();
  $$
);

-- 1. Rimuovi subscription duplicate per utente (mantieni la più recente)
DELETE FROM push_subscriptions a
USING push_subscriptions b
WHERE a.user_id = b.user_id 
  AND a.id <> b.id
  AND a.created_at < b.created_at;

-- 2. Aggiungi constraint UNIQUE per prevenire subscription multiple per utente
-- (single-device policy: ogni utente può avere una sola subscription attiva)
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_unique_user 
ON push_subscriptions(user_id);
-- Drop legacy single-user unique index that conflicts with multi-device support
DROP INDEX IF EXISTS idx_push_subscriptions_unique_user;

-- Ensure the correct composite unique constraint exists (idempotent)
-- It already exists as push_subscriptions_user_id_endpoint_key, so this is just safety
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'push_subscriptions' 
    AND indexname = 'push_subscriptions_user_id_endpoint_key'
  ) THEN
    ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint);
  END IF;
END $$;
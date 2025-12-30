-- Idempotency keys for publish flow
CREATE TABLE IF NOT EXISTS public.publish_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL,
  post_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS publish_idempotency_user_key_uidx
  ON public.publish_idempotency (user_id, key);

CREATE INDEX IF NOT EXISTS publish_idempotency_created_at_idx
  ON public.publish_idempotency (created_at DESC);

ALTER TABLE public.publish_idempotency ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='publish_idempotency' AND policyname='Users can view own publish idempotency'
  ) THEN
    CREATE POLICY "Users can view own publish idempotency"
    ON public.publish_idempotency
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='publish_idempotency' AND policyname='Users can insert own publish idempotency'
  ) THEN
    CREATE POLICY "Users can insert own publish idempotency"
    ON public.publish_idempotency
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='publish_idempotency' AND policyname='Users can update own publish idempotency'
  ) THEN
    CREATE POLICY "Users can update own publish idempotency"
    ON public.publish_idempotency
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
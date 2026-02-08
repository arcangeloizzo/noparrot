-- A1: DOB obbligatoria (rimuovo NULL)
ALTER TABLE profiles ALTER COLUMN date_of_birth SET NOT NULL;

-- A4: Rate limit export
CREATE TABLE IF NOT EXISTS export_requests (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_export_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own export requests"
  ON export_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own export requests"
  ON export_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own export requests"
  ON export_requests FOR UPDATE
  USING (auth.uid() = user_id);

-- A5: Soft-delete messaggi per utente
CREATE TABLE IF NOT EXISTS message_deletions (
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE message_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own message deletions"
  ON message_deletions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own message deletions"
  ON message_deletions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- A7: TTL su youtube_transcripts_cache
ALTER TABLE youtube_transcripts_cache 
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '30 days');
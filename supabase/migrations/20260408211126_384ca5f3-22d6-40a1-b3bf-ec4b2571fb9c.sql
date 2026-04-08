
-- TASK 1: Extend profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_ai_institutional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_profile_handle text;

CREATE INDEX IF NOT EXISTS idx_profiles_ai_institutional 
  ON profiles(is_ai_institutional) 
  WHERE is_ai_institutional = true;

-- TASK 2: Create 5 new tables

-- Table 1: ai_profiles
CREATE TABLE ai_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text UNIQUE NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL,
  area text NOT NULL,
  bio text NOT NULL,
  avatar_url text,
  accent_color text NOT NULL,
  system_prompt text NOT NULL,
  system_prompt_version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  rate_limit_daily integer NOT NULL DEFAULT 200,
  rate_limit_per_thread integer NOT NULL DEFAULT 2,
  rate_limit_per_user_daily integer NOT NULL DEFAULT 10,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_profiles_handle ON ai_profiles(handle);
CREATE INDEX idx_ai_profiles_active ON ai_profiles(is_active) WHERE is_active = true;

ALTER TABLE ai_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_profiles readable by all authenticated"
  ON ai_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ai_profiles writable only by service_role"
  ON ai_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Table 2: ai_mention_queue
CREATE TABLE ai_mention_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES ai_profiles(id) ON DELETE CASCADE,
  mentioning_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_comment_id uuid NOT NULL,
  source_post_id uuid NOT NULL,
  context_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  result_comment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(source_comment_id, profile_id)
);

CREATE INDEX idx_ai_queue_status_created ON ai_mention_queue(status, created_at) 
  WHERE status IN ('pending','processing');
CREATE INDEX idx_ai_queue_profile ON ai_mention_queue(profile_id, created_at DESC);
CREATE INDEX idx_ai_queue_user ON ai_mention_queue(mentioning_user_id, created_at DESC);

ALTER TABLE ai_mention_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_queue service_role only"
  ON ai_mention_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Table 3: ai_generation_log
CREATE TABLE ai_generation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid REFERENCES ai_mention_queue(id) ON DELETE SET NULL,
  profile_id uuid NOT NULL REFERENCES ai_profiles(id) ON DELETE CASCADE,
  generation_type text NOT NULL,
  model_used text NOT NULL DEFAULT 'gemini-2.5-flash',
  system_prompt_version integer NOT NULL,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer GENERATED ALWAYS AS (COALESCE(prompt_tokens,0) + COALESCE(completion_tokens,0)) STORED,
  total_cost_usd numeric(10,6),
  response_text text NOT NULL,
  moderation_passed boolean NOT NULL DEFAULT true,
  moderation_notes text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_log_profile_date ON ai_generation_log(profile_id, created_at DESC);
CREATE INDEX idx_ai_log_type_date ON ai_generation_log(generation_type, created_at DESC);
CREATE INDEX idx_ai_log_cost_date ON ai_generation_log(created_at DESC) WHERE total_cost_usd IS NOT NULL;

ALTER TABLE ai_generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_log service_role only"
  ON ai_generation_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Table 4: profile_source_feed
CREATE TABLE profile_source_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES ai_profiles(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  source_url text NOT NULL,
  article_title text NOT NULL,
  article_url text NOT NULL,
  article_summary text,
  article_published_at timestamptz,
  raw_content text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  is_relevant boolean,
  relevance_score numeric(3,2),
  used_in_post_id uuid,
  UNIQUE(profile_id, article_url)
);

CREATE INDEX idx_psf_profile_fetched ON profile_source_feed(profile_id, fetched_at DESC);
CREATE INDEX idx_psf_profile_relevant ON profile_source_feed(profile_id, is_relevant, fetched_at DESC) 
  WHERE is_relevant = true AND used_in_post_id IS NULL;

ALTER TABLE profile_source_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psf service_role only"
  ON profile_source_feed FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Table 5: ai_posting_schedule
CREATE TABLE ai_posting_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES ai_profiles(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour integer NOT NULL CHECK (hour BETWEEN 0 AND 23),
  minute integer NOT NULL DEFAULT 0 CHECK (minute BETWEEN 0 AND 59),
  jitter_minutes integer NOT NULL DEFAULT 15,
  is_active boolean NOT NULL DEFAULT true,
  last_executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_aps_profile ON ai_posting_schedule(profile_id);
CREATE INDEX idx_aps_active ON ai_posting_schedule(is_active, day_of_week, hour) WHERE is_active = true;

ALTER TABLE ai_posting_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aps readable by authenticated"
  ON ai_posting_schedule FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "aps writable only by service_role"
  ON ai_posting_schedule FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- TASK 3: Trigger for AI mention detection on comments
-- NOTE: comments table uses author_id (not user_id)
CREATE OR REPLACE FUNCTION enqueue_ai_mentions()
RETURNS TRIGGER AS $$
DECLARE
  profile_record record;
BEGIN
  FOR profile_record IN
    SELECT id, handle FROM ai_profiles
    WHERE is_active = true
      AND NEW.content ~* ('@' || handle || '\b')
  LOOP
    INSERT INTO ai_mention_queue (
      profile_id,
      mentioning_user_id,
      source_comment_id,
      source_post_id,
      context_payload
    ) VALUES (
      profile_record.id,
      NEW.author_id,
      NEW.id,
      NEW.post_id,
      jsonb_build_object(
        'mentioned_handle', profile_record.handle,
        'comment_content', NEW.content,
        'inserted_at', now()
      )
    )
    ON CONFLICT (source_comment_id, profile_id) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

DROP TRIGGER IF EXISTS trg_enqueue_ai_mentions ON comments;
CREATE TRIGGER trg_enqueue_ai_mentions
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_ai_mentions();

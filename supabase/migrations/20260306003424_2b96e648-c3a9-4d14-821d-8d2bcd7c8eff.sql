
-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE post_type_enum AS ENUM ('standard', 'voice', 'challenge');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE challenge_status_enum AS ENUM ('active', 'expired', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE stance_enum AS ENUM ('for', 'against');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transcript_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add post_type column to posts table
DO $$ BEGIN
  ALTER TABLE posts ADD COLUMN post_type post_type_enum DEFAULT 'standard';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- 2. TABLES
CREATE TABLE IF NOT EXISTS voice_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  audio_url text NOT NULL,
  duration_seconds integer NOT NULL,
  transcript text,
  transcript_status transcript_status_enum DEFAULT 'pending',
  waveform_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  voice_post_id uuid REFERENCES voice_posts(id) ON DELETE CASCADE,
  thesis text NOT NULL CHECK (char_length(thesis) <= 140),
  duration_hours integer NOT NULL CHECK (duration_hours IN (24, 48, 168)),
  status challenge_status_enum DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  votes_for integer DEFAULT 0,
  votes_against integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_post_id uuid REFERENCES voice_posts(id) ON DELETE CASCADE,
  stance stance_enum NOT NULL,
  argument_votes integer DEFAULT 0,
  gate_passed boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_response_id uuid REFERENCES challenge_responses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(challenge_response_id, user_id)
);

-- 3. RLS POLICIES
ALTER TABLE voice_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for voice_posts" ON voice_posts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owner can insert voice_posts" ON voice_posts
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT author_id FROM posts WHERE id = post_id)
  );

CREATE POLICY "Service role can update voice_posts" ON voice_posts
  FOR UPDATE USING (true);

CREATE POLICY "Public read for challenges" ON challenges
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owner can insert challenges" ON challenges
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT author_id FROM posts WHERE id = post_id)
  );

CREATE POLICY "Service role can update challenges" ON challenges
  FOR UPDATE USING (true);

CREATE POLICY "Public read for challenge_responses" ON challenge_responses
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert challenge_responses if passed gate" ON challenge_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id AND gate_passed = true);

CREATE POLICY "Public read for challenge_votes" ON challenge_votes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can vote" ON challenge_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-audio', 'voice-audio', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public access to voice-audio" ON storage.objects
  FOR SELECT USING (bucket_id = 'voice-audio');

CREATE POLICY "Users can upload voice-audio" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'voice-audio' AND 
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own voice-audio" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'voice-audio' AND 
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. TRIGGERS
CREATE OR REPLACE FUNCTION increment_argument_votes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE challenge_responses
  SET argument_votes = argument_votes + 1
  WHERE id = NEW.challenge_response_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_challenge_vote_insert
  AFTER INSERT ON challenge_votes
  FOR EACH ROW
  EXECUTE FUNCTION increment_argument_votes();

CREATE OR REPLACE FUNCTION increment_stance_votes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stance = 'for' THEN
    UPDATE challenges SET votes_for = votes_for + 1 WHERE id = NEW.challenge_id;
  ELSIF NEW.stance = 'against' THEN
    UPDATE challenges SET votes_against = votes_against + 1 WHERE id = NEW.challenge_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_challenge_response_insert
  AFTER INSERT ON challenge_responses
  FOR EACH ROW
  EXECUTE FUNCTION increment_stance_votes();

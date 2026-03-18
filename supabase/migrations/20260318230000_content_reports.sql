-- Content Reports table for DSA notice-and-action framework
CREATE TABLE IF NOT EXISTS content_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'inappropriate',
  details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Prevent duplicate reports from same user on same post
  UNIQUE(post_id, reporter_id)
);

-- Enable RLS
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports
CREATE POLICY "Users can create reports"
  ON content_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Users can view their own reports
CREATE POLICY "Users can view own reports"
  ON content_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

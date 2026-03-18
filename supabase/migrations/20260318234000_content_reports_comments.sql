-- Add comment_id support to content_reports for comment-level reporting
-- Make post_id nullable since reports can be for posts OR comments
ALTER TABLE content_reports 
  ADD COLUMN IF NOT EXISTS comment_id uuid REFERENCES comments(id) ON DELETE CASCADE;

-- Update unique constraint to handle both post and comment reports
ALTER TABLE content_reports DROP CONSTRAINT IF EXISTS content_reports_post_id_reporter_id_key;
ALTER TABLE content_reports ALTER COLUMN post_id DROP NOT NULL;

-- Add conditional unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_post_reporter_unique 
  ON content_reports (post_id, reporter_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_comment_reporter_unique 
  ON content_reports (comment_id, reporter_id) WHERE comment_id IS NOT NULL;

-- Add check: at least one of post_id or comment_id must be set
ALTER TABLE content_reports 
  ADD CONSTRAINT content_reports_target_check 
  CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL);

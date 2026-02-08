-- Add editorial comment columns for IL PUNTO system
ALTER TABLE focus_comments 
ADD COLUMN IF NOT EXISTS is_editorial BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Create index for efficient querying of pinned/editorial comments
CREATE INDEX IF NOT EXISTS idx_focus_comments_pinned ON focus_comments(focus_id, is_pinned DESC, created_at ASC);

-- Add comment to document the columns
COMMENT ON COLUMN focus_comments.is_editorial IS 'True if this comment is from the IL PUNTO editorial system';
COMMENT ON COLUMN focus_comments.is_pinned IS 'True if this comment should be pinned at the top of the comments list';
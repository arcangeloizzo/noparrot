-- Add content_hash column to post_qa table for cache invalidation
ALTER TABLE post_qa ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_post_qa_content_hash ON post_qa(source_url, content_hash);

-- Add updated_at column to track when questions were regenerated
ALTER TABLE post_qa ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
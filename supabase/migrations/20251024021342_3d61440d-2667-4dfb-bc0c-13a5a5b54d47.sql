-- Add transcript columns to post_qa table
ALTER TABLE post_qa 
ADD COLUMN IF NOT EXISTS transcript TEXT,
ADD COLUMN IF NOT EXISTS transcript_source TEXT CHECK (transcript_source IN ('youtube_captions', 'whisper', 'manual', 'none'));
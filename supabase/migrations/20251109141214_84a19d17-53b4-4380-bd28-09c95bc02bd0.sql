-- Add embed_html column for TikTok embeds
ALTER TABLE posts ADD COLUMN embed_html TEXT;

-- Add transcript columns for YouTube transcriptions
ALTER TABLE posts ADD COLUMN transcript TEXT;
ALTER TABLE posts ADD COLUMN transcript_source TEXT;

-- Add indexes for better performance
CREATE INDEX idx_posts_embed_html ON posts(id) WHERE embed_html IS NOT NULL;
CREATE INDEX idx_posts_transcript ON posts(id) WHERE transcript IS NOT NULL;
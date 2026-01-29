-- Cache Table Update: add image and hostname columns
ALTER TABLE content_cache
ADD COLUMN IF NOT EXISTS meta_image_url TEXT,
ADD COLUMN IF NOT EXISTS meta_hostname TEXT;

-- Posts Table Update: add denormalization columns
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS hostname TEXT,
ADD COLUMN IF NOT EXISTS preview_fetched_at TIMESTAMPTZ;
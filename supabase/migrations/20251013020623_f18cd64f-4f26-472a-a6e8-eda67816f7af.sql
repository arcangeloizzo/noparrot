-- Add quoted_post_id column to posts table for quote sharing
ALTER TABLE posts ADD COLUMN quoted_post_id uuid REFERENCES posts(id) ON DELETE SET NULL;

-- Create index for better performance when fetching quoted posts
CREATE INDEX idx_posts_quoted_post_id ON posts(quoted_post_id);

-- Add comment for documentation
COMMENT ON COLUMN posts.quoted_post_id IS 'Reference to the original post being quoted/shared';
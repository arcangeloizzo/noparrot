-- First, remove duplicates: keep only the most recent non-bookmark reaction per user+post
DELETE FROM reactions r1
WHERE r1.reaction_type != 'bookmark'
AND EXISTS (
  SELECT 1 FROM reactions r2 
  WHERE r2.post_id = r1.post_id 
  AND r2.user_id = r1.user_id 
  AND r2.reaction_type != 'bookmark'
  AND r2.created_at > r1.created_at
);

-- Create unique partial index to prevent duplicate non-bookmark reactions
-- (One user can only have one non-bookmark reaction per post)
CREATE UNIQUE INDEX IF NOT EXISTS reactions_user_post_non_bookmark_unique 
ON reactions (user_id, post_id) 
WHERE reaction_type != 'bookmark';

-- Also ensure only one bookmark per user+post
CREATE UNIQUE INDEX IF NOT EXISTS reactions_user_post_bookmark_unique 
ON reactions (user_id, post_id) 
WHERE reaction_type = 'bookmark';
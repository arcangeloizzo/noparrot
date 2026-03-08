
-- Fix voice_posts: restrict UPDATE to post owner only (service_role bypasses RLS automatically)
DROP POLICY IF EXISTS "Service role can update voice_posts" ON voice_posts;
CREATE POLICY "Owner can update voice_posts" ON voice_posts
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT author_id FROM posts WHERE id = post_id))
  WITH CHECK (auth.uid() IN (SELECT author_id FROM posts WHERE id = post_id));

-- Fix challenges: remove permissive UPDATE policy (service_role bypasses RLS, no authenticated user needs UPDATE)
DROP POLICY IF EXISTS "Service role can update challenges" ON challenges;

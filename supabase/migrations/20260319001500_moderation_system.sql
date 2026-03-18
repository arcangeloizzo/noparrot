-- 1. ADD SOFT DELETE FIELDS TO POSTS
ALTER TABLE posts 
  ADD COLUMN IF NOT EXISTS is_removed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS removed_reason text,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES profiles(id);

-- 2. ADD SOFT DELETE FIELDS TO COMMENTS
ALTER TABLE comments 
  ADD COLUMN IF NOT EXISTS is_removed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS removed_reason text,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES profiles(id);

-- 3. RLS UPDATES FOR POSTS AND COMMENTS
-- Modify existing policies to hide removed content from normal users
-- (Assumes existing SELECT policies. Adjust if your DB has different policy names)
-- Note: It's safer to add a global default scope or let the frontend filter it in usePosts 
-- if RLS is too complex to modify here without dropping existing policies.
-- We will add an index to speed up filtering:
CREATE INDEX IF NOT EXISTS posts_is_removed_idx ON posts (is_removed);
CREATE INDEX IF NOT EXISTS comments_is_removed_idx ON comments (is_removed);

-- 4. UPDATE CONTENT_REPORTS POLICIES FOR ADMINS
-- Ensure admins can read and update all reports
CREATE POLICY "Admins can view all reports"
  ON content_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

CREATE POLICY "Admins can update reports"
  ON content_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- 5. TRIGGER: NOTIFY ADMINS ON NEW REPORT
CREATE OR REPLACE FUNCTION notify_admins_on_report()
RETURNS TRIGGER AS $$
DECLARE
  admin_rec RECORD;
BEGIN
  -- Find all admins and moderators
  FOR admin_rec IN SELECT user_id FROM user_roles WHERE role IN ('admin', 'moderator') LOOP
    INSERT INTO notifications (
      user_id,
      actor_id,
      type,
      post_id,
      comment_id
    ) VALUES (
      admin_rec.user_id,
      NEW.reporter_id,
      'report_received',
      NEW.post_id,
      NEW.comment_id
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_new_content_report
  AFTER INSERT ON content_reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_report();

-- 6. RPC: ADMIN REMOVE CONTENT
-- Performs soft delete, updates report status, and notifies author
CREATE OR REPLACE FUNCTION admin_remove_content(
  p_target_type text, -- 'post' or 'comment'
  p_target_id uuid,
  p_reason text,
  p_admin_id uuid
) RETURNS void AS $$
DECLARE
  v_author_id uuid;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_admin_id AND role IN ('admin', 'moderator')) THEN
    RAISE EXCEPTION 'Unauthorized: Requires admin or moderator role';
  END IF;

  IF p_target_type = 'post' THEN
    -- Get author
    SELECT author_id INTO v_author_id FROM posts WHERE id = p_target_id;
    IF v_author_id IS NULL THEN RAISE EXCEPTION 'Post not found'; END IF;

    -- Soft delete post
    UPDATE posts 
    SET is_removed = true, removed_reason = p_reason, removed_at = now(), removed_by = p_admin_id
    WHERE id = p_target_id;

    -- Update related reports
    UPDATE content_reports SET status = 'actioned' WHERE post_id = p_target_id;

    -- Notify author
    INSERT INTO notifications (user_id, actor_id, type, post_id)
    VALUES (v_author_id, p_admin_id, 'content_removed', p_target_id);

  ELSIF p_target_type = 'comment' THEN
    -- Get author
    SELECT author_id INTO v_author_id FROM comments WHERE id = p_target_id;
    IF v_author_id IS NULL THEN RAISE EXCEPTION 'Comment not found'; END IF;

    -- Soft delete comment
    UPDATE comments 
    SET is_removed = true, removed_reason = p_reason, removed_at = now(), removed_by = p_admin_id
    WHERE id = p_target_id;

    -- Update related reports
    UPDATE content_reports SET status = 'actioned' WHERE comment_id = p_target_id;

    -- Notify author
    INSERT INTO notifications (user_id, actor_id, type, comment_id)
    VALUES (v_author_id, p_admin_id, 'content_removed_comment', p_target_id);
  
  ELSE
    RAISE EXCEPTION 'Invalid target pattern';
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration 1: Add comment_id support to content_reports
ALTER TABLE content_reports 
  ADD COLUMN IF NOT EXISTS comment_id uuid REFERENCES comments(id) ON DELETE CASCADE;

ALTER TABLE content_reports DROP CONSTRAINT IF EXISTS content_reports_post_id_reporter_id_key;
ALTER TABLE content_reports ALTER COLUMN post_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS content_reports_post_reporter_unique 
  ON content_reports (post_id, reporter_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_comment_reporter_unique 
  ON content_reports (comment_id, reporter_id) WHERE comment_id IS NOT NULL;

ALTER TABLE content_reports 
  ADD CONSTRAINT content_reports_target_check 
  CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL);

-- Migration 2: Moderation system

-- Soft delete fields on posts
ALTER TABLE posts 
  ADD COLUMN IF NOT EXISTS is_removed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS removed_reason text,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES profiles(id);

-- Soft delete fields on comments
ALTER TABLE comments 
  ADD COLUMN IF NOT EXISTS is_removed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS removed_reason text,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES profiles(id);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS posts_is_removed_idx ON posts (is_removed);
CREATE INDEX IF NOT EXISTS comments_is_removed_idx ON comments (is_removed);

-- Admin policies on content_reports
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all reports' AND tablename = 'content_reports') THEN
    CREATE POLICY "Admins can view all reports"
      ON content_reports FOR SELECT
      TO authenticated
      USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND role IN ('admin', 'moderator'))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update reports' AND tablename = 'content_reports') THEN
    CREATE POLICY "Admins can update reports"
      ON content_reports FOR UPDATE
      TO authenticated
      USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND role IN ('admin', 'moderator'))
      );
  END IF;
END $$;

-- Trigger: notify admins on new report
CREATE OR REPLACE FUNCTION notify_admins_on_report()
RETURNS TRIGGER AS $$
DECLARE
  admin_rec RECORD;
BEGIN
  FOR admin_rec IN SELECT user_id FROM user_roles WHERE role IN ('admin', 'moderator') LOOP
    INSERT INTO notifications (
      user_id, actor_id, type, post_id, comment_id
    ) VALUES (
      admin_rec.user_id, NEW.reporter_id, 'report_received', NEW.post_id, NEW.comment_id
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_content_report ON content_reports;
CREATE TRIGGER on_new_content_report
  AFTER INSERT ON content_reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_report();

-- RPC: admin_remove_content
CREATE OR REPLACE FUNCTION admin_remove_content(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_admin_id uuid
) RETURNS void AS $$
DECLARE
  v_author_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_admin_id AND role IN ('admin', 'moderator')) THEN
    RAISE EXCEPTION 'Unauthorized: Requires admin or moderator role';
  END IF;

  IF p_target_type = 'post' THEN
    SELECT author_id INTO v_author_id FROM posts WHERE id = p_target_id;
    IF v_author_id IS NULL THEN RAISE EXCEPTION 'Post not found'; END IF;
    UPDATE posts SET is_removed = true, removed_reason = p_reason, removed_at = now(), removed_by = p_admin_id WHERE id = p_target_id;
    UPDATE content_reports SET status = 'actioned' WHERE post_id = p_target_id;
    INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (v_author_id, p_admin_id, 'content_removed', p_target_id);
  ELSIF p_target_type = 'comment' THEN
    SELECT author_id INTO v_author_id FROM comments WHERE id = p_target_id;
    IF v_author_id IS NULL THEN RAISE EXCEPTION 'Comment not found'; END IF;
    UPDATE comments SET is_removed = true, removed_reason = p_reason, removed_at = now(), removed_by = p_admin_id WHERE id = p_target_id;
    UPDATE content_reports SET status = 'actioned' WHERE comment_id = p_target_id;
    INSERT INTO notifications (user_id, actor_id, type, comment_id) VALUES (v_author_id, p_admin_id, 'content_removed_comment', p_target_id);
  ELSE
    RAISE EXCEPTION 'Invalid target type';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
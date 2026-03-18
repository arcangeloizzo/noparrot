-- Fix search_path on newly created functions
CREATE OR REPLACE FUNCTION notify_admins_on_report()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION admin_remove_content(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_admin_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;
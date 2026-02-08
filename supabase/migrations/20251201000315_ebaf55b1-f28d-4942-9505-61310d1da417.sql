-- Fix search_path for set_focus_comment_level function
CREATE OR REPLACE FUNCTION set_focus_comment_level()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.level := 0;
  ELSE
    SELECT COALESCE(level, 0) + 1 INTO NEW.level
    FROM focus_comments
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$;
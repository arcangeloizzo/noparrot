-- Create focus_comments table
CREATE TABLE focus_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  focus_id UUID NOT NULL,
  focus_type TEXT NOT NULL CHECK (focus_type IN ('daily', 'interest')),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES focus_comments(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE focus_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Focus comments viewable by everyone" ON focus_comments
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own focus comments" ON focus_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete own focus comments" ON focus_comments
  FOR DELETE USING (auth.uid() = author_id);

-- Trigger to set comment level based on parent
CREATE OR REPLACE FUNCTION set_focus_comment_level()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_focus_comment_level
  BEFORE INSERT ON focus_comments
  FOR EACH ROW
  EXECUTE FUNCTION set_focus_comment_level();
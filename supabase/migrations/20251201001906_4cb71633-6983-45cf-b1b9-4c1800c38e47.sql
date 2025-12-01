-- Add deep_content column to daily_focus and interest_focus tables
ALTER TABLE daily_focus ADD COLUMN deep_content TEXT;
ALTER TABLE interest_focus ADD COLUMN deep_content TEXT;

-- Add is_verified column to focus_comments table
ALTER TABLE focus_comments ADD COLUMN is_verified BOOLEAN DEFAULT false;
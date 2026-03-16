ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_dismissed_tutorial BOOLEAN DEFAULT false;

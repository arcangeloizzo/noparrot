-- Add columns for intelligent anti-duplication system
ALTER TABLE daily_focus ADD COLUMN IF NOT EXISTS raw_title TEXT;
ALTER TABLE daily_focus ADD COLUMN IF NOT EXISTS topic_cluster TEXT;
ALTER TABLE daily_focus ADD COLUMN IF NOT EXISTS angle_tag TEXT;
ALTER TABLE daily_focus ADD COLUMN IF NOT EXISTS event_fingerprint TEXT;
ALTER TABLE daily_focus ADD COLUMN IF NOT EXISTS skip_reason TEXT;

-- Create index for faster fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_daily_focus_event_fingerprint ON daily_focus(event_fingerprint);
CREATE INDEX IF NOT EXISTS idx_daily_focus_topic_cluster ON daily_focus(topic_cluster);
CREATE INDEX IF NOT EXISTS idx_daily_focus_created_at ON daily_focus(created_at DESC);
-- Add granular notification preferences columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS notifications_likes_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications_comments_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications_mentions_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications_follows_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications_messages_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications_reshares_enabled BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.notifications_likes_enabled IS 'Enable/disable push notifications for likes';
COMMENT ON COLUMN public.profiles.notifications_comments_enabled IS 'Enable/disable push notifications for comments';
COMMENT ON COLUMN public.profiles.notifications_mentions_enabled IS 'Enable/disable push notifications for mentions';
COMMENT ON COLUMN public.profiles.notifications_follows_enabled IS 'Enable/disable push notifications for new followers';
COMMENT ON COLUMN public.profiles.notifications_messages_enabled IS 'Enable/disable push notifications for messages';
COMMENT ON COLUMN public.profiles.notifications_reshares_enabled IS 'Enable/disable push notifications for reshares';
-- Add cognitive_tracking_enabled to profiles for GDPR opt-out
ALTER TABLE profiles 
ADD COLUMN cognitive_tracking_enabled boolean DEFAULT true;

COMMENT ON COLUMN profiles.cognitive_tracking_enabled IS 
'Se false, non tracciare cognitive_density e mostrare feed non personalizzato';

-- Add RLS policy for messages deletion (users can delete their own messages)
CREATE POLICY "Users can delete their own messages"
ON messages
FOR DELETE
USING (auth.uid() = sender_id);

-- Add RLS policy for thread_participants deletion (users can leave conversations)
CREATE POLICY "Users can leave conversations"
ON thread_participants
FOR DELETE
USING (auth.uid() = user_id);
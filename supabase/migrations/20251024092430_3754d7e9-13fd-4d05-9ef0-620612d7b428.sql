-- Tabella threads (conversazioni)
CREATE TABLE message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabella partecipanti dei thread
CREATE TABLE thread_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES message_threads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_read_at TIMESTAMPTZ,
  UNIQUE(thread_id, user_id)
);

-- Tabella messaggi
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES message_threads(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  link_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabella media dei messaggi
CREATE TABLE message_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  media_id UUID REFERENCES media(id) ON DELETE CASCADE NOT NULL,
  order_idx INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies per message_threads
CREATE POLICY "Users can view threads they participate in"
ON message_threads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM thread_participants
    WHERE thread_participants.thread_id = message_threads.id
    AND thread_participants.user_id = auth.uid()
  )
);

-- RLS Policies per thread_participants
CREATE POLICY "Users can view participants of their threads"
ON thread_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM thread_participants tp
    WHERE tp.thread_id = thread_participants.thread_id
    AND tp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert themselves as participants"
ON thread_participants FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participant record"
ON thread_participants FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies per messages
CREATE POLICY "Users can view messages in their threads"
ON messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM thread_participants
    WHERE thread_participants.thread_id = messages.thread_id
    AND thread_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages in their threads"
ON messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM thread_participants
    WHERE thread_participants.thread_id = messages.thread_id
    AND thread_participants.user_id = auth.uid()
  )
);

-- RLS Policies per message_media
CREATE POLICY "Users can view media in their thread messages"
ON message_media FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN thread_participants tp ON tp.thread_id = m.thread_id
    WHERE m.id = message_media.message_id
    AND tp.user_id = auth.uid()
  )
);

CREATE POLICY "Message senders can insert media"
ON message_media FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = message_media.message_id
    AND messages.sender_id = auth.uid()
  )
);

-- Trigger per aggiornare updated_at su message_threads
CREATE OR REPLACE FUNCTION update_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE message_threads
  SET updated_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_thread_on_new_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_thread_timestamp();
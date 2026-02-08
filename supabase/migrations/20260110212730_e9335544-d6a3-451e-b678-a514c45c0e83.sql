-- Drop vecchio constraint
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Ricrea con tutti i 6 tipi usati nel codebase
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('like', 'comment', 'follow', 'mention', 'message_like', 'reshare'));
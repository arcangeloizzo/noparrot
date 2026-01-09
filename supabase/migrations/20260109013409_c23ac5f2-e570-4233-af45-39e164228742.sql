-- Add editorial notifications preference to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS editorial_notifications_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.profiles.editorial_notifications_enabled IS 
  'Se false, l''utente non riceve notifiche push per gli editoriali Il Punto';
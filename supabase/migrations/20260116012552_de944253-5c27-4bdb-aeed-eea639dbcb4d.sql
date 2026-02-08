-- Aggiorna constraint notifications per includere 'new_user'
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('like', 'comment', 'follow', 'mention', 'message_like', 'reshare', 'new_user'));

-- Inserisci Arcangelo Izzo come admin
INSERT INTO public.user_roles (user_id, role) 
VALUES ('9781e20e-125f-4c69-8a86-fe27f6f106cc', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Crea trigger per notificare admin su nuove registrazioni
CREATE OR REPLACE FUNCTION public.notify_admins_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  -- Crea notifica per ogni admin
  FOR admin_record IN 
    SELECT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, actor_id, type, created_at)
    VALUES (
      admin_record.user_id,
      NEW.id,
      'new_user',
      NOW()
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger su auth.users
DROP TRIGGER IF EXISTS on_new_user_notify_admins ON auth.users;
CREATE TRIGGER on_new_user_notify_admins
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.notify_admins_new_user();
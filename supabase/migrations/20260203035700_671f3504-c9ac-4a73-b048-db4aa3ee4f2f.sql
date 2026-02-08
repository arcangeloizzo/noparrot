-- 1. Rimuovi trigger duplicato su notifications (manteniamo on_new_notification_push)
DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;

-- 2. Rimuovi trigger duplicato su messages (manteniamo on_new_message_push)
DROP TRIGGER IF EXISTS on_message_created ON public.messages;

-- 3. Aggiorna la funzione admin per rimuovere la chiamata HTTP diretta
CREATE OR REPLACE FUNCTION public.notify_admins_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_record RECORD;
BEGIN
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
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create admin notification: %', SQLERRM;
  RETURN NEW;
END;
$$;
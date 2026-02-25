-- Re-create the missing triggers for push notifications

-- Drop if they somehow partially exist
DROP TRIGGER IF EXISTS trigger_push_on_notification ON public.notifications;
DROP TRIGGER IF EXISTS trigger_push_on_message ON public.messages;
DROP TRIGGER IF EXISTS trigger_admin_on_new_profile ON public.profiles;

-- 1. Trigger: when a notification is inserted, fire push
CREATE TRIGGER trigger_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();

-- 2. Trigger: when a message is inserted, fire push
CREATE TRIGGER trigger_push_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_message();

-- 3. Trigger: when a new profile is created, notify admins
CREATE TRIGGER trigger_admin_on_new_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_new_user();
-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_new_notification_push ON public.notifications;
DROP TRIGGER IF EXISTS on_new_message_push ON public.messages;

-- Create trigger for notifications
CREATE TRIGGER on_new_notification_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();

-- Create trigger for messages
CREATE TRIGGER on_new_message_push
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_message();
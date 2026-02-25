-- Remove duplicate old triggers that call the same functions
DROP TRIGGER IF EXISTS on_new_notification_push ON public.notifications;
DROP TRIGGER IF EXISTS on_new_message_push ON public.messages;
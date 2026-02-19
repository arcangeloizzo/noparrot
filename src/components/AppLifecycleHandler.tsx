import { useAppLifecycle } from '@/hooks/useAppLifecycle';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function AppLifecycleHandler() {
  useAppLifecycle();

  // [FIX] Initialize push notifications globally
  // This ensures updated subscription on app launch/resume
  usePushNotifications();

  return null;
}

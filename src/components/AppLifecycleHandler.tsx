import { useAppLifecycle } from '@/hooks/useAppLifecycle';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useGlobalRealtime } from '@/hooks/useGlobalRealtime';

export function AppLifecycleHandler() {
  useAppLifecycle();
  useGlobalRealtime();

  // [FIX] Initialize push notifications globally
  // This ensures updated subscription on app launch/resume
  usePushNotifications();

  return null;
}

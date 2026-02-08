import { useAppLifecycle } from '@/hooks/useAppLifecycle';

export function AppLifecycleHandler() {
  useAppLifecycle();
  return null;
}

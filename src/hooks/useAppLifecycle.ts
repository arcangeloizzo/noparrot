import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { addBreadcrumb } from '@/lib/crashBreadcrumbs';
import { 
  markSessionNeedsVerification, 
  getIsSessionReady, 
  subscribeToSessionReady 
} from '@/lib/sessionGuard';

// Query keys critiche da invalidare al resume
const CRITICAL_QUERY_KEYS = [
  'posts',
  'current-profile',
  'saved-posts',
  'notifications',
  'daily-focus',
  'message-threads'
];

// Tempo minimo in background per triggerare il check (30 secondi)
const MIN_BACKGROUND_TIME_MS = 30_000;

export function useAppLifecycle() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const lastHiddenAt = useRef<number | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(getIsSessionReady);

  // Subscribe to session ready state changes
  useEffect(() => {
    const unsubscribe = subscribeToSessionReady(setIsSessionReady);
    return unsubscribe;
  }, []);

  const handleAppResume = useCallback(async (hiddenDurationMs: number) => {
    console.log(`[useAppLifecycle] Handling resume after ${Math.round(hiddenDurationMs / 1000)}s`);
    addBreadcrumb('app_resume_handler', {
      hiddenDurationSec: Math.round(hiddenDurationMs / 1000)
    });

    // 1. Mark session for verification (this sets isSessionReady = false)
    //    The sessionGuard module handles the actual verification with fail-safe timeout
    markSessionNeedsVerification();

    // 2. Resume any paused mutations
    await queryClient.resumePausedMutations();

    // 3. Invalidate critical queries to get fresh data
    for (const key of CRITICAL_QUERY_KEYS) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }

    console.log('[useAppLifecycle] Resume handling complete, queries invalidated');
    addBreadcrumb('app_resume_complete');
  }, [queryClient]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // App va in background - salva timestamp
        lastHiddenAt.current = Date.now();
        addBreadcrumb('app_hidden');
      } else if (document.visibilityState === 'visible') {
        // App torna in primo piano
        addBreadcrumb('app_visible');

        const hiddenDuration = lastHiddenAt.current
          ? Date.now() - lastHiddenAt.current
          : 0;

        console.log(`[useAppLifecycle] App resumed after ${Math.round(hiddenDuration / 1000)}s`);

        // Session check solo se:
        // 1. L'utente era loggato
        // 2. L'app è stata in background per almeno MIN_BACKGROUND_TIME_MS
        if (user && hiddenDuration >= MIN_BACKGROUND_TIME_MS) {
          handleAppResume(hiddenDuration);
        }

        lastHiddenAt.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, handleAppResume]);

  // Export session ready state for UI components
  return { 
    isSessionReady,
    checkSession: () => markSessionNeedsVerification()
  };
}

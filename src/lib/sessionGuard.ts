/**
 * Session Guard - Post-Background Stability System
 * 
 * Prevents race conditions where Edge Functions are called before JWT is refreshed
 * after the app returns from background on iOS.
 * 
 * Features:
 * - Fail-safe timeout (8s) to never block UI indefinitely
 * - Singleton pattern for refresh (max 1 per 5s cooldown)
 * - Auto-retry on 401/403 errors with token refresh
 */

import { supabase } from "@/integrations/supabase/client";
import { addBreadcrumb } from "@/lib/crashBreadcrumbs";

// Configuration
const FAIL_SAFE_TIMEOUT_MS = 8000; // 8 seconds max wait
const REFRESH_COOLDOWN_MS = 5000; // 5 seconds between refreshes

// State
let isSessionReady = true;
let sessionReadyPromise: Promise<void> | null = null;
let lastRefreshAt = 0;
let isRefreshing = false;

// Subscribers for React hooks
type Subscriber = (ready: boolean) => void;
const subscribers = new Set<Subscriber>();

function notifySubscribers(ready: boolean) {
  subscribers.forEach(cb => cb(ready));
}

export function subscribeToSessionReady(callback: Subscriber): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function getIsSessionReady(): boolean {
  return isSessionReady;
}

/**
 * Mark session as needing verification after app resume
 * Called by useAppLifecycle when app returns from background
 */
export function markSessionNeedsVerification(): void {
  console.log('[sessionGuard] Session marked for verification');
  addBreadcrumb('session_guard_mark_unready');
  
  isSessionReady = false;
  notifySubscribers(false);
  
  // Start verification with fail-safe timeout
  sessionReadyPromise = verifyAndRefreshSession();
}

/**
 * Verify session and refresh token if needed
 * Implements singleton pattern and fail-safe timeout
 */
async function verifyAndRefreshSession(): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Singleton check: avoid concurrent refreshes
    if (isRefreshing) {
      console.log('[sessionGuard] Refresh already in progress, waiting...');
      addBreadcrumb('session_guard_wait_existing');
      // Wait for existing refresh to complete (with timeout)
      await Promise.race([
        waitForSessionReady(),
        sleep(FAIL_SAFE_TIMEOUT_MS)
      ]);
      return;
    }
    
    // Cooldown check: avoid rapid-fire refreshes
    const timeSinceLastRefresh = Date.now() - lastRefreshAt;
    if (timeSinceLastRefresh < REFRESH_COOLDOWN_MS) {
      console.log('[sessionGuard] Within cooldown, skipping refresh');
      addBreadcrumb('session_guard_cooldown_skip', { 
        timeSince: timeSinceLastRefresh 
      });
      setSessionReady(true);
      return;
    }
    
    isRefreshing = true;
    addBreadcrumb('session_guard_refresh_start');
    
    // Race: refresh vs timeout
    const result = await Promise.race([
      performSessionRefresh(),
      timeoutPromise(FAIL_SAFE_TIMEOUT_MS)
    ]);
    
    if (result === 'timeout') {
      console.warn('[sessionGuard] Fail-safe timeout triggered - unblocking UI');
      addBreadcrumb('session_guard_timeout_failsafe');
    }
    
    lastRefreshAt = Date.now();
    
  } catch (error) {
    console.error('[sessionGuard] Verification error:', error);
    addBreadcrumb('session_guard_error', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  } finally {
    isRefreshing = false;
    setSessionReady(true);
    console.log('[sessionGuard] Session ready after', Date.now() - startTime, 'ms');
  }
}

async function performSessionRefresh(): Promise<'success' | 'error'> {
  try {
    // Get current session
    const { data: { session }, error: getError } = await supabase.auth.getSession();
    
    if (getError) {
      console.error('[sessionGuard] getSession error:', getError);
      addBreadcrumb('session_guard_get_error', { error: getError.message });
      
      // Try refresh anyway
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error('[sessionGuard] refreshSession failed:', refreshError);
        addBreadcrumb('session_guard_refresh_failed', { error: refreshError.message });
        return 'error';
      }
      
      addBreadcrumb('session_guard_refresh_success');
      return 'success';
    }
    
    if (!session) {
      // No session - user not logged in, nothing to refresh
      console.log('[sessionGuard] No session to refresh');
      addBreadcrumb('session_guard_no_session');
      return 'success';
    }
    
    // Check token expiry
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = expiresAt ? expiresAt - now : Infinity;
    
    // Refresh if expired or expiring within 5 minutes
    if (expiresIn < 300) {
      console.log('[sessionGuard] Token expiring soon, refreshing...');
      addBreadcrumb('session_guard_proactive_refresh', { expiresIn });
      
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error('[sessionGuard] Proactive refresh failed:', refreshError);
        addBreadcrumb('session_guard_proactive_failed', { error: refreshError.message });
        return 'error';
      }
      
      addBreadcrumb('session_guard_proactive_success');
    } else {
      addBreadcrumb('session_guard_token_valid', { expiresIn });
    }
    
    return 'success';
  } catch (error) {
    console.error('[sessionGuard] performSessionRefresh error:', error);
    return 'error';
  }
}

function setSessionReady(ready: boolean) {
  isSessionReady = ready;
  notifySubscribers(ready);
  if (ready) {
    sessionReadyPromise = null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function timeoutPromise(ms: number): Promise<'timeout'> {
  return new Promise(resolve => setTimeout(() => resolve('timeout'), ms));
}

async function waitForSessionReady(): Promise<void> {
  if (isSessionReady) return;
  
  return new Promise(resolve => {
    const unsubscribe = subscribeToSessionReady((ready) => {
      if (ready) {
        unsubscribe();
        resolve();
      }
    });
  });
}

/**
 * Wait for session to be ready (with timeout)
 * Use this before critical operations that need a valid session
 */
export async function ensureSessionReady(): Promise<void> {
  if (isSessionReady) return;
  
  console.log('[sessionGuard] Waiting for session...');
  addBreadcrumb('session_guard_await_ready');
  
  if (sessionReadyPromise) {
    await sessionReadyPromise;
  } else {
    // Fallback: wait with timeout
    await Promise.race([
      waitForSessionReady(),
      sleep(FAIL_SAFE_TIMEOUT_MS)
    ]);
  }
}

/**
 * Wrapper for Edge Function calls with session guard
 * - Ensures session is ready before calling
 * - Auto-retries once on 401/403 errors after token refresh
 */
export async function withSessionGuard<T>(
  fn: () => Promise<T>,
  options?: { 
    maxRetries?: number;
    label?: string;
  }
): Promise<T> {
  const { maxRetries = 1, label = 'edge_function' } = options || {};
  
  // Wait for session if not ready
  await ensureSessionReady();
  
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      
      // Check if it's an auth error worth retrying
      const isAuthError = isJwtOrAuthError(error);
      
      if (isAuthError && attempt < maxRetries) {
        console.log(`[sessionGuard] ${label}: Auth error on attempt ${attempt + 1}, refreshing and retrying...`);
        addBreadcrumb('session_guard_retry', { label, attempt: attempt + 1 });
        
        // Force refresh
        try {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('[sessionGuard] Retry refresh failed:', refreshError);
            throw error; // Re-throw original error
          }
          lastRefreshAt = Date.now();
          addBreadcrumb('session_guard_retry_refreshed');
          continue; // Retry the function
        } catch {
          throw error; // Re-throw original error
        }
      }
      
      // Not an auth error or exhausted retries
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Check if an error is a JWT/auth error that could be fixed by refreshing
 */
function isJwtOrAuthError(error: unknown): boolean {
  if (!error) return false;
  
  const errorStr = String(error).toLowerCase();
  const message = (error as any)?.message?.toLowerCase() || '';
  const status = (error as any)?.status || (error as any)?.code;
  
  // Check status codes
  if (status === 401 || status === 403) return true;
  
  // Check error messages
  const authPatterns = [
    'jwt',
    'token',
    'unauthorized',
    'forbidden',
    'auth',
    'session',
    'expired',
    '401',
    '403'
  ];
  
  return authPatterns.some(pattern => 
    errorStr.includes(pattern) || message.includes(pattern)
  );
}

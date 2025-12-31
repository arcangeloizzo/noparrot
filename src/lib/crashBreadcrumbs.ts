// Crash Breadcrumbs for iOS Safari debugging
// Logs key events to localStorage to diagnose crash points

const STORAGE_KEY = 'np_crash_breadcrumbs';
const MAX_BREADCRUMBS = 30;

// Publish idempotency storage
const PENDING_PUBLISH_KEY = 'np_pending_publish';

export interface Breadcrumb {
  event: string;
  timestamp: number;
  data?: Record<string, any>;
}

export interface PendingPublish {
  idempotencyKey: string;
  content: string;
  sharedUrl: string | null;
  quotedPostId: string | null;
  mediaIds: string[];
  timestamp: number;
}

export function addBreadcrumb(event: string, data?: Record<string, any>) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const breadcrumbs: Breadcrumb[] = stored ? JSON.parse(stored) : [];
    
    breadcrumbs.push({
      event,
      timestamp: Date.now(),
      data
    });
    
    // Keep only last N breadcrumbs
    const trimmed = breadcrumbs.slice(-MAX_BREADCRUMBS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    
    console.log(`[Breadcrumb] ${event}`, data || '');
  } catch (e) {
    console.warn('[Breadcrumb] Failed to store:', e);
  }
}

export function getBreadcrumbs(): Breadcrumb[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function clearBreadcrumbs() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('[Breadcrumb] Failed to clear:', e);
  }
}

// Publish idempotency helpers
export function generateIdempotencyKey(userId: string): string {
  return `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function setPendingPublish(pending: PendingPublish) {
  try {
    localStorage.setItem(PENDING_PUBLISH_KEY, JSON.stringify(pending));
    console.log('[PendingPublish] set', pending.idempotencyKey);
  } catch (e) {
    console.warn('[PendingPublish] Failed to set:', e);
  }
}

export function getPendingPublish(): PendingPublish | null {
  try {
    const stored = localStorage.getItem(PENDING_PUBLISH_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function clearPendingPublish() {
  try {
    localStorage.removeItem(PENDING_PUBLISH_KEY);
    console.log('[PendingPublish] cleared');
  } catch (e) {
    console.warn('[PendingPublish] Failed to clear:', e);
  }
}

// Check if there was a recent crash (breadcrumbs from last 30s without proper close)
export function checkForRecentCrash(): { crashed: boolean; breadcrumbs: Breadcrumb[]; pendingPublish: PendingPublish | null } {
  try {
    const breadcrumbs = getBreadcrumbs();
    const pendingPublish = getPendingPublish();

    if (breadcrumbs.length === 0) {
      return { crashed: false, breadcrumbs: [], pendingPublish };
    }
    
    const now = Date.now();
    const recentThreshold = 30000; // 30 seconds
    const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
    
    // If last breadcrumb is recent and wasn't a clean close, might be crash
    const isRecent = (now - lastBreadcrumb.timestamp) < recentThreshold;
    const wasCleanClose = ['quiz_closed', 'reader_closed', 'publish_success', 'app_close'].includes(lastBreadcrumb.event);
    
    // Check if there's an "open" without corresponding "close"
    const openEvents = ['reader_open', 'quiz_mount'];
    const closeEvents = ['reader_closed', 'quiz_closed', 'publish_success'];
    
    let openCount = 0;
    let closeCount = 0;
    
    for (const bc of breadcrumbs) {
      if (openEvents.includes(bc.event)) openCount++;
      if (closeEvents.includes(bc.event)) closeCount++;
    }
    
    const hasUnmatchedOpen = openCount > closeCount;
    const crashed = isRecent && hasUnmatchedOpen && !wasCleanClose;
    
    return { crashed, breadcrumbs, pendingPublish };
  } catch {
    return { crashed: false, breadcrumbs: [], pendingPublish: null };
  }
}

// System-level event tracking for diagnosing silent reloads on iOS
export function installSystemEventTrackers() {
  if (typeof window === 'undefined') return;

  // pagehide - fires when navigating away or page is being discarded
  window.addEventListener('pagehide', (e) => {
    addBreadcrumb('sys_pagehide', { persisted: e.persisted });
  });

  // visibilitychange - fires when tab becomes hidden OR visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      addBreadcrumb('sys_visibility_hidden');
    } else if (document.visibilityState === 'visible') {
      // App resumed from background - check for stale scroll locks
      // Import dynamically to avoid circular dependency
      import('./bodyScrollLock').then(({ forceUnlockBodyScroll }) => {
        const hasBlockingOverflow = document.body.style.overflow === 'hidden';
        const hasBlockingTouchAction = document.body.style.touchAction === 'none';
        const hasQuizClass = document.body.classList.contains('quiz-open');
        const hasReaderClass = document.body.classList.contains('reader-open');
        
        if (hasBlockingOverflow || hasBlockingTouchAction || hasQuizClass || hasReaderClass) {
          console.warn('[SystemEvents] Found stale scroll lock on visibility visible, cleaning up');
          addBreadcrumb('sys_visibility_visible_cleanup_scrolllock');
          forceUnlockBodyScroll();
        }
      });
    }
  });

  // beforeunload - best effort, may not fire on iOS
  window.addEventListener('beforeunload', () => {
    addBreadcrumb('sys_beforeunload');
  });
}

// Crash Breadcrumbs for iOS Safari debugging
// Logs key events to localStorage to diagnose crash points

const STORAGE_KEY = 'np_crash_breadcrumbs';
const MAX_BREADCRUMBS = 30;

export interface Breadcrumb {
  event: string;
  timestamp: number;
  data?: Record<string, any>;
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

// Check if there was a recent crash (breadcrumbs from last 30s without proper close)
export function checkForRecentCrash(): { crashed: boolean; breadcrumbs: Breadcrumb[] } {
  try {
    const breadcrumbs = getBreadcrumbs();
    if (breadcrumbs.length === 0) {
      return { crashed: false, breadcrumbs: [] };
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
    
    return { crashed, breadcrumbs };
  } catch {
    return { crashed: false, breadcrumbs: [] };
  }
}

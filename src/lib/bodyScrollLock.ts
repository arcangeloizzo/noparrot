/**
 * Centralized body scroll lock utility
 * Prevents conflicts between Reader and Quiz overlay components
 * Uses owner-based locking to ensure only one component controls scroll at a time
 */

import { addBreadcrumb } from './crashBreadcrumbs';

type LockOwner = 'reader' | 'quiz' | null;

let currentOwner: LockOwner = null;
let savedScrollY = 0;
let savedBodyStyles: {
  overflow: string;
  position: string;
  width: string;
  top: string;
  touchAction: string;
} | null = null;

// Track whether we used position:fixed (affects scroll restore behavior)
let usedPositionFixed = false;

const isIOS = typeof navigator !== 'undefined' && 
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
   (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1));

/**
 * Lock body scrolling
 * @param owner - The component requesting the lock ('reader' | 'quiz')
 * @returns true if lock was acquired, false if already locked by different owner
 */
export function lockBodyScroll(owner: 'reader' | 'quiz'): boolean {
  // If already locked by this owner, no-op (success)
  if (currentOwner === owner) {
    console.log(`[bodyScrollLock] Already locked by ${owner}`);
    return true;
  }
  
  // If locked by different owner, allow quiz to take over from reader
  if (currentOwner !== null && currentOwner !== owner) {
    if (owner === 'quiz') {
      // Quiz takes priority - this is the handoff from reader to quiz
      console.log(`[bodyScrollLock] Quiz taking over from reader`);
    } else {
      console.log(`[bodyScrollLock] Cannot lock: already owned by ${currentOwner}`);
      return false;
    }
  }
  
  // Save current state only if not already saved
  if (!savedBodyStyles) {
    savedScrollY = window.scrollY;
    savedBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      width: document.body.style.width,
      top: document.body.style.top,
      touchAction: document.body.style.touchAction,
    };
  }
  
  currentOwner = owner;
  
  // Apply lock styles
  document.body.classList.add(`${owner}-open`);
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';
  
  // iOS-specific: use position fixed ONLY for reader, NOT for quiz
  // Quiz on iOS caused crashes due to scroll restore during DOM transition
  if (isIOS && owner === 'reader') {
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${savedScrollY}px`;
    usedPositionFixed = true;
    console.log(`[bodyScrollLock] iOS reader: using position:fixed`);
  } else if (isIOS && owner === 'quiz') {
    // Quiz on iOS: NO position:fixed to avoid crash-inducing scroll restore
    usedPositionFixed = false;
    addBreadcrumb('quiz_lock_no_fixed_ios');
    console.log(`[bodyScrollLock] iOS quiz: skipping position:fixed (crash prevention)`);
  } else if (!isIOS) {
    // Non-iOS: always use position:fixed for both
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${savedScrollY}px`;
    usedPositionFixed = true;
  }
  
  console.log(`[bodyScrollLock] Locked by ${owner}, usedFixed=${usedPositionFixed}`);
  return true;
}

/**
 * Unlock body scrolling
 * @param owner - The component releasing the lock
 * @returns true if lock was released, false if not the owner
 */
export function unlockBodyScroll(owner: 'reader' | 'quiz'): boolean {
  // Only the current owner can unlock
  if (currentOwner !== owner) {
    console.log(`[bodyScrollLock] Cannot unlock: owned by ${currentOwner}, not ${owner}`);
    return false;
  }
  
  // iOS quiz: DEFER the style restoration to avoid crash during DOM transition
  if (isIOS && owner === 'quiz') {
    addBreadcrumb('quiz_unlock_deferred_scheduled');
    console.log(`[bodyScrollLock] iOS quiz: deferring unlock to avoid crash`);
    
    // Remove class immediately (light operation)
    document.body.classList.remove('quiz-open');
    
    // Capture state before clearing
    const stylesToRestore = savedBodyStyles;
    
    // Clear state immediately to prevent double-unlock
    savedBodyStyles = null;
    savedScrollY = 0;
    currentOwner = null;
    usedPositionFixed = false;
    
    // Defer heavy style restoration
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (stylesToRestore) {
          document.body.style.overflow = stylesToRestore.overflow;
          document.body.style.position = stylesToRestore.position;
          document.body.style.width = stylesToRestore.width;
          document.body.style.top = stylesToRestore.top;
          document.body.style.touchAction = stylesToRestore.touchAction;
        }
        // No scroll restore for quiz on iOS (we didn't use fixed)
        addBreadcrumb('quiz_unlock_deferred_done');
        console.log(`[bodyScrollLock] iOS quiz: deferred unlock complete`);
      }, 120);
    });
    
    return true;
  }
  
  // Non-iOS or reader: immediate unlock
  document.body.classList.remove('reader-open', 'quiz-open');
  
  // Capture values before clearing state
  const scrollToRestore = savedScrollY;
  const shouldRestoreScroll = usedPositionFixed && scrollToRestore > 0;
  
  // Restore styles immediately
  if (savedBodyStyles) {
    document.body.style.overflow = savedBodyStyles.overflow;
    document.body.style.position = savedBodyStyles.position;
    document.body.style.width = savedBodyStyles.width;
    document.body.style.top = savedBodyStyles.top;
    document.body.style.touchAction = savedBodyStyles.touchAction;
    
    savedBodyStyles = null;
    savedScrollY = 0;
  }
  
  currentOwner = null;
  usedPositionFixed = false;
  console.log(`[bodyScrollLock] Unlocked by ${owner}`);
  
  // Only restore scroll if we used position:fixed
  if (shouldRestoreScroll) {
    if (isIOS) {
      // iOS: defer scroll restoration to avoid crash during DOM transition
      console.log(`[bodyScrollLock] iOS: scheduling scroll restore to ${scrollToRestore}`);
      addBreadcrumb('scroll_restore_scheduled', { scrollY: scrollToRestore });
      requestAnimationFrame(() => {
        setTimeout(() => {
          // Only restore if page is visible and not mid-navigation
          if (document.visibilityState === 'visible') {
            window.scrollTo(0, scrollToRestore);
            console.log(`[bodyScrollLock] iOS: scroll restored to ${scrollToRestore}`);
            addBreadcrumb('scroll_restore_done', { scrollY: scrollToRestore });
          }
        }, 0);
      });
    } else {
      // Non-iOS: restore immediately
      window.scrollTo(0, scrollToRestore);
    }
  }
  
  return true;
}

/**
 * Force release all locks (emergency cleanup)
 */
export function forceUnlockBodyScroll(): void {
  document.body.classList.remove('reader-open', 'quiz-open');
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.width = '';
  document.body.style.top = '';
  document.body.style.touchAction = '';
  
  // Capture before clearing
  const scrollToRestore = savedScrollY;
  const shouldRestoreScroll = usedPositionFixed && scrollToRestore > 0;
  
  savedBodyStyles = null;
  savedScrollY = 0;
  currentOwner = null;
  usedPositionFixed = false;
  
  console.log(`[bodyScrollLock] Force unlocked`);
  
  // Only restore scroll if we used position:fixed
  if (shouldRestoreScroll) {
    if (isIOS) {
      addBreadcrumb('force_scroll_restore_scheduled', { scrollY: scrollToRestore });
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (document.visibilityState === 'visible') {
            window.scrollTo(0, scrollToRestore);
          }
        }, 0);
      });
    } else {
      window.scrollTo(0, scrollToRestore);
    }
  }
}

/**
 * Transfer lock ownership (used when transitioning from reader to quiz)
 */
export function transferLock(from: 'reader' | 'quiz', to: 'reader' | 'quiz'): boolean {
  if (currentOwner !== from) {
    console.log(`[bodyScrollLock] Cannot transfer: owned by ${currentOwner}, not ${from}`);
    return false;
  }
  
  // Update class
  document.body.classList.remove(`${from}-open`);
  document.body.classList.add(`${to}-open`);
  
  // On iOS, if transferring TO quiz, we need to remove position:fixed
  // because quiz doesn't use it (to avoid crash)
  if (isIOS && to === 'quiz' && usedPositionFixed) {
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
    usedPositionFixed = false;
    console.log(`[bodyScrollLock] iOS: removed position:fixed during transfer to quiz`);
    addBreadcrumb('transfer_removed_fixed_ios');
  }
  
  currentOwner = to;
  console.log(`[bodyScrollLock] Transferred from ${from} to ${to}`);
  return true;
}

/**
 * Check if body scroll is currently locked
 */
export function isBodyScrollLocked(): boolean {
  return currentOwner !== null;
}

/**
 * Get current lock owner
 */
export function getCurrentLockOwner(): LockOwner {
  return currentOwner;
}

/**
 * Check for and cleanup stale scroll locks on app startup
 * Useful for recovering from iOS Safari crashes
 */
export function cleanupStaleScrollLocks(): boolean {
  const hasReaderClass = document.body.classList.contains('reader-open');
  const hasQuizClass = document.body.classList.contains('quiz-open');
  
  if (hasReaderClass || hasQuizClass) {
    console.warn('[BodyScrollLock] Found stale scroll lock classes on startup, cleaning up');
    forceUnlockBodyScroll();
    return true;
  }
  return false;
}

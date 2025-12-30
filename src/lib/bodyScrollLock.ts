/**
 * Centralized body scroll lock utility
 * Prevents conflicts between Reader and Quiz overlay components
 * Uses owner-based locking to ensure only one component controls scroll at a time
 */

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

const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

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
  
  if (isIOS) {
    // iOS-specific: use position fixed to truly prevent scroll
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${savedScrollY}px`;
  }
  
  console.log(`[bodyScrollLock] Locked by ${owner}`);
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
  
  // Remove lock classes
  document.body.classList.remove('reader-open', 'quiz-open');
  
  // Restore styles
  if (savedBodyStyles) {
    document.body.style.overflow = savedBodyStyles.overflow;
    document.body.style.position = savedBodyStyles.position;
    document.body.style.width = savedBodyStyles.width;
    document.body.style.top = savedBodyStyles.top;
    document.body.style.touchAction = savedBodyStyles.touchAction;
    
    // Restore scroll position on iOS
    if (isIOS && savedScrollY > 0) {
      window.scrollTo(0, savedScrollY);
    }
    
    savedBodyStyles = null;
    savedScrollY = 0;
  }
  
  currentOwner = null;
  console.log(`[bodyScrollLock] Unlocked by ${owner}`);
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
  
  if (savedBodyStyles && savedScrollY > 0) {
    window.scrollTo(0, savedScrollY);
  }
  
  savedBodyStyles = null;
  savedScrollY = 0;
  currentOwner = null;
  
  console.log(`[bodyScrollLock] Force unlocked`);
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

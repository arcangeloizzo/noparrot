/**
 * Haptic Feedback Library
 * Progressive enhancement with visual fallback
 */

export const haptics = {
  /**
   * Light vibration (20ms) - for subtle feedback like taps
   */
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  },
  
  /**
   * Medium vibration (40ms) - for standard interactions
   */
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(40);
    }
  },
  
  /**
   * Selection vibration (15ms) - for selecting an option
   */
  selection: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
  },
  
  /**
   * Success pattern - for positive completion
   */
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 50, 30]);
    }
  },
  
  /**
   * Error pattern - for failed actions
   */
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 100, 50]);
    }
  },
  
  /**
   * Warning pattern - for wrong answer / retry
   */
  warning: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([40, 80, 40]);
    }
  }
};

/**
 * Visual feedback fallback for devices without haptic support
 */
export const visualFeedback = (element: HTMLElement) => {
  const originalTransform = element.style.transform;
  element.style.transform = 'scale(0.98)';
  element.style.transition = 'transform 0.1s ease-out';
  
  setTimeout(() => {
    element.style.transform = originalTransform || 'scale(1)';
  }, 100);
};

import { useState, useEffect } from 'react';

/**
 * Hook to track iOS keyboard height using the Visual Viewport API.
 * Returns the offset needed to position elements above the virtual keyboard.
 * 
 * On iOS Safari/PWA, the virtual keyboard doesn't resize the viewport
 * automatically in all cases. This hook calculates the difference between
 * window.innerHeight and visualViewport.height to determine keyboard offset.
 */
export function useVisualViewportOffset(enabled: boolean = true): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setOffset(0);
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      // Fallback: visualViewport not supported
      return;
    }

    const handleResize = () => {
      // Calculate how much the keyboard is covering
      // On iOS, when keyboard opens, visualViewport.height shrinks
      const keyboardHeight = window.innerHeight - viewport.height;
      
      // Only set offset if keyboard is likely open (>50px to filter noise)
      // Also account for viewport.offsetTop which shifts on iOS when scrolling with keyboard
      const totalOffset = keyboardHeight > 50 ? keyboardHeight - viewport.offsetTop : 0;
      
      setOffset(Math.max(0, totalOffset));
    };

    // Initial calculation
    handleResize();

    // Listen to viewport changes
    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);

    return () => {
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleResize);
    };
  }, [enabled]);

  return offset;
}

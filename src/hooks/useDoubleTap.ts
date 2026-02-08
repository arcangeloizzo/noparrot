import { useRef, useCallback } from 'react';

interface UseDoubleTapOptions {
  onDoubleTap: () => void;
  onSingleTap?: () => void;
  delay?: number;
}

export const useDoubleTap = ({ onDoubleTap, onSingleTap, delay = 300 }: UseDoubleTapOptions) => {
  const lastTapRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tapCountRef = useRef(0);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (timeSinceLastTap < delay && timeSinceLastTap > 0) {
      // Double tap detected
      tapCountRef.current = 0;
      lastTapRef.current = 0;
      onDoubleTap();
    } else {
      // First tap - wait for potential second tap
      lastTapRef.current = now;
      tapCountRef.current = 1;
      
      if (onSingleTap) {
        timeoutRef.current = setTimeout(() => {
          if (tapCountRef.current === 1) {
            onSingleTap();
          }
          tapCountRef.current = 0;
        }, delay);
      }
    }
  }, [onDoubleTap, onSingleTap, delay]);

  return { handleTap };
};

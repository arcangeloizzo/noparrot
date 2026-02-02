import { useRef, useCallback } from 'react';
import { haptics } from '@/lib/haptics';

export interface UseLongPressOptions {
  onLongPress: () => void;
  onTap?: () => void;
  threshold?: number; // ms, default 500
  disableHaptic?: boolean;
}

export interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

export const useLongPress = ({
  onLongPress,
  onTap,
  threshold = 500,
  disableHaptic = false,
}: UseLongPressOptions): LongPressHandlers => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback((x: number, y: number) => {
    isLongPressRef.current = false;
    startPosRef.current = { x, y };

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (!disableHaptic) {
        haptics.medium();
      }
      onLongPress();
    }, threshold);
  }, [onLongPress, threshold, disableHaptic]);

  const end = useCallback(() => {
    clear();
    if (!isLongPressRef.current && onTap) {
      onTap();
    }
  }, [clear, onTap]);

  const handlers: LongPressHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      // CRITICAL: Prevent text selection on iOS during long-press
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      start(touch.clientX, touch.clientY);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault(); // Prevent ghost clicks
      end();
    },
    onTouchCancel: clear,
    onMouseDown: (e: React.MouseEvent) => {
      e.stopPropagation();
      start(e.clientX, e.clientY);
    },
    onMouseUp: end,
    onMouseLeave: clear,
  };

  return handlers;
};

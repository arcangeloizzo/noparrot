import { useRef, useCallback, useEffect } from 'react';
import { haptics } from '@/lib/haptics';

export interface UseLongPressOptions {
  onLongPress: () => void;
  onTap?: () => void;
  onMove?: (x: number, y: number) => void;  // Called on touchmove AFTER long press triggered
  onRelease?: () => void;  // Called on touchend AFTER long press triggered (instead of onTap)
  threshold?: number; // ms, default 500
  disableHaptic?: boolean;
}

export interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchCancel: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

export const useLongPress = ({
  onLongPress,
  onTap,
  onMove,
  onRelease,
  threshold = 500,
  disableHaptic = false,
}: UseLongPressOptions): LongPressHandlers => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isMovedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const start = useCallback((x: number, y: number) => {
    isLongPressRef.current = false;
    isMovedRef.current = false;
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
    if (isLongPressRef.current) {
      // Long press was triggered - call onRelease instead of onTap
      onRelease?.();
    } else if (onTap && !isMovedRef.current) {
      // Regular tap - long press timer didn't fire
      onTap();
    }
    isLongPressRef.current = false;
    isMovedRef.current = false;
  }, [clear, onTap, onRelease]);

  const move = useCallback((x: number, y: number) => {
    if (startPosRef.current) {
      const dx = x - startPosRef.current.x;
      const dy = y - startPosRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 10) {
        isMovedRef.current = true;
        clear();
      }
    }
    if (isLongPressRef.current && onMove) {
      onMove(x, y);
    }
  }, [onMove, clear]);

  const handlers: LongPressHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      e.stopPropagation();
      const touch = e.touches[0];
      start(touch.clientX, touch.clientY);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      end();
    },
    onTouchMove: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      move(touch.clientX, touch.clientY);
    },
    onTouchCancel: () => {
      clear();
      isLongPressRef.current = false;
      isMovedRef.current = false;
    },
    onMouseDown: (e: React.MouseEvent) => {
      e.stopPropagation();
      start(e.clientX, e.clientY);
    },
    onMouseUp: (e: React.MouseEvent) => {
      end();
    },
    onMouseMove: (e: React.MouseEvent) => {
      move(e.clientX, e.clientY);
    },
    onMouseLeave: () => {
      clear();
      isLongPressRef.current = false;
      isMovedRef.current = false;
    },
  };

  return handlers;
};

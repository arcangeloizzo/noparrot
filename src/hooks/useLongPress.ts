import { useRef, useCallback, useEffect, useState } from 'react';
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
  ref: (el: HTMLElement | null) => void;
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
  // Tracks whether a touch is currently down on the trigger (from touchstart until end/cancel).
  // Used by the non-passive native listener to suppress iOS text-selection gesture.
  const isPressingRef = useRef(false);
  const elRef = useRef<HTMLElement | null>(null);

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
    if (isLongPressRef.current) {
      // Long press was triggered - call onRelease instead of onTap
      onRelease?.();
    } else if (onTap) {
      // Regular tap - long press timer didn't fire
      onTap();
    }
    isLongPressRef.current = false;
  }, [clear, onTap, onRelease]);

  const move = useCallback((x: number, y: number) => {
    // Only call onMove if long press has been triggered
    if (isLongPressRef.current && onMove) {
      onMove(x, y);
    }
  }, [onMove]);

  // Ref callback that attaches NON-PASSIVE touchstart/touchmove listeners on the
  // trigger element. While a touch is down on this specific element we call
  // preventDefault() — this is the only reliable way to suppress iOS Safari's
  // long-press text-selection / "Copy / Look up" callout. CSS alone (user-select,
  // touch-callout) hides the UI but does NOT cancel the gesture.
  // Scope is surgical: only this element, only while pressing — feed scroll is
  // not affected.
  const setRef = useCallback((el: HTMLElement | null) => {
    if (elRef.current === el) return;
    if (elRef.current) {
      const prev = elRef.current as any;
      if (prev.__npStart) prev.removeEventListener('touchstart', prev.__npStart);
      if (prev.__npMove) prev.removeEventListener('touchmove', prev.__npMove);
      if (prev.__npEnd) {
        prev.removeEventListener('touchend', prev.__npEnd);
        prev.removeEventListener('touchcancel', prev.__npEnd);
      }
      prev.__npStart = prev.__npMove = prev.__npEnd = null;
    }
    elRef.current = el;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      isPressingRef.current = true;
      // Prevent iOS from arming its text-selection gesture on this element.
      e.preventDefault();
    };
    const onMove = (e: TouchEvent) => {
      if (isPressingRef.current) {
        e.preventDefault();
      }
    };
    const onEnd = () => {
      isPressingRef.current = false;
    };
    (el as any).__npStart = onStart;
    (el as any).__npMove = onMove;
    (el as any).__npEnd = onEnd;
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
  }, []);

  const handlers: LongPressHandlers = {
    ref: setRef,
    onTouchStart: (e: React.TouchEvent) => {
      // Note: native non-passive listener (see setRef) already called preventDefault.
      // React synthetic listeners are often passive on iOS, so we don't rely on it here.
      e.stopPropagation();
      const touch = e.touches[0];
      start(touch.clientX, touch.clientY);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      isPressingRef.current = false;
      end();
    },
    onTouchMove: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      move(touch.clientX, touch.clientY);
    },
    onTouchCancel: () => {
      isPressingRef.current = false;
      clear();
      isLongPressRef.current = false;
    },
    onMouseDown: (e: React.MouseEvent) => {
      e.stopPropagation();
      start(e.clientX, e.clientY);
    },
    onMouseUp: end,
    onMouseMove: (e: React.MouseEvent) => {
      move(e.clientX, e.clientY);
    },
    onMouseLeave: () => {
      clear();
      isLongPressRef.current = false;
    },
  };

  return handlers;
};

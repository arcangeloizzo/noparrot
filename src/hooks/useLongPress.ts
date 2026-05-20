import { useRef, useCallback } from 'react';
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
  // Tracks whether a touch is currently down on the trigger (from touchstart until end/cancel).
  // Used by the non-passive native listener to suppress iOS text-selection gesture.
  const isPressingRef = useRef(false);
  // Element currently receiving a press + its non-passive listeners,
  // so we can detach them on touchend/cancel.
  const activeElRef = useRef<HTMLElement | null>(null);
  const nativeMoveRef = useRef<((e: TouchEvent) => void) | null>(null);
  const nativeStartRef = useRef<((e: TouchEvent) => void) | null>(null);

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

  // Attach a NON-PASSIVE touchmove listener to the specific trigger element
  // for the duration of a single press. preventDefault on touchmove suppresses
  // iOS Safari's long-press text-selection / "Copy / Look up" callout, which
  // CSS (user-select / touch-callout) cannot block — CSS only hides the UI,
  // it doesn't cancel the underlying gesture.
  // Scope is surgical: only this element, only between touchstart and
  // touchend/cancel. Global feed scroll is never affected.
  const detachNativeBlocker = useCallback(() => {
    const el = activeElRef.current;
    const hMove = nativeMoveRef.current;
    const hStart = nativeStartRef.current;
    if (el) {
      if (hMove) el.removeEventListener('touchmove', hMove);
      if (hStart) el.removeEventListener('touchstart', hStart);
    }
    activeElRef.current = null;
    nativeMoveRef.current = null;
    nativeStartRef.current = null;
  }, []);

  const attachNativeBlocker = useCallback((el: HTMLElement) => {
    // Detach any leftover listener from a previous (interrupted) press.
    const prevEl = activeElRef.current;
    const prevHMove = nativeMoveRef.current;
    const prevHStart = nativeStartRef.current;
    if (prevEl) {
      if (prevHMove) prevEl.removeEventListener('touchmove', prevHMove);
      if (prevHStart) prevEl.removeEventListener('touchstart', prevHStart);
    }
    const handler = (e: TouchEvent) => {
      if (isPressingRef.current) e.preventDefault();
    };
    activeElRef.current = el;
    nativeMoveRef.current = handler;
    nativeStartRef.current = handler;
    el.addEventListener('touchmove', handler, { passive: false });
    // Also block touchstart so iOS cannot start a text-selection gesture
    // from a stationary long-press (where touchmove never fires).
    el.addEventListener('touchstart', handler, { passive: false });
  }, []);

  const handlers: LongPressHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      e.stopPropagation();
      isPressingRef.current = true;
      // Attach the non-passive blocker on THIS element so iOS can't start a
      // text-selection gesture if the user keeps the finger pressed past the
      // system's selection threshold (~1s).
      attachNativeBlocker(e.currentTarget as HTMLElement);
      const touch = e.touches[0];
      start(touch.clientX, touch.clientY);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      isPressingRef.current = false;
      detachNativeBlocker();
      end();
    },
    onTouchMove: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      move(touch.clientX, touch.clientY);
    },
    onTouchCancel: () => {
      isPressingRef.current = false;
      detachNativeBlocker();
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

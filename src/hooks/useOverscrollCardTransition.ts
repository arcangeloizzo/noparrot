import { useRef, useCallback } from 'react';
import type { EmblaCarouselType } from 'embla-carousel';

// Master switch — flip to false to instantly restore previous behavior.
export const ENABLE_OVERSCROLL_TRANSITION = true;

// Tuning constants
const COMMIT_RATIO = 0.15;   // fraction of viewport height needed to commit card change
const RESISTANCE = 0.45;     // visual translation damping over accumulated overscroll
const RELEASE_MS = 180;      // ease-out snap-back duration when under threshold
const H_BIAS = 1.2;          // ignore gestures more horizontal than vertical (|dx|*bias > |dy|)

interface Options {
  getEmbla: () => EmblaCarouselType | undefined;
  getViewportHeight: () => number;
}

/**
 * Overscroll-to-change-card gesture.
 *
 * When the inner scroller hits its end and the finger keeps going, we stop
 * scrolling text and start lifting the slide with resistance. Release above
 * COMMIT_RATIO * viewportH commits to next/prev; below, the slide snaps back.
 *
 * The accumulator measures REAL finger travel past end-of-scroll, not total
 * delta from touchstart, so pixels spent scrolling content don't count.
 */
export function useOverscrollCardTransition({ getEmbla, getViewportHeight }: Options) {
  const scrollerRef = useRef<HTMLElement | null>(null);
  const wrapperRef = useRef<HTMLElement | null>(null);

  const startY = useRef(0);
  const startX = useRef(0);
  const lastY = useRef(0);

  // Overscroll accumulator (positive = lifting up to reveal next, negative = pulling down for prev)
  const overscroll = useRef(0);
  // Whether we are currently in overscroll mode (touchmove has crossed an edge)
  const engaged = useRef<'none' | 'bottom' | 'top'>('none');
  // Anchor Y at the moment we engaged overscroll (finger position when edge was reached)
  const anchorY = useRef(0);
  const horizontalLocked = useRef(false);

  const rafId = useRef<number | null>(null);
  const pendingTransform = useRef<number>(0);

  const applyTransform = useCallback((tx: number) => {
    pendingTransform.current = tx;
    if (rafId.current != null) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      const el = wrapperRef.current;
      if (!el) return;
      const v = pendingTransform.current;
      el.style.transform = v === 0 ? '' : `translateY(${v}px)`;
    });
  }, []);

  const resetTransform = useCallback((animated: boolean) => {
    const el = wrapperRef.current;
    if (!el) return;
    const reduced = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (animated && !reduced) {
      el.style.transition = `transform ${RELEASE_MS}ms ease-out`;
      el.style.transform = '';
      window.setTimeout(() => {
        if (wrapperRef.current === el) {
          el.style.transition = '';
          el.style.willChange = '';
        }
      }, RELEASE_MS + 20);
    } else {
      el.style.transition = '';
      el.style.transform = '';
      el.style.willChange = '';
    }
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!ENABLE_OVERSCROLL_TRANSITION) return;
    const t = e.target as HTMLElement | null;
    const sc = t?.closest?.('[data-slide-scroll="true"]') as HTMLElement | null;
    const wr = t?.closest?.('[data-slide-wrapper="true"]') as HTMLElement | null;
    scrollerRef.current = sc;
    wrapperRef.current = wr;
    startY.current = e.touches[0].clientY;
    startX.current = e.touches[0].clientX;
    lastY.current = startY.current;
    overscroll.current = 0;
    engaged.current = 'none';
    anchorY.current = 0;
    horizontalLocked.current = false;
    if (wr) {
      wr.style.transition = '';
      wr.style.willChange = 'transform';
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!ENABLE_OVERSCROLL_TRANSITION) return;
    const sc = scrollerRef.current;
    if (!sc) return;
    const y = e.touches[0].clientY;
    const x = e.touches[0].clientX;
    const dy = y - startY.current;
    const dx = x - startX.current;

    // Horizontal gestures (e.g. editorial carousel) bail out.
    if (!horizontalLocked.current && engaged.current === 'none') {
      if (Math.abs(dx) * H_BIAS > Math.abs(dy) && Math.abs(dx) > 6) {
        horizontalLocked.current = true;
        return;
      }
    }
    if (horizontalLocked.current) return;

    // Only meaningful on tall content — short cards are handled by Embla directly.
    const tall = sc.scrollHeight > sc.clientHeight + 1;
    if (!tall) return;

    const atTop = sc.scrollTop <= 0;
    const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
    const movingUp = y < lastY.current;   // finger up → wants next
    const movingDown = y > lastY.current; // finger down → wants prev
    lastY.current = y;

    // Engage / disengage state machine
    if (engaged.current === 'none') {
      if (atBottom && movingUp) {
        engaged.current = 'bottom';
        anchorY.current = y;
        overscroll.current = 0;
      } else if (atTop && movingDown) {
        engaged.current = 'top';
        anchorY.current = y;
        overscroll.current = 0;
      }
    }

    if (engaged.current === 'bottom') {
      // overscroll positive = finger travelled UP past anchor
      const raw = anchorY.current - y;
      overscroll.current = Math.max(0, raw);
      if (overscroll.current === 0) {
        engaged.current = 'none';
        applyTransform(0);
        return;
      }
      applyTransform(-overscroll.current * RESISTANCE);
    } else if (engaged.current === 'top') {
      // overscroll positive = finger travelled DOWN past anchor
      const raw = y - anchorY.current;
      overscroll.current = Math.max(0, raw);
      if (overscroll.current === 0) {
        engaged.current = 'none';
        applyTransform(0);
        return;
      }
      applyTransform(overscroll.current * RESISTANCE);
    }
  }, [applyTransform]);

  const onTouchEnd = useCallback(() => {
    if (!ENABLE_OVERSCROLL_TRANSITION) return;
    const dir = engaged.current;
    const amount = overscroll.current;
    const vh = getViewportHeight() || 1;
    const threshold = COMMIT_RATIO * vh;

    engaged.current = 'none';
    overscroll.current = 0;
    horizontalLocked.current = false;

    if (dir === 'none' || amount <= 0) {
      // No transform was applied — nothing to reset.
      const el = wrapperRef.current;
      if (el) el.style.willChange = '';
      scrollerRef.current = null;
      wrapperRef.current = null;
      return;
    }

    const embla = getEmbla();
    if (amount >= threshold && embla) {
      // Commit: drop our transform immediately, let Embla animate the snap.
      resetTransform(false);
      if (dir === 'bottom') embla.scrollNext();
      else embla.scrollPrev();
    } else {
      resetTransform(true);
    }

    scrollerRef.current = null;
    wrapperRef.current = null;
  }, [getEmbla, getViewportHeight, resetTransform]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
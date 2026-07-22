import { useRef, useCallback } from 'react';
import type { EmblaCarouselType } from 'embla-carousel';

// Master switch — flip to false to instantly restore previous behavior.
export const ENABLE_OVERSCROLL_TRANSITION = true;

// Tuning constants
const COMMIT_RATIO = 0.22;   // fraction of viewport height needed to commit card change
const RESISTANCE = 0.5;      // visual translation damping over accumulated overscroll
const RELEASE_MS = 220;      // ease-out snap-back duration (also matches Embla settle window)
const H_BIAS = 1.2;          // ignore gestures more horizontal than vertical (|dx|*bias > |dy|)

interface Options {
  getEmbla: () => EmblaCarouselType | undefined;
  getViewportHeight: () => number;
  // Element on which we write the `--overscroll-offset` CSS variable.
  // Slides read it via a stylesheet rule and translate together, so Embla's
  // own container transform is never touched.
  getTarget: () => HTMLElement | null;
}

/**
 * Overscroll-to-change-card gesture.
 *
 * When the inner scroller hits its end and the finger keeps going, we lift
 * ALL slides together with resistance by writing a `--overscroll-offset`
 * CSS variable on the viewport. Slides consume that variable through a
 * CSS rule (`.np-overscroll-slide`) so Embla's container transform stays
 * untouched and the next/prev card genuinely peeks into view.
 *
 * Release above COMMIT_RATIO * viewportH commits to next/prev; below, the
 * offset eases back to 0. On commit we do NOT clear the offset before
 * `scrollNext/scrollPrev` — we ease it to 0 concurrently with Embla's snap
 * so there is no back-jump before the transition.
 */
export function useOverscrollCardTransition({ getEmbla, getViewportHeight, getTarget }: Options) {
  const scrollerRef = useRef<HTMLElement | null>(null);

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

  // will-change is only applied WHILE overscroll is engaged. Promoting the
  // viewport to a layer unconditionally can break nested native scrolling
  // on iOS Safari (`-webkit-overflow-scrolling: touch`).
  const willChangeSet = useRef(false);
  const currentOffsetPx = useRef(0);
  const rafId = useRef<number | null>(null);
  const pendingOffset = useRef(0);
  const releaseRafId = useRef<number | null>(null);

  const writeOffset = useCallback((px: number) => {
    currentOffsetPx.current = px;
    pendingOffset.current = px;
    if (rafId.current != null) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      const t = getTarget();
      if (!t) return;
      const v = pendingOffset.current;
      if (v === 0) t.style.removeProperty('--overscroll-offset');
      else t.style.setProperty('--overscroll-offset', `${v}px`);
    });
  }, [getTarget]);

  const ensureWillChange = useCallback(() => {
    if (willChangeSet.current) return;
    const t = getTarget();
    if (!t) return;
    t.style.willChange = 'transform';
    willChangeSet.current = true;
  }, [getTarget]);

  const clearWillChange = useCallback(() => {
    if (!willChangeSet.current) return;
    const t = getTarget();
    if (t) t.style.willChange = '';
    willChangeSet.current = false;
  }, [getTarget]);

  const cancelRelease = useCallback(() => {
    if (releaseRafId.current != null) {
      cancelAnimationFrame(releaseRafId.current);
      releaseRafId.current = null;
    }
  }, []);

  const animateOffsetTo = useCallback((toPx: number, durationMs: number, onDone?: () => void) => {
    cancelRelease();
    const fromPx = currentOffsetPx.current;
    if (fromPx === toPx) { onDone?.(); return; }
    const reduced = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || durationMs <= 0) {
      writeOffset(toPx);
      onDone?.();
      return;
    }
    const startTs = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - startTs) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = fromPx + (toPx - fromPx) * eased;
      writeOffset(v);
      if (p < 1) {
        releaseRafId.current = requestAnimationFrame(step);
      } else {
        releaseRafId.current = null;
        onDone?.();
      }
    };
    releaseRafId.current = requestAnimationFrame(step);
  }, [cancelRelease, writeOffset]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!ENABLE_OVERSCROLL_TRANSITION) return;
    const t = e.target as HTMLElement | null;
    const sc = t?.closest?.('[data-slide-scroll="true"]') as HTMLElement | null;
    scrollerRef.current = sc;
    startY.current = e.touches[0].clientY;
    startX.current = e.touches[0].clientX;
    lastY.current = startY.current;
    overscroll.current = 0;
    engaged.current = 'none';
    anchorY.current = 0;
    horizontalLocked.current = false;
    // Do NOT set will-change here — only when overscroll actually engages.
    // Cancel any in-flight release from a previous gesture so this touch
    // takes over cleanly.
    cancelRelease();
  }, [cancelRelease]);

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
        ensureWillChange();
      } else if (atTop && movingDown) {
        // On the FIRST slide, top overscroll is owned by pull-to-refresh.
        // Never engage here — otherwise the two gestures fight in the
        // 0..~120px band and the user sees two overlapping motions.
        const embla = getEmbla();
        if (embla && embla.selectedScrollSnap() === 0) return;
        engaged.current = 'top';
        anchorY.current = y;
        overscroll.current = 0;
        ensureWillChange();
      }
    }

    if (engaged.current === 'bottom') {
      // overscroll positive = finger travelled UP past anchor
      const raw = anchorY.current - y;
      overscroll.current = Math.max(0, raw);
      writeOffset(-overscroll.current * RESISTANCE);
      if (overscroll.current === 0) {
        engaged.current = 'none';
      }
    } else if (engaged.current === 'top') {
      // overscroll positive = finger travelled DOWN past anchor
      const raw = y - anchorY.current;
      overscroll.current = Math.max(0, raw);
      writeOffset(overscroll.current * RESISTANCE);
      if (overscroll.current === 0) {
        engaged.current = 'none';
      }
    }
  }, [ensureWillChange, getEmbla, writeOffset]);

  const onTouchEnd = useCallback(() => {
    if (!ENABLE_OVERSCROLL_TRANSITION) return;
    const dir = engaged.current;
    const amount = overscroll.current;
    const vh = getViewportHeight() || 1;
    const threshold = COMMIT_RATIO * vh;

    engaged.current = 'none';
    overscroll.current = 0;
    horizontalLocked.current = false;
    scrollerRef.current = null;
    // NOTE: the target element (viewport) is NEVER nulled — it must retain
    // the `--overscroll-offset` variable until the release animation
    // finishes writing 0 into it.

    if (dir === 'none' || amount <= 0) {
      // No overscroll was applied — but a stray offset can linger if a
      // previous release was cancelled by a new touch that never engaged.
      // Guarantee we always land on 0.
      if (currentOffsetPx.current !== 0) {
        animateOffsetTo(0, RELEASE_MS, clearWillChange);
      } else {
        clearWillChange();
      }
      return;
    }

    const embla = getEmbla();
    if (amount >= threshold && embla) {
      // Commit: DO NOT snap the offset back to 0 before Embla moves — that
      // caused a visible back-jump. Kick Embla, then ease the offset to 0
      // concurrently with the snap animation. The two motions overlap so
      // the visible content transitions continuously.
      if (dir === 'bottom') embla.scrollNext();
      else embla.scrollPrev();
      animateOffsetTo(0, RELEASE_MS, clearWillChange);
    } else {
      animateOffsetTo(0, RELEASE_MS, clearWillChange);
    }
  }, [animateOffsetTo, clearWillChange, getEmbla, getViewportHeight]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
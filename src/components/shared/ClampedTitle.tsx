import { useEffect, useRef, useState, forwardRef, type CSSProperties, createElement, type Ref } from 'react';

interface ClampedTitleProps {
  text: string;
  maxLines: number;
  className?: string;
  style?: CSSProperties;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'div';
}

/**
 * Tronca un testo a un numero massimo di righe, garantendo che il
 * taglio cada SEMPRE su una parola intera (mai a metà parola), e
 * aggiunge '…' come ellipsis.
 */
export const ClampedTitle = forwardRef<HTMLElement, ClampedTitleProps>(function ClampedTitle(
  { text, maxLines, className, style, as = 'h1' },
  forwardedRef
) {
  const ref = useRef<HTMLElement | null>(null);
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let cancelled = false;

    const measure = () => {
      if (cancelled || !el) return;
      el.textContent = text;
      const cs = getComputedStyle(el);
      const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      const maxHeight = lineHeight * maxLines + 1;

      if (el.scrollHeight <= maxHeight) {
        setDisplay(text);
        return;
      }

      let lo = 0;
      let hi = text.length;
      let best = '';
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        el.textContent = text.slice(0, mid) + '…';
        if (el.scrollHeight <= maxHeight) {
          best = text.slice(0, mid);
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      const lastSpace = best.lastIndexOf(' ');
      const trimmed = lastSpace > 0 ? best.slice(0, lastSpace) : best;
      const final = trimmed.replace(/[\s.,;:!?—–-]+$/u, '') + '…';
      setDisplay(final);
    };

    requestAnimationFrame(() => requestAnimationFrame(measure));

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(measure);
    });
    ro.observe(el);

    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [text, maxLines]);

  const setRefs = (el: HTMLElement | null) => {
    ref.current = el;
    if (typeof forwardedRef === 'function') forwardedRef(el);
    else if (forwardedRef) (forwardedRef as { current: HTMLElement | null }).current = el;
  };

  return createElement(
    as,
    {
      ref: setRefs,
      className,
      style,
    },
    display
  );
});
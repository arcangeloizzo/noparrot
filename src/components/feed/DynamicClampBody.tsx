import { memo, useCallback, useLayoutEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MentionText } from "./MentionText";

interface DynamicClampBodyProps {
  /** Ref to the content region whose height bounds the available text space. */
  containerRef: React.RefObject<HTMLElement>;
  /** Body text content. */
  content: string;
  /** Called when user taps "Approfondisci" — opens the existing bottom sheet. */
  onShowFull: () => void;
  /** ClassName for the text element (typography). */
  className?: string;
  /** Inline style for the text element. */
  style?: React.CSSProperties;
  /** Numeric line-height in px used to compute available rows. */
  lineHeightPx?: number;
  /** Lower bound for line-clamp. */
  minLines?: number;
  /** Hard upper bound for line-clamp. */
  maxLinesCap?: number;
  /** Vertical px reserved for the "Approfondisci" button. */
  reserveButtonPx?: number;
  /** Disable measurement (e.g. when card is far from active). */
  enabled?: boolean;
  /** ClassName for the "Approfondisci" button. */
  buttonClassName?: string;
  /** Show the Maximize2 icon next to button label. */
  showButtonIcon?: boolean;
  /**
   * Force the "Approfondisci" button to appear even when the text is not
   * truncated. Used by parents when other expandable content (chips, full
   * image, podcast preview, ...) is present in the card. The component
   * internally exposes the button when `isTruncated || extraExpandable`.
   */
  extraExpandable?: boolean;
  /**
   * Color the bottom fade resolves to. Should match the REAL background color
   * underneath the text at the bottom of the card (immersive cards use
   * variant-specific gradients, not `--card`). Accepts any valid CSS color
   * (hex, rgb, hsl). Defaults to `hsl(var(--card))` for backward compat.
   */
  fadeColor?: string;
}

/**
 * Body text with a line-clamp computed at runtime from the available
 * vertical space inside `containerRef`. Uses a single ResizeObserver on
 * the container (debounced via rAF) and avoids feedback loops because
 * clamping the text element does not alter the observed container size.
 *
 * When the text is actually truncated, a "Approfondisci" button appears
 * and calls `onShowFull` — meant to open the existing FullTextModal
 * bottom sheet, NOT to introduce internal scroll inside the card.
 */
const DynamicClampBodyInner = ({
  containerRef,
  content,
  onShowFull,
  className,
  style,
  lineHeightPx = 24,
  minLines = 2,
  maxLinesCap = 40,
  reserveButtonPx = 28,
  enabled = true,
  buttonClassName,
  showButtonIcon = false,
  extraExpandable = false,
  fadeColor,
}: DynamicClampBodyProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<number>(6);
  const [isTruncated, setIsTruncated] = useState<boolean>(false);
  const rafRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const wrapper = wrapperRef.current;
    const textEl = textRef.current;
    if (!container || !wrapper || !textEl) return;

    const cs = getComputedStyle(container);
    const padBottom = parseFloat(cs.paddingBottom) || 0;
    const railRect = container.getBoundingClientRect();
    const availableBottom = railRect.bottom - padBottom;
    const wrapperTop = wrapper.getBoundingClientRect().top;
    const available = availableBottom - wrapperTop - reserveButtonPx;
    if (!isFinite(available) || available <= 0) return;

    const nextLines = Math.max(
      minLines,
      Math.min(maxLinesCap, Math.floor(available / lineHeightPx))
    );
    setLines((prev) => (prev !== nextLines ? nextLines : prev));

    // Detect truncation by measuring the UNCLAMPED shadow element.
    // This avoids the self-falsifying loop where re-measuring an
    // already-clamped element reports no overflow.
    requestAnimationFrame(() => {
      const shadow = shadowRef.current;
      if (!shadow) return;
      const totalHeight = shadow.scrollHeight;
      const allowedHeight = nextLines * lineHeightPx;
      const truncated = totalHeight > allowedHeight + 1;
      setIsTruncated((prev) => (prev !== truncated ? truncated : prev));
    });
  }, [containerRef, lineHeightPx, minLines, maxLinesCap, reserveButtonPx]);

  useLayoutEffect(() => {
    if (!enabled) return;
    measure();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        measure();
      });
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, measure, containerRef, content]);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <div
          ref={textRef}
          className={cn("whitespace-pre-wrap break-words", className)}
          style={{
            maxHeight: `${lines * lineHeightPx}px`,
            overflow: "hidden",
            ...style,
          }}
        >
          <MentionText content={content} />
        </div>
        {/* Shadow element: unclamped source of truth for truncation measurement. */}
        <div
          ref={shadowRef}
          aria-hidden="true"
          className={cn("whitespace-pre-wrap break-words", className)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            width: "100%",
            visibility: "hidden",
            pointerEvents: "none",
            ...style,
          }}
        >
          <MentionText content={content} />
        </div>
        {isTruncated && (() => {
          const c = fadeColor ?? "hsl(var(--card))";
          return (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{
              height: `${Math.round(lineHeightPx * 3)}px`,
              background: `linear-gradient(to bottom, color-mix(in srgb, ${c} 0%, transparent) 0%, color-mix(in srgb, ${c} 0%, transparent) 30%, color-mix(in srgb, ${c} 70%, transparent) 70%, ${c} 100%)`,
            }}
          />
          );
        })()}
      </div>
      {(isTruncated || extraExpandable) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowFull();
          }}
          className={cn(
            "mt-2 inline-flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline",
            buttonClassName
          )}
        >
          <span>Approfondisci</span>
          {showButtonIcon && <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
};

export const DynamicClampBody = memo(DynamicClampBodyInner);
DynamicClampBody.displayName = "DynamicClampBody";
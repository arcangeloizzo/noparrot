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
}: DynamicClampBodyProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
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

    // Detect truncation AFTER clamp is applied. Use rAF so the
    // layout has settled before reading scrollHeight.
    requestAnimationFrame(() => {
      const t = textRef.current;
      if (!t) return;
      const truncated = t.scrollHeight - t.clientHeight > 1;
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
            display: "-webkit-box",
            WebkitLineClamp: lines,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            ...style,
          }}
        >
          <MentionText content={content} />
        </div>
        {isTruncated && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{
              height: `${Math.round(lineHeightPx * 1.5)}px`,
              background:
                "linear-gradient(to bottom, hsl(var(--card) / 0) 0%, hsl(var(--card)) 100%)",
            }}
          />
        )}
      </div>
      {isTruncated && (
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
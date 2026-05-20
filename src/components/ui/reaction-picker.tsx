import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

export type ReactionType = 'heart' | 'laugh' | 'wow' | 'sad' | 'fire';

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'heart', emoji: '❤️', label: 'Love' },
  { type: 'laugh', emoji: '😂', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'fire', emoji: '🔥', label: 'Fire' },
];

const AUTO_CLOSE_MS = 4000;
// Grace window after open during which we ignore close events
// (covers the touchend from the long-press finger release).
const OPEN_GRACE_MS = 350;

interface ReactionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (reactionType: ReactionType) => void;
  currentReaction?: ReactionType | null;
  /** Ref to the trigger button for position calculation */
  triggerRef?: React.RefObject<HTMLElement>;
  /** Ref to the action bar — picker is placed in a safe lane ABOVE it */
  actionBarRef?: React.RefObject<HTMLElement>;
  className?: string;
}

export const ReactionPicker = React.forwardRef<HTMLDivElement, ReactionPickerProps>(
  ({ isOpen, onClose, onSelect, currentReaction, triggerRef, actionBarRef, className }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const internalTriggerRef = React.useRef<HTMLDivElement>(null);
    const isInteractingRef = React.useRef(false);
    const autoCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [positionStyle, setPositionStyle] = React.useState<React.CSSProperties>({});
    const [selectedFeedback, setSelectedFeedback] = React.useState<ReactionType | null>(null);

    // Open grace + auto-close timer
    React.useEffect(() => {
      if (!isOpen) return;
      isInteractingRef.current = true;
      const grace = setTimeout(() => {
        isInteractingRef.current = false;
      }, OPEN_GRACE_MS);
      return () => clearTimeout(grace);
    }, [isOpen]);

    const resetAutoClose = React.useCallback(() => {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = setTimeout(() => {
        onClose();
      }, AUTO_CLOSE_MS);
    }, [onClose]);

    React.useEffect(() => {
      if (!isOpen) return;
      resetAutoClose();
      return () => {
        if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      };
    }, [isOpen, resetAutoClose]);

    // Lock background scroll while the menu is open
    React.useEffect(() => {
      if (!isOpen) return;
      const prevOverflow = document.body.style.overflow;
      const prevTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.touchAction = prevTouchAction;
      };
    }, [isOpen]);

    // Position relative to trigger, with vertical flip
    React.useEffect(() => {
      if (!isOpen) return;
      const trigger = triggerRef?.current || internalTriggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const pickerWidth = 240;
      const pickerHeight = 52;
      const safeMargin = 12;
      const minSpace = pickerHeight + 16;

      let idealLeft = rect.left + rect.width / 2 - pickerWidth / 2;
      if (idealLeft < safeMargin) idealLeft = safeMargin;
      else if (idealLeft + pickerWidth > viewportWidth - safeMargin) {
        idealLeft = viewportWidth - pickerWidth - safeMargin;
      }

      // Prefer anchoring to the action bar (safe lane above it) when provided.
      const barEl =
        actionBarRef?.current ||
        (trigger.closest('.action-bar-zone') as HTMLElement | null);
      const anchorTop = barEl ? barEl.getBoundingClientRect().top : rect.top;

      const spaceAbove = anchorTop;
      const spaceBelow = viewportHeight - rect.bottom;
      const showBelow = spaceAbove < minSpace && spaceBelow > minSpace;

      setPositionStyle(
        showBelow
          ? { position: 'fixed', top: `${rect.bottom + 8}px`, left: `${idealLeft}px` }
          : { position: 'fixed', bottom: `${viewportHeight - anchorTop + 8}px`, left: `${idealLeft}px` }
      );
    }, [isOpen, triggerRef, actionBarRef]);

    // Escape to close
    React.useEffect(() => {
      if (!isOpen) return;
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    const handleShieldClose = React.useCallback((e: React.SyntheticEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (isInteractingRef.current) return;
      onClose();
    }, [onClose]);

    const handleSelect = (type: ReactionType) => {
      if (isInteractingRef.current) return;
      haptics.selection();
      setSelectedFeedback(type);
      // Brief scale-up feedback before closing
      setTimeout(() => {
        onSelect(type);
        onClose();
        setSelectedFeedback(null);
      }, 120);
    };

    const renderEmojiButton = (
      reaction: { type: ReactionType; emoji: string; label: string },
      index: number,
    ) => {
      const isSelected = selectedFeedback === reaction.type;
      return (
        <button
          key={reaction.type}
          type="button"
          data-reaction-type={reaction.type}
          onPointerEnter={resetAutoClose}
          onTouchStart={(e) => {
            e.stopPropagation();
            resetAutoClose();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleSelect(reaction.type);
          }}
          className={cn(
            "w-11 h-11 flex items-center justify-center rounded-full select-none cursor-pointer",
            "transition-transform duration-150",
            isSelected ? "scale-150" : "hover:scale-125 active:scale-110",
            "animate-in fade-in-0 zoom-in-50",
            currentReaction === reaction.type &&
              "ring-2 ring-primary ring-offset-2 ring-offset-popover bg-primary/10"
          )}
          style={{
            animationDelay: `${index * 25}ms`,
            WebkitTapHighlightColor: 'transparent',
          }}
          aria-label={reaction.label}
        >
          <span className="text-2xl select-none pointer-events-none">{reaction.emoji}</span>
        </button>
      );
    };

    const portalContent = (
      <>
        {/* Tap-outside shield. Opaque-free, just intercepts taps. */}
        <div
          className="fixed inset-0 z-[9998]"
          style={{ touchAction: 'none', background: 'transparent' }}
          onClick={handleShieldClose}
          onTouchEnd={handleShieldClose}
        />
        {/* Picker — opaque background, NO backdrop-blur */}
        <div
          ref={containerRef}
          onPointerMove={resetAutoClose}
          onTouchMove={(e) => { e.stopPropagation(); resetAutoClose(); }}
          className={cn(
            "z-[9999] pointer-events-auto flex items-center gap-1 px-2 py-1.5",
            "bg-popover border border-border/60",
            "rounded-full shadow-2xl",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            "max-w-[calc(100vw-24px)]",
            className
          )}
          style={{ ...positionStyle, touchAction: 'none' }}
        >
          {REACTIONS.map((reaction, index) => renderEmojiButton(reaction, index))}
        </div>
      </>
    );

    if (!triggerRef) {
      return (
        <>
          <div ref={internalTriggerRef} className="absolute inset-0 pointer-events-none" />
          {isOpen && createPortal(portalContent, document.body)}
        </>
      );
    }

    if (!isOpen) return null;
    return createPortal(portalContent, document.body);
  }
);

ReactionPicker.displayName = "ReactionPicker";

export const reactionToEmoji = (type: ReactionType): string => {
  const reaction = REACTIONS.find(r => r.type === type);
  return reaction?.emoji || '❤️';
};

export { REACTIONS };

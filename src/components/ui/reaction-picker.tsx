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

interface ReactionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (reactionType: ReactionType) => void;
  currentReaction?: ReactionType | null;
  /** Ref to the trigger button for position calculation */
  triggerRef?: React.RefObject<HTMLElement>;
  className?: string;
}

export const ReactionPicker = React.forwardRef<HTMLDivElement, ReactionPickerProps>(
  ({ isOpen, onClose, onSelect, currentReaction, triggerRef, className }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const internalTriggerRef = React.useRef<HTMLDivElement>(null);
    
    // Stato per bloccare la chiusura immediata dopo l'apertura (fix iOS long-press release)
    const [isInteracting, setIsInteracting] = React.useState(false);
    
    // Dynamic position state for viewport-aware positioning
    const [positionStyle, setPositionStyle] = React.useState<React.CSSProperties>({});
    
    // Reset interacting state quando il picker si apre
    React.useEffect(() => {
      if (isOpen) {
        setIsInteracting(true);
        const timer = setTimeout(() => setIsInteracting(false), 350);
        return () => clearTimeout(timer);
      }
    }, [isOpen]);
    
    // Calculate safe position within viewport with flip logic
    React.useEffect(() => {
      if (!isOpen) return;
      
      // Use external triggerRef if provided, otherwise fall back to internal wrapper
      const trigger = triggerRef?.current || internalTriggerRef.current;
      if (!trigger) return;
      
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const pickerWidth = 240; // 5 emoji × 40px + padding
      const pickerHeight = 52; // Height of picker with emoji
      const safeMargin = 12;
      const minSpaceAbove = pickerHeight + 16; // Minimum space to show picker above
      
      // Calculate ideal left position (centered on the button)
      let idealLeft = rect.left + rect.width / 2 - pickerWidth / 2;
      
      // Clamp to viewport margins (horizontal)
      if (idealLeft < safeMargin) {
        idealLeft = safeMargin;
      } else if (idealLeft + pickerWidth > viewportWidth - safeMargin) {
        idealLeft = viewportWidth - pickerWidth - safeMargin;
      }
      
      // Calculate vertical space
      const spaceAbove = rect.top;
      const spaceBelow = viewportHeight - rect.bottom;
      
      // If not enough space above, flip to show below
      const showBelow = spaceAbove < minSpaceAbove && spaceBelow > minSpaceAbove;
      
      if (showBelow) {
        setPositionStyle({
          position: 'fixed',
          top: `${rect.bottom + 8}px`,
          left: `${idealLeft}px`,
          transform: 'none',
        });
      } else {
        setPositionStyle({
          position: 'fixed',
          bottom: `${viewportHeight - rect.top + 8}px`,
          left: `${idealLeft}px`,
          transform: 'none',
        });
      }
    }, [isOpen, triggerRef]);

    // Close on outside click (solo desktop, con delay per evitare ghost clicks)
    React.useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          onClose();
        }
      };

      // Delay maggiore per evitare chiusure accidentali su mobile
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 400);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen, onClose]);

    // Close on escape
    React.useEffect(() => {
      if (!isOpen) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);
    
    // Handler per lo shield: blocca chiusura durante interazione iniziale
    const handleShieldInteraction = React.useCallback((e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      // NON chiudere se:
      // 1. Siamo nella finestra di interazione iniziale (long-press release)
      if (isInteracting) {
        return;
      }
      
      const isTouchEnd = e.type === 'touchend';
      
      if (isTouchEnd) {
        // Per touchend, aspetta un frame prima di decidere
        // Questo evita che il rilascio del long-press chiuda il picker
        requestAnimationFrame(() => {
          if (!isInteracting) {
            onClose();
          }
        });
        return;
      }
      
      // Click mouse: chiudi immediatamente
      onClose();
    }, [isInteracting, onClose]);

    const handleSelect = (type: ReactionType) => {
      console.log('[ReactionPicker] handleSelect called with:', type);
      haptics.selection();
      console.log('[ReactionPicker] About to call onSelect');
      onSelect(type);
      console.log('[ReactionPicker] onSelect returned, calling onClose');
      onClose();
    };

    // If external triggerRef is not provided, render a wrapper to use as position reference
    // This is for backwards compatibility
    if (!triggerRef) {
      return (
        <>
          {/* Internal wrapper for position reference when triggerRef not provided */}
          <div ref={internalTriggerRef} className="absolute inset-0 pointer-events-none" />
          
          {isOpen && createPortal(
            <>
              {/* Invisible shield */}
              <div 
                className="fixed inset-0 z-[9998]" 
                onClick={handleShieldInteraction}
                onTouchEnd={handleShieldInteraction}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              />
              
              {/* Actual picker - pointer-events-auto ensures clickability above shield */}
              <div
                ref={containerRef}
                className={cn(
                  "z-[9999] pointer-events-auto flex items-center gap-1 px-2 py-1.5",
                  "bg-popover/95 backdrop-blur-xl border border-border/50",
                  "rounded-full shadow-2xl",
                  "animate-in fade-in-0 zoom-in-95 duration-200",
                  "max-w-[calc(100vw-24px)]",
                  className
                )}
                style={positionStyle}
              >
                {REACTIONS.map((reaction, index) => (
                  <button
                    key={reaction.type}
                    type="button"
                    onTouchStart={(e) => {
                      console.log('[ReactionPicker] Emoji touchstart:', reaction.type);
                    }}
                    onTouchEnd={(e) => {
                      console.log('[ReactionPicker] Emoji touchend:', reaction.type);
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(reaction.type);
                    }}
                    onClick={(e) => {
                      console.log('[ReactionPicker] Emoji click:', reaction.type);
                      e.stopPropagation();
                      handleSelect(reaction.type);
                    }}
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-full select-none cursor-pointer",
                      "transition-all duration-200 hover:scale-125 active:scale-110",
                      "animate-in fade-in-0 zoom-in-50",
                      currentReaction === reaction.type && "ring-2 ring-primary ring-offset-2 ring-offset-popover bg-primary/10"
                    )}
                    style={{
                      animationDelay: `${index * 30}ms`,
                      WebkitTapHighlightColor: 'transparent',
                    }}
                    aria-label={reaction.label}
                  >
                    <span className="text-2xl select-none pointer-events-none">{reaction.emoji}</span>
                  </button>
                ))}
              </div>
            </>,
            document.body
          )}
        </>
      );
    }

    // With external triggerRef - just render portal content
    if (!isOpen) return null;

    return createPortal(
      <>
        {/* Invisible shield */}
        <div 
          className="fixed inset-0 z-[9998]" 
          onClick={handleShieldInteraction}
          onTouchEnd={handleShieldInteraction}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        />
        
        {/* Actual picker - pointer-events-auto ensures clickability above shield */}
        <div
          ref={containerRef}
          className={cn(
            "z-[9999] pointer-events-auto flex items-center gap-1 px-2 py-1.5",
            "bg-popover/95 backdrop-blur-xl border border-border/50",
            "rounded-full shadow-2xl",
            "animate-in fade-in-0 zoom-in-95 duration-200",
            "max-w-[calc(100vw-24px)]",
            className
          )}
          style={positionStyle}
        >
          {REACTIONS.map((reaction, index) => (
            <button
              key={reaction.type}
              type="button"
              onTouchStart={(e) => {
                console.log('[ReactionPicker] Emoji touchstart:', reaction.type);
              }}
              onTouchEnd={(e) => {
                console.log('[ReactionPicker] Emoji touchend:', reaction.type);
                e.preventDefault();
                e.stopPropagation();
                handleSelect(reaction.type);
              }}
              onClick={(e) => {
                console.log('[ReactionPicker] Emoji click:', reaction.type);
                e.stopPropagation();
                handleSelect(reaction.type);
              }}
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full select-none cursor-pointer",
                "transition-all duration-200 hover:scale-125 active:scale-110",
                "animate-in fade-in-0 zoom-in-50",
                currentReaction === reaction.type && "ring-2 ring-primary ring-offset-2 ring-offset-popover bg-primary/10"
              )}
              style={{
                animationDelay: `${index * 30}ms`,
                WebkitTapHighlightColor: 'transparent',
              }}
              aria-label={reaction.label}
            >
              <span className="text-2xl select-none pointer-events-none">{reaction.emoji}</span>
            </button>
          ))}
        </div>
      </>,
      document.body
    );
  }
);

ReactionPicker.displayName = "ReactionPicker";

// Helper to map reaction type to emoji for display
export const reactionToEmoji = (type: ReactionType): string => {
  const reaction = REACTIONS.find(r => r.type === type);
  return reaction?.emoji || '❤️';
};

// Export reactions list for use elsewhere
export { REACTIONS };

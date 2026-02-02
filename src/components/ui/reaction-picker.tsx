import * as React from "react";
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
  className?: string;
}

export const ReactionPicker = React.forwardRef<HTMLDivElement, ReactionPickerProps>(
  ({ isOpen, onClose, onSelect, currentReaction, className }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    
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
    
    // Calculate safe position within viewport
    React.useEffect(() => {
      if (!isOpen || !wrapperRef.current) return;
      
      const wrapper = wrapperRef.current;
      const rect = wrapper.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const pickerWidth = 240; // 5 emoji × 40px + padding
      const safeMargin = 12;
      
      // Calculate ideal left position (centered on the button)
      let idealLeft = rect.left + rect.width / 2 - pickerWidth / 2;
      
      // Clamp to viewport margins
      if (idealLeft < safeMargin) {
        idealLeft = safeMargin;
      } else if (idealLeft + pickerWidth > viewportWidth - safeMargin) {
        idealLeft = viewportWidth - pickerWidth - safeMargin;
      }
      
      setPositionStyle({
        position: 'fixed',
        bottom: `${window.innerHeight - rect.top + 8}px`,
        left: `${idealLeft}px`,
        transform: 'none',
      });
    }, [isOpen]);

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

  if (!isOpen) return null;

  const handleSelect = (type: ReactionType) => {
    haptics.selection();
    onSelect(type);
    onClose();
  };

  return (
    <>
      {/* Invisible shield - blocca interazioni ma NON chiude su touch release iniziale */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={handleShieldInteraction}
        onTouchEnd={handleShieldInteraction}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      />
      
      {/* Wrapper for position calculation - relative to the button */}
      <div ref={wrapperRef} className="absolute inset-0 pointer-events-none" />
      
      {/* Actual picker - fixed position, viewport-aware */}
      <div
        ref={containerRef}
        className={cn(
          "z-50 flex items-center gap-1 px-2 py-1.5",
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
            // onTouchEnd per iOS: cattura il tap prima che propaghi
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSelect(reaction.type);
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleSelect(reaction.type);
            }}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-full select-none",
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
            <span className="text-2xl select-none">{reaction.emoji}</span>
          </button>
        ))}
      </div>
    </>
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

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
    
    // Stato per bloccare la chiusura immediata dopo l'apertura (fix iOS long-press release)
    const [isInteracting, setIsInteracting] = React.useState(false);
    
    // Reset interacting state quando il picker si apre
    React.useEffect(() => {
      if (isOpen) {
        setIsInteracting(true);
        const timer = setTimeout(() => setIsInteracting(false), 350);
        return () => clearTimeout(timer);
      }
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
    const handleShieldInteraction = (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      // Chiudi solo se non siamo nella fase iniziale di interazione
      if (!isInteracting) {
        onClose();
      }
    };

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
      
      {/* Actual picker - above shield */}
      <div
        ref={containerRef}
        className={cn(
          "absolute z-50 flex items-center gap-1 px-2 py-1.5",
          "bg-popover/95 backdrop-blur-xl border border-border/50",
          "rounded-full shadow-2xl",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          className
        )}
        style={{ bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px' }}
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
              "w-10 h-10 flex items-center justify-center rounded-full",
              "transition-all duration-200 hover:scale-125 active:scale-110",
              "animate-in fade-in-0 zoom-in-50",
              currentReaction === reaction.type && "ring-2 ring-primary ring-offset-2 ring-offset-popover bg-primary/10"
            )}
            style={{
              animationDelay: `${index * 30}ms`,
            }}
            aria-label={reaction.label}
          >
            <span className="text-2xl">{reaction.emoji}</span>
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

import { EyeOff, ArrowDown } from "lucide-react";

interface SwipeOverlayProps {
  isVisible: boolean;
  dragProgress: number;
  onHideContent: () => void;
}

export const SwipeOverlay = ({ isVisible, dragProgress, onHideContent }: SwipeOverlayProps) => {
  if (!isVisible) return null;

  const opacity = Math.min(dragProgress * 2, 1);
  
  return (
    <div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-surface-elevated/95 backdrop-blur-sm rounded-2xl z-20 transition-opacity duration-200"
      style={{ opacity }}
    >
      {/* Main action */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-semantic-error/20 rounded-full flex items-center justify-center mb-4">
          <EyeOff className="w-8 h-8 text-semantic-error" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          Nascondi questo contenuto
        </h3>
        <p className="text-sm text-text-secondary text-center max-w-xs">
          Non vedrai più contenuti simili a questo
        </p>
      </div>

      {/* Alternative action */}
      <div className="flex items-center gap-2 text-text-secondary">
        <ArrowDown className="w-4 h-4" />
        <span className="text-sm">
          Continua a scorrere per nascondere
        </span>
      </div>

      {/* Progress indicator */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
        <div className="w-32 h-1 bg-surface-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-semantic-error rounded-full transition-all duration-100"
            style={{ width: `${dragProgress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
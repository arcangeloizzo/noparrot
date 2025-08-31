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
      className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[30px] rounded-2xl z-20 transition-opacity duration-200"
      style={{ opacity }}
    >
      {/* iOS Action Sheet Style */}
      <div className="glass-elevated rounded-2xl p-6 mx-6 text-center">
        <div className="w-16 h-16 bg-semantic-error/15 rounded-full flex items-center justify-center mb-4 mx-auto">
          <EyeOff className="w-8 h-8 text-semantic-error stroke-[1.5px]" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          Nascondi questo contenuto
        </h3>
        <p className="text-sm text-white/70 leading-relaxed max-w-xs mx-auto">
          Non vedrai più contenuti simili a questo
        </p>
        
        {/* Alternative action */}
        <div className="flex items-center justify-center gap-2 text-white/60 mt-4">
          <ArrowDown className="w-4 h-4 stroke-[1.5px]" />
          <span className="text-sm font-medium">
            Continua a scorrere per nascondere
          </span>
        </div>
      </div>

      {/* Apple-style Progress indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
          <div 
            className="h-full bg-semantic-error rounded-full transition-all duration-100"
            style={{ width: `${dragProgress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
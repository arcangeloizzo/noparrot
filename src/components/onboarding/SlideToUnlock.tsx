import { useState, useRef, useCallback } from "react";
import { Lock, Check } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface SlideToUnlockProps {
  onUnlock: () => void;
  label?: string;
  className?: string;
}

export const SlideToUnlock = ({ 
  onUnlock, 
  label = "SCORRI PER ACCETTARE LA SFIDA",
  className 
}: SlideToUnlockProps) => {
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const thumbWidth = 56; // w-14 = 56px

  const getTrackWidth = useCallback(() => {
    if (!trackRef.current) return 300;
    return trackRef.current.offsetWidth - thumbWidth;
  }, []);

  const handleStart = useCallback((clientX: number) => {
    if (isUnlocked) return;
    setIsDragging(true);
    startXRef.current = clientX;
    haptics.light();
  }, [isUnlocked]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging || isUnlocked) return;
    
    const trackWidth = getTrackWidth();
    const deltaX = clientX - startXRef.current;
    const currentProgress = Math.max(0, Math.min(1, deltaX / trackWidth));
    
    setProgress(currentProgress);
    
    // Haptic feedback at milestones
    if (currentProgress >= 0.5 && progress < 0.5) {
      haptics.light();
    }
  }, [isDragging, isUnlocked, progress, getTrackWidth]);

  const handleEnd = useCallback(() => {
    if (!isDragging || isUnlocked) return;
    setIsDragging(false);
    
    if (progress >= 0.9) {
      // Unlock!
      setProgress(1);
      setIsUnlocked(true);
      haptics.success();
      
      // Delay callback for animation
      setTimeout(() => {
        onUnlock();
      }, 400);
    } else {
      // Spring back
      setProgress(0);
    }
  }, [isDragging, isUnlocked, progress, onUnlock]);

  // Pointer events
  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    handleStart(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    handleMove(e.clientX);
  };

  const onPointerUp = () => {
    handleEnd();
  };

  return (
    <div 
      ref={trackRef}
      className={cn(
        "relative w-full h-14 bg-white/5 rounded-full overflow-hidden border border-white/10",
        "select-none touch-none",
        className
      )}
    >
      {/* Progress fill */}
      <div 
        className={cn(
          "absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/40",
          "transition-opacity duration-200",
          isUnlocked ? "opacity-100" : "opacity-50"
        )}
        style={{ 
          width: `${progress * 100}%`,
          transition: isDragging ? 'none' : 'width 0.3s ease-out'
        }}
      />
      
      {/* Label */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center",
        "text-xs font-semibold tracking-widest text-white/40",
        "transition-opacity duration-300",
        progress > 0.3 ? "opacity-0" : "opacity-100"
      )}>
        {label} →
      </div>
      
      {/* Thumb */}
      <div
        className={cn(
          "absolute top-1 bottom-1 w-14 rounded-full",
          "flex items-center justify-center",
          "bg-primary shadow-lg shadow-primary/30",
          "cursor-grab active:cursor-grabbing",
          "transition-all duration-200",
          isUnlocked && "bg-green-500 shadow-green-500/30"
        )}
        style={{ 
          left: `${progress * (100 - (thumbWidth / (trackRef.current?.offsetWidth || 300) * 100))}%`,
          transition: isDragging ? 'none' : 'left 0.3s ease-out, background-color 0.3s ease'
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {isUnlocked ? (
          <Check className="w-6 h-6 text-white animate-scale-in" />
        ) : (
          <Lock className={cn(
            "w-5 h-5 text-white transition-transform duration-200",
            isDragging && "scale-90"
          )} />
        )}
      </div>
    </div>
  );
};

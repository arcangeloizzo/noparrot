import { useState, useRef, useCallback } from "react";
import { EyeOffIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface SwipeGestureHandlerProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
}

export const SwipeGestureHandler = ({ 
  children, 
  onSwipeLeft, 
  onSwipeRight, 
  onLongPress,
  disabled = false 
}: SwipeGestureHandlerProps) => {
  const [dragState, setDragState] = useState({
    isDragging: false,
    startX: 0,
    currentX: 0,
    direction: null as 'left' | 'right' | null
  });
  
  const longPressTimer = useRef<NodeJS.Timeout>();
  const elementRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    
    setDragState({
      isDragging: true,
      startX: e.clientX,
      currentX: e.clientX,
      direction: null
    });

    // Long press detection
    longPressTimer.current = setTimeout(() => {
      onLongPress?.();
      setDragState(prev => ({ ...prev, isDragging: false }));
    }, 600);

    // Capture pointer for smooth dragging
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [disabled, onLongPress]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.isDragging || disabled) return;

    const deltaX = e.clientX - dragState.startX;
    const direction = deltaX > 0 ? 'right' : 'left';
    
    setDragState(prev => ({
      ...prev,
      currentX: e.clientX,
      direction
    }));

    // Clear long press if we start dragging
    if (Math.abs(deltaX) > 10 && longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, [dragState.isDragging, dragState.startX, disabled]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragState.isDragging || disabled) return;

    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }

    const deltaX = e.clientX - dragState.startX;
    const threshold = window.innerWidth * 0.3; // 30% threshold
    
    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0) {
        onSwipeRight?.(); // Right swipe (hide)
      } else {
        onSwipeLeft?.(); // Left swipe (read)
      }
    }

    setDragState({
      isDragging: false,
      startX: 0,
      currentX: 0,
      direction: null
    });

    e.currentTarget.releasePointerCapture(e.pointerId);
  }, [dragState.isDragging, dragState.startX, onSwipeLeft, onSwipeRight, disabled]);

  // Calculate transform and opacity based on drag
  const deltaX = dragState.currentX - dragState.startX;
  const progress = Math.min(Math.abs(deltaX) / (window.innerWidth * 0.3), 1);
  const rotation = dragState.direction === 'right' ? progress * 2 : 0;
  const opacity = 1 - (progress * 0.15);

  return (
    <div className="relative">
      {/* Background hint for swipe */}
      {dragState.isDragging && dragState.direction === 'right' && (
        <div className="absolute inset-0 bg-red-50 flex items-center justify-center rounded-lg z-0">
          <div className="flex items-center space-x-2 text-gray-600">
            <EyeOffIcon className="w-5 h-5" />
            <span className="font-medium">Nascondi</span>
          </div>
        </div>
      )}
      
      {dragState.isDragging && dragState.direction === 'left' && (
        <div className="absolute inset-0 bg-blue-50 flex items-center justify-center rounded-lg z-0">
          <div className="flex items-center space-x-2 text-blue-600">
            <span className="font-medium">Leggi articolo</span>
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        ref={elementRef}
        className={cn("relative z-10 transition-transform", {
          "cursor-grab": !disabled,
          "cursor-grabbing": dragState.isDragging
        })}
        style={{
          transform: dragState.isDragging 
            ? `translateX(${deltaX}px) rotate(${rotation}deg)` 
            : undefined,
          opacity: dragState.isDragging ? opacity : 1,
          touchAction: "none" // Prevent scroll during horizontal drag
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {children}
      </div>
    </div>
  );
};
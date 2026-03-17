import React, { useRef, useState, forwardRef, useImperativeHandle, useCallback, createContext, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Context to share activeIndex with child cards without prop drilling
interface FeedContextValue {
  activeIndex: number;
}

const FeedContext = createContext<FeedContextValue>({ activeIndex: 0 });

export const useFeedContext = () => useContext(FeedContext);

interface ImmersiveFeedContainerProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void>;
  onActiveIndexChange?: (index: number) => void;
}

export interface ImmersiveFeedContainerRef {
  scrollToTop: () => void;
  getScrollPosition: () => number;
  scrollTo: (pos: number) => void;
  getActiveIndex: () => number;
  scrollToIndex: (index: number) => void;
}

export const ImmersiveFeedContainer = forwardRef<ImmersiveFeedContainerRef, ImmersiveFeedContainerProps>(({
  children,
  onRefresh,
  onActiveIndexChange
}, ref) => {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const pullDistance = useRef<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastReportedIndex = useRef<number>(-1);

  // RAF throttle ref for scroll handler
  const rafId = useRef<number | null>(null);

  // Track active index in state for context
  const [activeIndex, setActiveIndex] = useState(0);

  // Calculate active index
  const calculateActiveIndex = useCallback(() => {
    if (!containerRef.current) return 0;
    const { scrollTop, clientHeight } = containerRef.current;
    return Math.round(scrollTop / clientHeight);
  }, []);

  // Expose scroll methods to parent
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    },
    getScrollPosition: () => {
      return containerRef.current?.scrollTop ?? 0;
    },
    scrollTo: (pos: number) => {
      containerRef.current?.scrollTo({ top: pos });
    },
    getActiveIndex: calculateActiveIndex,
    scrollToIndex: (index: number) => {
      if (!containerRef.current) return;
      const { clientHeight } = containerRef.current;
      const targetPosition = index * clientHeight;
      containerRef.current.scrollTo({ top: targetPosition });
    }
  }));

  // Handle scroll to track active index - THROTTLED with RAF
  const handleScroll = useCallback(() => {
    // Skip if already have a RAF scheduled
    if (rafId.current !== null) return;

    rafId.current = requestAnimationFrame(() => {
      const currentIndex = calculateActiveIndex();
      if (currentIndex !== lastReportedIndex.current) {
        lastReportedIndex.current = currentIndex;
        setActiveIndex(currentIndex);
        onActiveIndexChange?.(currentIndex);
      }
      rafId.current = null;
    });
  }, [calculateActiveIndex, onActiveIndexChange]);

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current && containerRef.current && containerRef.current.scrollTop === 0) {
      const currentY = e.touches[0].clientY;
      pullDistance.current = currentY - touchStartY.current;
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance.current > 80 && !isRefreshing) {
      setIsRefreshing(true);
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      await queryClient.invalidateQueries({ queryKey: ['daily-focus'] });
      await queryClient.invalidateQueries({ queryKey: ['interest-focus'] });
      if (onRefresh) await onRefresh();
      setIsRefreshing(false);
    }
    touchStartY.current = 0;
    pullDistance.current = 0;
  };

  return (
    <FeedContext.Provider value={{ activeIndex }}>
      <div
        ref={containerRef} // touch-action-pan-y allows vertical scroll but prevents browser gestures like back/forward
        className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar overscroll-y-contain bg-background"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onScroll={handleScroll}
      >
        {/* Pull to refresh indicator */}
        {isRefreshing && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
          </div>
        )}

        {children}

        {/* Bottom gradient fade for navbar */}
        <div className="fixed bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-background to-transparent z-40 pointer-events-none" />
      </div>
    </FeedContext.Provider>
  );
});
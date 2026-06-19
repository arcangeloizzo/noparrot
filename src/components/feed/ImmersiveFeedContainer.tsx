import React, { useRef, useState, forwardRef, useImperativeHandle, useCallback, createContext, useContext, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Export OVERSCAN constant for easy tuning
// Reduced from 3 -> 1 to mount only 3 cards (1+1+1) instead of 7.
// Lowers mount/unmount churn + GC pressure during scroll.
export const OVERSCAN = 1;

// Context to share activeIndex with child cards without prop drilling
interface FeedContextValue {
  activeIndex: number;
}

const FeedContext = createContext<FeedContextValue>({ activeIndex: 0 });

export const useFeedContext = () => useContext(FeedContext);

interface ImmersiveFeedContainerProps {
  items?: any[];
  activeIndex?: number;
  onRefresh?: () => Promise<void>;
  onActiveIndexChange?: (index: number) => void;
  children: React.ReactNode | ((item: any, index: number) => React.ReactNode);
}

export interface ImmersiveFeedContainerRef {
  scrollToTop: () => void;
  getScrollPosition: () => number;
  scrollTo: (pos: number) => void;
  getActiveIndex: () => number;
  scrollToIndex: (index: number) => void;
}

export const ImmersiveFeedContainer = forwardRef<ImmersiveFeedContainerRef, ImmersiveFeedContainerProps>(({
  items = [],
  activeIndex = 0,
  onRefresh,
  onActiveIndexChange,
  children
}, ref) => {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const pullDistance = useRef<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastReportedIndex = useRef<number>(activeIndex);

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
    getActiveIndex: () => activeIndex,
    scrollToIndex: (index: number) => {
      if (!containerRef.current) return;
      const { clientHeight } = containerRef.current;
      const targetPosition = index * clientHeight;
      containerRef.current.scrollTo({ top: targetPosition });
    }
  }));

  // IntersectionObserver refs and logic
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const entryRatioMap = useRef<Map<number, number>>(new Map());

  // Setup observer whenever length changes
  useEffect(() => {
    if (!containerRef.current || items.length <= 1) return;

    const callback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        const targetIndex = (entry.target as any).__index;
        if (typeof targetIndex === 'number') {
          entryRatioMap.current.set(targetIndex, entry.intersectionRatio);
        }
      });

      // Find the index with the maximum ratio currently active
      let maxRatio = -1;
      let activeIdx = -1;

      entryRatioMap.current.forEach((ratio, index) => {
        if (index >= 0 && index < items.length) {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            activeIdx = index;
          }
        }
      });

      if (activeIdx !== -1 && activeIdx !== lastReportedIndex.current) {
        lastReportedIndex.current = activeIdx;
        onActiveIndexChange?.(activeIdx);
      }
    };

    const observer = new IntersectionObserver(callback, {
      root: containerRef.current,
      threshold: [0, 0.25, 0.5, 0.75, 1.0],
    });

    observerRef.current = observer;

    // Re-observe any elements currently in the map
    cardElementsRef.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [items.length, onActiveIndexChange]);

  // Clean-up elements map when items length decreases (e.g. posts removed)
  useEffect(() => {
    cardElementsRef.current.forEach((el, index) => {
      if (index >= items.length) {
        cardElementsRef.current.delete(index);
        entryRatioMap.current.delete(index);
      }
    });
  }, [items.length]);

  const registerCard = useCallback((el: HTMLDivElement | null, actualIndex: number) => {
    if (el) {
      (el as any).__index = actualIndex;
      cardElementsRef.current.set(actualIndex, el);
      observerRef.current?.observe(el);
    } else {
      const existing = cardElementsRef.current.get(actualIndex);
      if (existing) {
        observerRef.current?.unobserve(existing);
        cardElementsRef.current.delete(actualIndex);
        entryRatioMap.current.delete(actualIndex);
      }
    }
  }, []);

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

  // Determine slice of items to render
  const visibleStart = Math.max(0, activeIndex - OVERSCAN);
  const visibleEnd = Math.min(items.length - 1, activeIndex + OVERSCAN);

  const visibleItems = items.slice(visibleStart, visibleEnd + 1).map((item, i) => ({
    item,
    actualIndex: visibleStart + i,
  }));

  const renderContent = () => {
    if (items.length === 0) {
      return typeof children === 'function' ? null : children;
    }

    if (items.length === 1) {
      const singleItem = items[0];
      return (
        <div
          className="w-full snap-start shrink-0 overflow-hidden"
          style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
        >
          {typeof children === 'function' ? children(singleItem, 0) : children}
        </div>
      );
    }

    return (
      <div className="w-full flex flex-col">
        {items.map((item, actualIndex) => {
          const isVisible = actualIndex >= visibleStart && actualIndex <= visibleEnd;
          return (
            <div
              key={item.id ?? actualIndex}
              ref={(el) => registerCard(el, actualIndex)}
              style={{
                height: 'calc(var(--vh, 1vh) * 100)',
              }}
              className="w-full snap-start shrink-0 overflow-hidden relative"
            >
              {isVisible && typeof children === 'function' ? children(item, actualIndex) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <FeedContext.Provider value={{ activeIndex }}>
      <div
        ref={containerRef}
        data-tutorial="feed"
        className="w-full overflow-y-scroll snap-y snap-mandatory bg-background relative"
        style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull to refresh indicator */}
        {isRefreshing && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
          </div>
        )}

        {renderContent()}
      </div>
    </FeedContext.Provider>
  );
});
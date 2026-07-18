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

interface FeedWrapperProps {
  itemId: string;
  isVisible: boolean;
  isActive: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  children: React.ReactNode;
}

const FeedWrapper = React.memo(({ isVisible, registerRef, children }: FeedWrapperProps) => {
  return (
    <div
      ref={registerRef}
      style={{
        minHeight: 'calc(var(--vh, 1vh) * 100)',
        paddingBottom: '48px',
      }}
      className="w-full shrink-0 relative"
    >
      {isVisible ? children : null}
    </div>
  );
}, (prev, next) => {
  return prev.isVisible === next.isVisible && 
         prev.itemId === next.itemId && 
         prev.registerRef === next.registerRef &&
         prev.isActive === next.isActive &&
         prev.children === next.children;
});
FeedWrapper.displayName = 'FeedWrapper';

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
  const snapStartY = useRef(0);
  const snapStartTime = useRef(0);
  const snapStartScrollTop = useRef(0);
  const isAnimatingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
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
      const itemId = items[index]?.id;
      const el = itemId ? cardElementsRef.current.get(String(itemId)) : null;
      if (el) {
        el.scrollIntoView({ block: 'start' });
      } else {
        containerRef.current.scrollTo({ top: index * containerRef.current.clientHeight });
      }
    }
  }));

  // IntersectionObserver refs and logic
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const entryRatioMap = useRef<Map<string, number>>(new Map());
  const cardRefsMap = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());
  const registerCard = useCallback((el: HTMLDivElement | null, itemId: string) => {
    if (el) {
      (el as any).__itemId = itemId;
      cardElementsRef.current.set(itemId, el);
      observerRef.current?.observe(el);
    } else {
      const existing = cardElementsRef.current.get(itemId);
      if (existing) {
        observerRef.current?.unobserve(existing);
        cardElementsRef.current.delete(itemId);
        entryRatioMap.current.delete(itemId);
      }
    }
  }, []);

  const getCardRefCallback = (itemId: string) => {
    let cb = cardRefsMap.current.get(itemId);
    if (!cb) {
      cb = (el: HTMLDivElement | null) => {
        registerCard(el, itemId);
      };
      cardRefsMap.current.set(itemId, cb);
    }
    return cb;
  };

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const onActiveIndexChangeRef = useRef(onActiveIndexChange);
  onActiveIndexChangeRef.current = onActiveIndexChange;

  // Setup observer once at mount
  useEffect(() => {
    if (!containerRef.current) return;

    const callback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        const targetId = (entry.target as any).__itemId;
        if (typeof targetId === 'string') {
          entryRatioMap.current.set(targetId, entry.intersectionRatio);
        }
      });

      // Find the item ID with the maximum ratio currently active
      let maxRatio = -1;
      let activeItemId: string | null = null;

      entryRatioMap.current.forEach((ratio, id) => {
        if (ratio > maxRatio) {
          maxRatio = ratio;
          activeItemId = id;
        }
      });

      if (activeItemId) {
        const activeIdx = itemsRef.current.findIndex(item => item.id === activeItemId);
        if (activeIdx !== -1 && activeIdx !== lastReportedIndex.current) {
          lastReportedIndex.current = activeIdx;
          onActiveIndexChangeRef.current?.(activeIdx);
        }
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
      cardElementsRef.current.clear();
      entryRatioMap.current.clear();
      cardRefsMap.current.clear();
    };
  }, []);

  // Clean-up elements map when items are removed
  useEffect(() => {
    const itemIds = new Set(items.map(item => item.id));

    cardElementsRef.current.forEach((el, id) => {
      if (!itemIds.has(id)) {
        cardElementsRef.current.delete(id);
        entryRatioMap.current.delete(id);
        cardRefsMap.current.delete(id);
      }
    });
  }, [items]);

  // Touch-snapping JS + pull-to-refresh
  const TOPBAR = 56;
  const NAV_H = 88;
  const SWIPE_VELOCITY = 0.35;
  const SWIPE_DISTANCE = 60;
  const READ_EDGE = 24;

  const animateScrollTo = (targetTop: number, onDone?: () => void) => {
    const container = containerRef.current;
    if (!container) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    isAnimatingRef.current = true;
    const startTop = container.scrollTop;
    const dist = targetTop - startTop;
    const dur = Math.min(420, Math.max(180, Math.abs(dist) * 0.6));
    const t0 = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      container.scrollTop = startTop + dist * ease(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        isAnimatingRef.current = false;
        rafRef.current = null;
        onDone?.();
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const scrollTopForCardStart = (el: HTMLElement) => {
    const container = containerRef.current!;
    const rectTop = el.getBoundingClientRect().top;
    const contTop = container.getBoundingClientRect().top + TOPBAR;
    return container.scrollTop + (rectTop - contTop);
  };

  const scrollTopForCardEnd = (el: HTMLElement) => {
    const container = containerRef.current!;
    const rectBottom = el.getBoundingClientRect().bottom;
    const contBottom = container.getBoundingClientRect().top + container.clientHeight - NAV_H;
    return container.scrollTop + (rectBottom - contBottom);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
    const container = containerRef.current;
    if (!container) return;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); isAnimatingRef.current = false; }
    snapStartY.current = e.touches[0].clientY;
    snapStartTime.current = performance.now();
    snapStartScrollTop.current = container.scrollTop;
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
      touchStartY.current = 0;
      pullDistance.current = 0;
      return;
    }
    touchStartY.current = 0;
    pullDistance.current = 0;

    const container = containerRef.current;
    if (!container) return;

    const endTime = performance.now();
    const dt = Math.max(1, endTime - snapStartTime.current);
    const scrolled = container.scrollTop - snapStartScrollTop.current;
    const velocity = Math.abs(scrolled) / dt;
    const dir: 'down' | 'up' | 'none' =
      scrolled > 4 ? 'down' : scrolled < -4 ? 'up' : 'none';

    const activeId = items[activeIndex]?.id;
    const activeEl = activeId ? cardElementsRef.current.get(String(activeId)) : null;
    if (!activeEl) return;

    const vh = container.clientHeight;
    const isTall = activeEl.offsetHeight > vh - TOPBAR;
    const decided = velocity >= SWIPE_VELOCITY || Math.abs(scrolled) >= SWIPE_DISTANCE;

    if (isTall) {
      const startTop = scrollTopForCardStart(activeEl);
      const endTop = scrollTopForCardEnd(activeEl);
      const atStart = container.scrollTop <= startTop + READ_EDGE;
      const atEnd = container.scrollTop >= endTop - READ_EDGE;
      if (!atStart && !atEnd) {
        return;
      }
      if (!decided) {
        if (dir === 'down' && !atEnd) { animateScrollTo(endTop); return; }
        if (dir === 'up' && !atStart) { animateScrollTo(startTop); return; }
        animateScrollTo(atEnd ? endTop : startTop);
        return;
      }
    } else {
      if (!decided) { animateScrollTo(scrollTopForCardStart(activeEl)); return; }
    }

    let targetIndex = activeIndex;
    if (dir === 'down') targetIndex = Math.min(items.length - 1, activeIndex + 1);
    else if (dir === 'up') targetIndex = Math.max(0, activeIndex - 1);

    const targetId = items[targetIndex]?.id;
    const targetEl = targetId ? cardElementsRef.current.get(String(targetId)) : null;
    if (!targetEl) {
      animateScrollTo(scrollTopForCardStart(activeEl));
      return;
    }

    animateScrollTo(scrollTopForCardStart(targetEl), () => {
      if (targetIndex !== activeIndex) onActiveIndexChange?.(targetIndex);
    });
  };

  // Determine slice of items to render
  const visibleStart = Math.max(0, activeIndex - OVERSCAN);
  const visibleEnd = Math.min(items.length - 1, activeIndex + OVERSCAN);

  const renderContent = () => {
    if (items.length === 0) {
      return typeof children === 'function' ? null : children;
    }

    if (items.length === 1) {
      const singleItem = items[0];
      return (
        <div
          className="w-full snap-start shrink-0"
          style={{ minHeight: 'calc(var(--vh, 1vh) * 100)', scrollSnapStop: 'always' }}
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
            <FeedWrapper
              key={item.id ?? actualIndex}
              itemId={item.id}
              isVisible={isVisible}
              isActive={actualIndex === activeIndex}
              registerRef={getCardRefCallback(item.id)}
            >
              {typeof children === 'function' ? children(item, actualIndex) : null}
            </FeedWrapper>
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
        className="w-full overflow-y-scroll bg-background relative"
        style={{ 
          height: 'calc(var(--vh, 1vh) * 100)'
        }}
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
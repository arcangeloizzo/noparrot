import React, { useRef, useState, forwardRef, useImperativeHandle, useCallback, createContext, useContext, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";

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
        minHeight: '100%',
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastReportedIndex = useRef<number>(activeIndex);

  // TRIAL EMBLA: edge-swipe change-card refs
  const edgeTouchStartY = useRef(0);
  const edgeAtTopRef = useRef(false);
  const edgeAtBottomRef = useRef(false);

  // TRIAL EMBLA: vertical carousel with nested-scroll guard
  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: 'y',
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
    skipSnaps: false,
    duration: 22,
    watchDrag: (_emblaApi, evt) => {
      const target = evt.target as HTMLElement;
      const scroller = target?.closest?.('[data-slide-scroll="true"]') as HTMLElement | null;
      if (!scroller) return true;
      const canScrollInside = scroller.scrollHeight > scroller.clientHeight + 1;
      return !canScrollInside; // scrollable → native only; short → Embla drags
    },
  });

  // Expose scroll methods to parent
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      if (emblaApi) emblaApi.scrollTo(0);
      else containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    },
    getScrollPosition: () => {
      return containerRef.current?.scrollTop ?? 0;
    },
    scrollTo: (pos: number) => {
      containerRef.current?.scrollTo({ top: pos });
    },
    getActiveIndex: () => activeIndex,
    scrollToIndex: (index: number) => {
      if (emblaApi) {
        emblaApi.scrollTo(index);
        return;
      }
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
          // TRIAL EMBLA: silenziato, indice gestito da Embla select
          // onActiveIndexChangeRef.current?.(activeIdx);
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

  // TRIAL EMBLA: sync active index from Embla select/reInit
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap();
      if (idx !== lastReportedIndex.current) {
        lastReportedIndex.current = idx;
        onActiveIndexChangeRef.current?.(idx);
      }
    };
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    onSelect();
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi]);

  // TRIAL EMBLA: reInit when items count changes
  useEffect(() => {
    emblaApi?.reInit();
  }, [items.length, emblaApi]);

  // Pull-to-refresh touch handlers only
  const handleTouchStart = (e: React.TouchEvent) => {
    // TRIAL EMBLA: only when first slide + inner scroller at top
    if (emblaApi && emblaApi.selectedScrollSnap() === 0) {
      const firstScroller = containerRef.current?.querySelector<HTMLElement>('[data-slide-scroll="true"]');
      if (!firstScroller || firstScroller.scrollTop === 0) {
        touchStartY.current = e.touches[0].clientY;
      }
    }

    // TRIAL EMBLA: edge-swipe tracking on tall cards
    const t = e.target as HTMLElement;
    const sc = t?.closest?.('[data-slide-scroll="true"]') as HTMLElement | null;
    edgeTouchStartY.current = e.touches[0].clientY;
    if (sc && sc.scrollHeight > sc.clientHeight + 1) {
      edgeAtTopRef.current = sc.scrollTop <= 0;
      edgeAtBottomRef.current = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
    } else {
      edgeAtTopRef.current = false;
      edgeAtBottomRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current) {
      const currentY = e.touches[0].clientY;
      pullDistance.current = currentY - touchStartY.current;
    }
  };

  const handleTouchEnd = async (e: React.TouchEvent) => {
    if (pullDistance.current > 80 && !isRefreshing) {
      setIsRefreshing(true);
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      await queryClient.invalidateQueries({ queryKey: ['daily-focus'] });
      await queryClient.invalidateQueries({ queryKey: ['interest-focus'] });
      if (onRefresh) await onRefresh();
      setIsRefreshing(false);
    }

    // TRIAL EMBLA: edge-swipe → change card on tall content
    const endY = e.changedTouches?.[0]?.clientY ?? 0;
    const deltaY = edgeTouchStartY.current - endY; // >0 = finger up = wants next
    const SWIPE_MIN = 50;
    if (emblaApi) {
      if (edgeAtBottomRef.current && deltaY > SWIPE_MIN) emblaApi.scrollNext();
      else if (edgeAtTopRef.current && deltaY < -SWIPE_MIN) emblaApi.scrollPrev();
    }
    edgeAtTopRef.current = false;
    edgeAtBottomRef.current = false;

    touchStartY.current = 0;
    pullDistance.current = 0;
  };

  // Determine slice of items to render
  const visibleStart = Math.max(0, activeIndex - OVERSCAN);
  const visibleEnd = Math.min(items.length - 1, activeIndex + OVERSCAN);

  const renderContent = () => {
    if (items.length === 0) {
      return typeof children === 'function' ? null : children;
    }

    return (
      <div className="flex flex-col" style={{ height: '100%' }}>
        {items.map((item, actualIndex) => {
          const isVisible = actualIndex >= visibleStart && actualIndex <= visibleEnd;
          return (
            <div
              key={item.id ?? actualIndex}
              style={{
                flex: '0 0 var(--feed-viewport-h)',
                minHeight: 'var(--feed-viewport-h)',
                maxHeight: 'var(--feed-viewport-h)',
              }}
              className="w-full"
            >
              <div
                data-slide-scroll="true"
                className="no-scrollbar"
                style={{
                  height: '100%',
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <FeedWrapper
                  itemId={item.id}
                  isVisible={isVisible}
                  isActive={actualIndex === activeIndex}
                  registerRef={getCardRefCallback(item.id)}
                >
                  {typeof children === 'function' ? children(item, actualIndex) : null}
                </FeedWrapper>
              </div>
            </div>
          );
        })}
      </div>
    );
  };


  return (
    <FeedContext.Provider value={{ activeIndex }}>
      {/* Pull to refresh indicator (position:fixed → sibling of Embla viewport) */}
      {isRefreshing && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
        </div>
      )}
      <div
        ref={(node) => {
          containerRef.current = node;
          emblaRef(node);
        }}
        data-tutorial="feed"
        className="w-full bg-background relative overflow-hidden"
        style={{
          height: 'var(--feed-viewport-h)',
          marginTop: '56px',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {renderContent()}
      </div>
    </FeedContext.Provider>
  );
});
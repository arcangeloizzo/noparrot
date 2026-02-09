import { useState, useRef, useEffect, useCallback } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Media {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

interface MediaGalleryProps {
  media: Media[];
  onClick?: (media: Media, index: number) => void;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  className?: string; // Allow custom styling/constraints from parent
  fillHeight?: boolean; // New prop to force height filling
}

export const MediaGallery = ({ media, onClick, initialIndex = 0, onIndexChange, className, fillHeight }: MediaGalleryProps) => {
  if (!media || media.length === 0) return null;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMultiple = media.length > 1;

  // Sync with external initialIndex changes (e.g., from MediaViewer close)
  useEffect(() => {
    if (initialIndex !== currentIndex) {
      setCurrentIndex(initialIndex);
      scrollToIndex(initialIndex, false);
    }
  }, [initialIndex]);

  const scrollToIndex = useCallback((index: number, smooth = true) => {
    if (!scrollRef.current) return;
    const slideWidth = scrollRef.current.offsetWidth;
    scrollRef.current.scrollTo({
      left: index * slideWidth,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !isMultiple) return;

    const slideWidth = scrollRef.current.offsetWidth;
    const scrollLeft = scrollRef.current.scrollLeft;
    const newIndex = Math.round(scrollLeft / slideWidth);

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < media.length) {
      setCurrentIndex(newIndex);
      onIndexChange?.(newIndex);
    }
  }, [currentIndex, isMultiple, media.length, onIndexChange]);

  const handleMediaClick = (e: React.MouseEvent, item: Media, index: number) => {
    if (onClick) {
      e.stopPropagation();
      onClick(item, index);
    }
  };

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
    scrollToIndex(index);
    onIndexChange?.(index);
  };

  // Single media: simple display
  if (!isMultiple) {
    const item = media[0];
    return (
      <div className={cn("mt-3", fillHeight && "h-full mt-0")}>
        <div
          className={cn(
            "relative rounded-2xl overflow-hidden bg-muted",
            onClick && "cursor-pointer",
            fillHeight && "h-full"
          )}
          onClick={(e) => handleMediaClick(e, item, 0)}
        >
          {item.type === 'image' ? (
            <img
              src={item.url}
              alt=""
              className={cn(
                "w-full bg-black/40",
                fillHeight ? "h-full object-contain" : "aspect-auto object-contain"
              )}
              loading="lazy"
            />
          ) : (
            <div className={cn("relative", fillHeight ? "h-full w-full bg-black" : "aspect-video")}>
              <video
                src={item.url}
                poster={item.thumbnail_url}
                controls
                playsInline
                className={cn("w-full", fillHeight ? "h-full object-contain" : "aspect-video bg-black")}
                preload="metadata"
                onClick={(e) => e.stopPropagation()}
              >
                Il tuo browser non supporta il tag video.
              </video>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Multiple media: Carousel
  return (
    <div className={cn("mt-3 relative", className, fillHeight && "h-full mt-0 flex flex-col")}>
      {/* Counter badge */}
      <div className="absolute top-2 right-2 z-10 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full">
        {currentIndex + 1}/{media.length}
      </div>

      {/* Carousel container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          "flex overflow-x-auto snap-x snap-mandatory scrollbar-none rounded-2xl",
          fillHeight && "flex-1 min-h-0 w-full"
        )}
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {media.map((item, idx) => (
          <div
            key={item.id}
            className={cn(
              "flex-shrink-0 w-full snap-center",
              onClick && "cursor-pointer",
              fillHeight && "h-full flex items-center justify-center bg-black/20"
            )}
            onClick={(e) => handleMediaClick(e, item, idx)}
          >
            {item.type === 'image' ? (
              <img
                src={item.url}
                alt=""
                className={cn(
                  "w-full bg-black/40",
                  fillHeight ? "h-full object-contain" : "aspect-auto object-contain"
                )}
                loading={idx <= 1 ? 'eager' : 'lazy'}
              />
            ) : (
              <div className={cn("relative bg-black", fillHeight ? "h-full w-full" : "aspect-video")}>
                <video
                  src={item.url}
                  poster={item.thumbnail_url}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                  preload="metadata"
                  onClick={(e) => e.stopPropagation()}
                >
                  Il tuo browser non supporta il tag video.
                </video>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dots indicator */}
      <div className={cn(
        "flex justify-center gap-1.5",
        fillHeight ? "shrink-0 py-2" : "mt-2"
      )}>
        {media.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleDotClick(idx)}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-200 shadow-sm",
              idx === currentIndex
                ? "bg-white w-4 scale-110"
                : "bg-white/40 hover:bg-white/60 backdrop-blur-[1px]"
            )}
            aria-label={`Vai a media ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

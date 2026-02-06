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
  /** Optional max-height class for images (e.g., "max-h-[25vh]") - only applied when overflow is detected */
  imageMaxHeightClass?: string;
}

export const MediaGallery = ({ media, onClick, initialIndex = 0, onIndexChange, imageMaxHeightClass }: MediaGalleryProps) => {
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
      <div className="mt-3">
        <div 
          className={cn(
            "relative rounded-2xl overflow-hidden bg-muted",
            onClick && "cursor-pointer"
          )}
          onClick={(e) => handleMediaClick(e, item, 0)}
        >
          {item.type === 'image' ? (
            <img
              src={item.url}
              alt=""
              className={cn(
                "w-full aspect-auto object-contain bg-black/40",
                imageMaxHeightClass
              )}
              loading="lazy"
            />
          ) : (
            <div className="relative">
              <video
                src={item.url}
                poster={item.thumbnail_url}
                controls
                playsInline
                className="w-full aspect-video bg-black"
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
    <div className="mt-3 relative">
      {/* Counter badge */}
      <div className="absolute top-2 right-2 z-10 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full">
        {currentIndex + 1}/{media.length}
      </div>

      {/* Carousel container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none rounded-2xl"
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
              onClick && "cursor-pointer"
            )}
            onClick={(e) => handleMediaClick(e, item, idx)}
          >
            {item.type === 'image' ? (
              <img
                src={item.url}
                alt=""
                className={cn(
                  "w-full aspect-auto object-contain bg-black/40",
                  imageMaxHeightClass
                )}
                loading={idx <= 1 ? 'eager' : 'lazy'}
              />
            ) : (
              <div className="relative aspect-video bg-black">
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
      <div className="flex justify-center gap-1.5 mt-2">
        {media.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleDotClick(idx)}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-200",
              idx === currentIndex 
                ? "bg-primary w-4" 
                : "bg-muted-foreground/40 hover:bg-muted-foreground/60"
            )}
            aria-label={`Vai a media ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

import { useState, useRef, useEffect, memo } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ProgressiveImageProps {
  src: string | undefined;
  alt?: string;
  dominantColor?: string;
  shouldLoad?: boolean;
  className?: string;
  /** Called when hero image loads */
  onLoad?: () => void;
}

type LoadState = 'placeholder' | 'thumb' | 'hero';

/**
 * ProgressiveImage - 3-stage image loading for perceived performance
 * 
 * Stage 1: Colored placeholder (instant)
 * Stage 2: Thumbnail (blur effect applied externally only when shouldLoad)
 * Stage 3: Full hero image with fade-in
 * 
 * Performance optimizations:
 * - Only requests network when shouldLoad=true
 * - Maintains last loaded state to prevent flicker during fast scrolling
 * - Uses single <img> to avoid double download
 */
export const ProgressiveImage = memo(function ProgressiveImage({
  src,
  alt = '',
  dominantColor = '#1F3347',
  shouldLoad = true,
  className,
  onLoad
}: ProgressiveImageProps) {
  const [loadState, setLoadState] = useState<LoadState>('placeholder');
  const [hasError, setHasError] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const currentSrcRef = useRef<string | undefined>(undefined);

  // Reset state when src changes
  useEffect(() => {
    if (currentSrcRef.current !== src) {
      currentSrcRef.current = src;
      // Only reset to placeholder if we haven't loaded this image before
      if (!hasLoadedOnceRef.current) {
        setLoadState('placeholder');
        setHasError(false);
      }
    }
  }, [src]);

  // If no src or error, just show placeholder
  if (!src || hasError) {
    return (
      <div 
        className={cn("w-full h-full", className)} 
        style={{ background: dominantColor }} 
      />
    );
  }

  // If shouldn't load yet, show placeholder but keep any previous state
  if (!shouldLoad && !hasLoadedOnceRef.current) {
    return (
      <div 
        className={cn("w-full h-full", className)} 
        style={{ background: dominantColor }} 
      />
    );
  }

  const handleLoad = () => {
    hasLoadedOnceRef.current = true;
    // Jump straight to hero (no thumb stage for now - can add later with srcset)
    setLoadState('hero');
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
  };

  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      {/* Stage 1: Colored placeholder - always visible initially */}
      <div 
        className="absolute inset-0 transition-opacity duration-300"
        style={{ 
          background: dominantColor,
          opacity: loadState === 'placeholder' ? 1 : 0
        }} 
      />
      
      {/* Skeleton overlay while loading */}
      {loadState === 'placeholder' && shouldLoad && (
        <Skeleton className="absolute inset-0 bg-white/5" />
      )}
      
      {/* Hero image - only render when shouldLoad is true */}
      {shouldLoad && (
        <img 
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
            loadState === 'hero' ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}
    </div>
  );
});

export default ProgressiveImage;

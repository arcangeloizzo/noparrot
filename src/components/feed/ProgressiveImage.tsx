import { useState, useRef, useEffect, memo, useMemo } from 'react';
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
  /** If true, use eager loading for cards in or near viewport */
  priority?: boolean;
  /** When set, requests a small square-cover thumbnail from Supabase Storage
   *  sized for the visual dimension (in CSS px). Used for avatars and other
   *  small circular images to avoid loading 600px hero variants. */
  sizePx?: number;
}

type LoadState = 'placeholder' | 'thumb' | 'hero';

/**
 * Optimize Supabase Storage URLs with transformation parameters
 * Reduces bandwidth by ~40-60% on mobile
 */
const getOptimizedSrc = (
  src: string | undefined,
  sizePx?: number
): string | undefined => {
  if (!src) return undefined;
  
  // Detect Supabase Storage URLs
  const isSupabaseStorage = src.includes('.supabase.co/storage/') || 
                            src.includes('supabase.co/storage/');
  
  if (!isSupabaseStorage) return src; // External links unchanged
  
  // Check if already has transformation params
  if (src.includes('?') && (src.includes('width=') || src.includes('resize='))) {
    return src;
  }
  
  const separator = src.includes('?') ? '&' : '?';

  // Small square avatars/thumbs: cover crop at 2× for retina.
  if (sizePx && sizePx > 0) {
    const px = Math.round(sizePx * 2);
    return `${src}${separator}width=${px}&height=${px}&resize=cover&quality=70`;
  }

  // Default: hero variant for feed cards.
  return `${src}${separator}width=600&resize=contain&quality=75`;
};

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
 * - Automatically optimizes Supabase Storage URLs
 */
export const ProgressiveImage = memo(function ProgressiveImage({
  src,
  alt = '',
  dominantColor = '#1F3347',
  shouldLoad = true,
  className,
  onLoad,
  priority = false,
  sizePx,
}: ProgressiveImageProps) {
  // Optimize src for Supabase Storage
  const optimizedSrc = useMemo(() => getOptimizedSrc(src, sizePx), [src, sizePx]);
  const pixelSize = sizePx && sizePx > 0 ? Math.round(sizePx * 2) : 1200;
  
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
      
      {/* Hero image - only render when shouldLoad is true, uses optimized URL */}
      {shouldLoad && (
        <img 
          src={optimizedSrc}
          alt={alt}
          width={pixelSize}
          height={pixelSize}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "absolute inset-0 w-full h-full object-cover",
            loadState === 'placeholder' ? 'opacity-0' : 'opacity-100'
          )}
        />
      )}
    </div>
  );
});

export default ProgressiveImage;

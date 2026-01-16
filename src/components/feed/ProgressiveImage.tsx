/**
 * ProgressiveImage - Optimized image component for feed cards
 * 
 * Features:
 * - Fixed aspect-ratio container (no layout shift)
 * - shouldLoad prop gates ALL network requests
 * - Loads thumbnail first (480px) only when shouldLoad=true
 * - Upgrades to hero (1080px) only when isActive=true
 * - loading="lazy" and decoding="async"
 * - Blur applied ONLY when active and loaded
 */

import { useState, useEffect, useRef, memo } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  getThumbUrl,
  getHeroUrl,
  isImageCached,
  markImageLoaded,
  markImageError,
} from '@/lib/imageCache';

interface ProgressiveImageProps {
  src: string | undefined | null;
  alt?: string;
  /** Whether this card should load images (within active window) */
  shouldLoad?: boolean;
  /** Whether this card is currently active/visible */
  isActive?: boolean;
  /** CSS classes for the container */
  className?: string;
  /** CSS classes for the image */
  imageClassName?: string;
  /** Aspect ratio (default: 16/9 for video-like content) */
  aspectRatio?: 'video' | 'square' | 'portrait' | 'auto';
  /** Whether to use as background (cover, optional blur) */
  asBackground?: boolean;
  /** Callback when image loads */
  onLoad?: () => void;
  /** Callback when image fails */
  onError?: () => void;
}

const aspectRatioClasses = {
  video: 'aspect-video',
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  auto: '', // No fixed aspect
};

// DEV email allowlist for debug badge
const isDevEmail = (email?: string) => {
  if (!email) return false;
  return email.startsWith('ark@') || email.startsWith('test@') || email.startsWith('dev@');
};

const ProgressiveImageInner = ({
  src,
  alt = '',
  shouldLoad = false,
  isActive = false,
  className,
  imageClassName,
  aspectRatio = 'video',
  asBackground = false,
  onLoad,
  onError,
}: ProgressiveImageProps) => {
  const [loadState, setLoadState] = useState<'placeholder' | 'thumb' | 'hero' | 'error'>('placeholder');
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const { user } = useAuth();

  // Get optimized URLs
  const thumbUrl = getThumbUrl(src);
  const heroUrl = getHeroUrl(src);

  // Load thumbnail ONLY when shouldLoad is true
  useEffect(() => {
    mountedRef.current = true;
    
    // If shouldLoad is false, stay in placeholder state - NO network request
    if (!shouldLoad) {
      return;
    }
    
    if (!src || !thumbUrl) {
      setLoadState('error');
      onError?.();
      return;
    }

    // Check cache first
    if (isImageCached(src, 'thumb')) {
      setCurrentSrc(thumbUrl);
      setLoadState('thumb');
      return;
    }

    // Load thumbnail
    const img = new Image();
    img.decoding = 'async';
    
    img.onload = () => {
      if (!mountedRef.current) return;
      markImageLoaded(src, 'thumb');
      setCurrentSrc(thumbUrl);
      setLoadState('thumb');
    };
    
    img.onerror = () => {
      if (!mountedRef.current) return;
      markImageError(src, 'thumb');
      setLoadState('error');
      onError?.();
    };
    
    img.src = thumbUrl;

    return () => {
      mountedRef.current = false;
    };
  }, [src, thumbUrl, shouldLoad, onError]);

  // Upgrade to hero when active AND thumb is loaded
  useEffect(() => {
    if (!isActive || loadState !== 'thumb' || !src || !heroUrl) return;
    
    // Skip if hero is same as thumb
    if (heroUrl === thumbUrl) {
      setLoadState('hero');
      onLoad?.();
      return;
    }

    // Check cache
    if (isImageCached(src, 'hero')) {
      setCurrentSrc(heroUrl);
      setLoadState('hero');
      onLoad?.();
      return;
    }

    // Load hero
    const img = new Image();
    img.decoding = 'async';
    
    img.onload = () => {
      if (!mountedRef.current) return;
      markImageLoaded(src, 'hero');
      setCurrentSrc(heroUrl);
      setLoadState('hero');
      onLoad?.();
    };
    
    img.onerror = () => {
      // Keep thumb if hero fails
      if (!mountedRef.current) return;
      markImageError(src, 'hero');
      // Still call onLoad since thumb is working
      onLoad?.();
    };
    
    img.src = heroUrl;
  }, [isActive, loadState, src, heroUrl, thumbUrl, onLoad]);

  // Render
  if (loadState === 'error' && shouldLoad) {
    return null;
  }

  const containerClasses = cn(
    'relative overflow-hidden',
    aspectRatioClasses[aspectRatio],
    asBackground && 'absolute inset-0',
    className
  );

  // Apply blur ONLY when active AND loaded (not during placeholder/loading)
  const shouldBlur = asBackground && isActive && loadState !== 'placeholder';

  const imgClasses = cn(
    'w-full h-full object-cover transition-opacity duration-300',
    loadState === 'placeholder' && 'opacity-0',
    loadState === 'thumb' && 'opacity-90',
    loadState === 'hero' && 'opacity-100',
    shouldBlur && 'blur-lg scale-105',
    imageClassName
  );

  // DEV badge - show image load state
  const showDevBadge = isDevEmail(user?.email);

  return (
    <div className={containerClasses}>
      {/* Placeholder - solid color matching dark theme */}
      {loadState === 'placeholder' && (
        <div className="absolute inset-0 bg-white/5" />
      )}
      
      {/* Image - only render if we have a src and should load */}
      {currentSrc && shouldLoad && (
        <img
          src={currentSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={imgClasses}
        />
      )}

      {/* DEV Badge - top-right, shows state */}
      {showDevBadge && (
        <div className="absolute top-2 right-2 z-50 px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/70 text-white/80 pointer-events-none">
          {loadState}/{shouldLoad ? 'load' : 'skip'}
        </div>
      )}
    </div>
  );
};

export const ProgressiveImage = memo(ProgressiveImageInner);
ProgressiveImage.displayName = 'ProgressiveImage';

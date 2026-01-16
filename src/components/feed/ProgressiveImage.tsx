/**
 * ProgressiveImage - Optimized image component for feed cards
 * 
 * Features:
 * - Fixed aspect-ratio container (no layout shift)
 * - shouldLoad prop gates ALL network requests
 * - Loads thumbnail first (480px) only when shouldLoad=true
 * - NO hero upgrade for backgrounds (avoids flash)
 * - NO blur on backgrounds (avoids iOS GPU jank) - uses gradient overlay instead
 * - loading="lazy" and decoding="async"
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
  /** Whether to use as background (cover, NO blur, NO hero upgrade) */
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
  // Use ref to track previous shouldLoad to avoid thrashing
  const prevShouldLoadRef = useRef(shouldLoad);
  const hasLoadedOnceRef = useRef(false);
  
  const [loadState, setLoadState] = useState<'placeholder' | 'thumb' | 'hero' | 'error'>('placeholder');
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const { user } = useAuth();

  // Get optimized URLs
  const thumbUrl = getThumbUrl(src);
  const heroUrl = getHeroUrl(src);

  // Once loaded, don't reset - avoid thrashing during scroll
  useEffect(() => {
    if (shouldLoad && !prevShouldLoadRef.current) {
      prevShouldLoadRef.current = true;
    }
  }, [shouldLoad]);

  // Effective shouldLoad: once loaded, stay loaded
  const effectiveShouldLoad = shouldLoad || hasLoadedOnceRef.current;

  // Load thumbnail ONLY when shouldLoad is true
  useEffect(() => {
    mountedRef.current = true;
    
    // If shouldLoad is false and never loaded before, stay in placeholder - NO network request
    if (!effectiveShouldLoad) {
      return;
    }
    
    if (!src || !thumbUrl) {
      setLoadState('error');
      onError?.();
      return;
    }

    // Mark that we've loaded once
    hasLoadedOnceRef.current = true;

    // Check cache first
    if (isImageCached(src, 'thumb')) {
      setCurrentSrc(thumbUrl);
      setLoadState('thumb');
      onLoad?.();
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
      onLoad?.();
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
  }, [src, thumbUrl, effectiveShouldLoad, onError, onLoad]);

  // Upgrade to hero ONLY when active AND thumb is loaded AND NOT background
  // Background images stay at thumb to avoid flash and GPU pressure
  useEffect(() => {
    // Skip hero upgrade for backgrounds entirely
    if (asBackground) return;
    if (!isActive || loadState !== 'thumb' || !src || !heroUrl) return;
    
    // Skip if hero is same as thumb
    if (heroUrl === thumbUrl) {
      setLoadState('hero');
      return;
    }

    // Check cache
    if (isImageCached(src, 'hero')) {
      setCurrentSrc(heroUrl);
      setLoadState('hero');
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
    };
    
    img.onerror = () => {
      // Keep thumb if hero fails
      if (!mountedRef.current) return;
      markImageError(src, 'hero');
    };
    
    img.src = heroUrl;
  }, [isActive, loadState, src, heroUrl, thumbUrl, asBackground]);

  // Render
  if (loadState === 'error' && effectiveShouldLoad) {
    return null;
  }

  const containerClasses = cn(
    'relative overflow-hidden',
    aspectRatioClasses[aspectRatio],
    asBackground && 'absolute inset-0',
    className
  );

  // NO blur for backgrounds - use gradient overlay instead (set by parent)
  // This eliminates iOS GPU jank from blur-lg/blur-2xl
  const imgClasses = cn(
    'w-full h-full object-cover transition-opacity duration-300',
    loadState === 'placeholder' && 'opacity-0',
    // Fade in to 100% - no intermediate states to avoid flash
    (loadState === 'thumb' || loadState === 'hero') && 'opacity-100',
    // Only scale for background, no blur
    asBackground && 'scale-105',
    imageClassName
  );

  // DEV badge - show image load state and feed index info
  const showDevBadge = isDevEmail(user?.email);

  return (
    <div className={containerClasses}>
      {/* Placeholder - solid color matching dark theme */}
      {loadState === 'placeholder' && (
        <div className="absolute inset-0 bg-white/5" />
      )}
      
      {/* Image - only render if we have a src and should load (or have loaded once) */}
      {currentSrc && effectiveShouldLoad && (
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
          {loadState}/{effectiveShouldLoad ? 'load' : 'skip'}
        </div>
      )}
    </div>
  );
};

export const ProgressiveImage = memo(ProgressiveImageInner);
ProgressiveImage.displayName = 'ProgressiveImage';

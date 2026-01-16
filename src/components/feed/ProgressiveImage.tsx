/**
 * ProgressiveImage - Optimized image component for feed cards
 * 
 * Features:
 * - Fixed aspect-ratio container (no layout shift)
 * - Lightweight placeholder shown immediately
 * - Loads thumbnail first (480px)
 * - Upgrades to hero (1080px) only when isActive=true
 * - loading="lazy" and decoding="async"
 * - No heavy blur/backdrop until loaded
 */

import { useState, useEffect, useRef, memo } from 'react';
import { cn } from '@/lib/utils';
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
  /** Whether this card is currently active/visible */
  isActive?: boolean;
  /** CSS classes for the container */
  className?: string;
  /** CSS classes for the image */
  imageClassName?: string;
  /** Aspect ratio (default: 16/9 for video-like content) */
  aspectRatio?: 'video' | 'square' | 'portrait' | 'auto';
  /** Whether to use as background (blurred, cover) */
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

const ProgressiveImageInner = ({
  src,
  alt = '',
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

  // Get optimized URLs
  const thumbUrl = getThumbUrl(src);
  const heroUrl = getHeroUrl(src);

  // Load thumbnail on mount
  useEffect(() => {
    mountedRef.current = true;
    
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
  }, [src, thumbUrl, onError]);

  // Upgrade to hero when active
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
  if (loadState === 'error' || !src) {
    return null;
  }

  const containerClasses = cn(
    'relative overflow-hidden',
    aspectRatioClasses[aspectRatio],
    asBackground && 'absolute inset-0',
    className
  );

  const imgClasses = cn(
    'w-full h-full object-cover transition-opacity duration-300',
    loadState === 'placeholder' && 'opacity-0',
    loadState === 'thumb' && 'opacity-90',
    loadState === 'hero' && 'opacity-100',
    asBackground && 'blur-2xl scale-110',
    imageClassName
  );

  return (
    <div className={containerClasses}>
      {/* Placeholder - solid color matching dark theme */}
      {loadState === 'placeholder' && (
        <div className="absolute inset-0 bg-white/5 animate-pulse" />
      )}
      
      {/* Image */}
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={imgClasses}
        />
      )}
    </div>
  );
};

export const ProgressiveImage = memo(ProgressiveImageInner);
ProgressiveImage.displayName = 'ProgressiveImage';

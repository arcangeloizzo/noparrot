/**
 * Image Cache & Progressive Loading System
 * 
 * - In-memory cache to avoid reloading images during session
 * - Thumbnail-first progressive loading (480px -> 1080px hero)
 * - Prefetch support for next card only
 */

type ImageSize = 'thumb' | 'hero';
type LoadState = 'loading' | 'loaded' | 'error';

interface CacheEntry {
  thumb: LoadState;
  hero: LoadState;
  thumbUrl?: string;
  heroUrl?: string;
}

// Session-local image cache (persists until page refresh)
const imageCache = new Map<string, CacheEntry>();

// Preloaded images (avoid GC)
const preloadedImages = new Map<string, HTMLImageElement>();

/**
 * Get cache-safe thumbnail URL (480w max)
 * For external images, returns original with size hint param
 * For Supabase storage, uses transform API
 */
export const getThumbUrl = (originalUrl: string | undefined | null): string | null => {
  if (!originalUrl) return null;
  
  // YouTube thumbnails - use sddefault (480px)
  if (originalUrl.includes('img.youtube.com') || originalUrl.includes('ytimg.com')) {
    return originalUrl
      .replace('/maxresdefault.jpg', '/sddefault.jpg')
      .replace('/hqdefault.jpg', '/sddefault.jpg');
  }
  
  // Supabase Storage - use transform (if supported)
  if (originalUrl.includes('supabase.co/storage')) {
    const separator = originalUrl.includes('?') ? '&' : '?';
    return `${originalUrl}${separator}width=480&quality=75`;
  }
  
  // Lovable/imgproxy support (hypothetical)
  // For now, return original - browser will downscale
  return originalUrl;
};

/**
 * Get hero-sized URL (1080w max)
 */
export const getHeroUrl = (originalUrl: string | undefined | null): string | null => {
  if (!originalUrl) return null;
  
  // YouTube - use maxresdefault
  if (originalUrl.includes('img.youtube.com') || originalUrl.includes('ytimg.com')) {
    return originalUrl
      .replace('/sddefault.jpg', '/maxresdefault.jpg')
      .replace('/hqdefault.jpg', '/maxresdefault.jpg');
  }
  
  // Supabase Storage
  if (originalUrl.includes('supabase.co/storage')) {
    const separator = originalUrl.includes('?') ? '&' : '?';
    return `${originalUrl}${separator}width=1080&quality=85`;
  }
  
  return originalUrl;
};

/**
 * Check if image is already cached
 */
export const isImageCached = (url: string, size: ImageSize = 'thumb'): boolean => {
  const entry = imageCache.get(url);
  if (!entry) return false;
  return size === 'thumb' ? entry.thumb === 'loaded' : entry.hero === 'loaded';
};

/**
 * Mark image as loaded in cache
 */
export const markImageLoaded = (url: string, size: ImageSize): void => {
  const entry = imageCache.get(url) || { thumb: 'loading', hero: 'loading' };
  entry[size] = 'loaded';
  if (size === 'thumb') entry.thumbUrl = getThumbUrl(url) || url;
  if (size === 'hero') entry.heroUrl = getHeroUrl(url) || url;
  imageCache.set(url, entry);
};

/**
 * Mark image as failed
 */
export const markImageError = (url: string, size: ImageSize): void => {
  const entry = imageCache.get(url) || { thumb: 'loading', hero: 'loading' };
  entry[size] = 'error';
  imageCache.set(url, entry);
};

/**
 * Prefetch a single image (stores in cache to avoid GC)
 * Used to prefetch ONLY the next card's image
 */
export const prefetchImage = (url: string | undefined | null, size: ImageSize = 'thumb'): void => {
  if (!url) return;
  
  // Skip if already cached
  if (isImageCached(url, size)) return;
  
  const finalUrl = size === 'thumb' ? getThumbUrl(url) : getHeroUrl(url);
  if (!finalUrl) return;
  
  const cacheKey = `${url}_${size}`;
  
  // Skip if already prefetching
  if (preloadedImages.has(cacheKey)) return;
  
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  
  img.onload = () => {
    markImageLoaded(url, size);
  };
  
  img.onerror = () => {
    markImageError(url, size);
    preloadedImages.delete(cacheKey);
  };
  
  img.src = finalUrl;
  preloadedImages.set(cacheKey, img);
};

/**
 * Get cache state for debugging
 */
export const getCacheStats = () => ({
  cacheSize: imageCache.size,
  preloadedSize: preloadedImages.size,
});

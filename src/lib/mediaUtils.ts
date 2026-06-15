import type { UnifiedMedia } from '@/types/media';
import { getWordCount } from '@/lib/gate-utils';
import type { Post } from '@/hooks/usePosts';

const RATIO_TARGETS = [
  { ratio: '9:16' as const, value: 9 / 16 },   // 0.5625, portrait
  { ratio: '3:4' as const,  value: 3 / 4 },    // 0.75,   portrait
  { ratio: '1:1' as const,  value: 1 },        // 1.0,    square
  { ratio: '4:3' as const,  value: 4 / 3 },    // 1.333,  landscape
  { ratio: '3:2' as const,  value: 3 / 2 },    // 1.5,    landscape
  { ratio: '16:9' as const, value: 16 / 9 },   // 1.7778, landscape
];

function ratioToOrientation(ratio: string): 'portrait' | 'square' | 'landscape' {
  if (ratio === '9:16' || ratio === '3:4') return 'portrait';
  if (ratio === '1:1') return 'square';
  return 'landscape'; // '4:3', '3:2', '16:9'
}

/**
 * Spec §M2: clamp the actual width/height ratio to the nearest of 9:16, 3:4, 1:1, 16:9.
 * Lineare absolute distance — sufficient for the target points.
 *
 * Edge case: width/height = 0 or NaN → fallback to 1:1 square.
 */
export function classifyOrientation(
  width: number,
  height: number
): { ratio: UnifiedMedia['ratio']; orientation: UnifiedMedia['orientation'] } {
  if (!width || !height || !isFinite(width / height)) {
    return { ratio: '1:1', orientation: 'square' };
  }
  const r = width / height;
  let best = RATIO_TARGETS[2]; // 1:1 default
  let minDiff = Infinity;
  for (const t of RATIO_TARGETS) {
    const diff = Math.abs(r - t.value);
    if (diff < minDiff) {
      minDiff = diff;
      best = t;
    }
  }
  return { 
    ratio: best.ratio, 
    orientation: ratioToOrientation(best.ratio) 
  };
}

/**
 * Genera URL ambient_src downscale per AmbientLayer §S2.
 *
 * - Per immagini Supabase Storage (bucket pubblico): usa Image Transform `?width=200&quality=40`.
 * - Per video: ritorna null o fallback.
 * - Per YouTube/Spotify/altre fonti: handled separatamente.
 */
export function generateAmbientUrl(
  src: string,
  kind: 'image' | 'video' | 'audio-cover'
): string {
  if (!src) return src;

  // Supabase Storage public bucket — usa Image Transform
  if (src.includes('/storage/v1/object/public/')) {
    const url = new URL(src);
    if (kind === 'image' || kind === 'audio-cover') {
      url.searchParams.set('width', '200');
      url.searchParams.set('quality', '40');
      return url.toString();
    }
  }

  return src;
}

import type { MediaFrameVariant } from '@/components/shared/MediaFrame';

/**
 * Spec v1.1 §5.1 matrice — decide variant MediaFrame da orientation + word count.
 *
 * Approssimazione interim: soglia corto/lungo basata su word count titolo+body (30 parole).
 * La misurazione runtime §TY3/§M3 (scrollHeight-based) sarà implementata in step 2.3
 * con useDynamicCardLayout.
 *
 * @param orientation derivato da media.ratio (o fallback)
 * @param wordCount conteggio parole titolo+body del post
 * @returns variant da passare a MediaFrame
 */
export function getMediaLayout(
  orientation: 'portrait' | 'landscape' | 'square' | undefined,
  wordCount: number
): MediaFrameVariant {
  const isShortText = wordCount < 30;
  const effectiveOrientation = orientation ?? 'landscape';

  if (effectiveOrientation === 'square') {
    return isShortText ? 'square' : 'mini'; // NUOVO: square dedicato per corto
  }
  if (effectiveOrientation === 'portrait') {
    return isShortText ? 'tall' : 'mini';
  }
  // landscape
  return isShortText ? 'inline' : 'strip';
}

/**
 * Helper per word count titolo+body, robusto a null/undefined.
 * Riutilizza getWordCount da gate-utils.
 */
export function countPostWords(title?: string | null, body?: string | null): number {
  return getWordCount(`${title ?? ''} ${body ?? ''}`);
}

/**
 * Normalizza le sorgenti media DB in una struct UnifiedMedia[] (Scope ridotto a user_upload e link_preview)
 */
export function normalizeMedia(post: Post, articlePreview?: any): UnifiedMedia[] {
  // 1. Branch Upload Utente
  if (post.media && post.media.length > 0) {
    return post.media.map(item => {
      const classified = classifyOrientation(item.width || 0, item.height || 0);
      return {
        src: item.url,
        ambientSrc: item.ambient_url || item.url,
        ratio: item.ratio || classified.ratio,
        orientation: item.orientation || classified.orientation,
        kind: item.type === 'video' ? 'video' : 'image',
        source: 'user_upload',
        width: item.width,
        height: item.height,
        duration_sec: item.duration_sec
      };
    });
  }

  // 2. Branch Articolo Generico (Link Preview)
  const previewWidth = post.preview_img_width || articlePreview?.image_width || 0;
  const previewHeight = post.preview_img_height || articlePreview?.image_height || 0;
  const classified = classifyOrientation(previewWidth, previewHeight);
  const src = articlePreview?.image || post.preview_img;

  if (src) {
    const ratio = post.preview_img_ratio || classified.ratio;
    const orientation = post.preview_img_orientation || classified.orientation;
    return [{
      src,
      ambientSrc: post.preview_img_ambient_url || src,
      ratio: ratio as any,
      orientation: orientation as any,
      kind: 'image',
      source: 'link_preview',
      width: previewWidth || null,
      height: previewHeight || null
    }];
  }

  return [];
}

/**
 * Calcola centralizzato il mediaLayout (variant del MediaFrame)
 */
export function calculateMediaLayout(
  media: UnifiedMedia,
  wordCount: number,
  slotContext: 'main' | 'quoted' = 'main'
): MediaFrameVariant {
  if (slotContext === 'quoted') {
    return 'mini';
  }
  return getMediaLayout(media.orientation, wordCount);
}

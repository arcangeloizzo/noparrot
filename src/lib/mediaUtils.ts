import type { UnifiedMedia } from '@/types/media';
import { getWordCount } from '@/lib/gate-utils';

const RATIO_TARGETS = [
  { name: '9:16' as const, val: 9 / 16,  orientation: 'portrait' as const },
  { name: '3:4'  as const, val: 3 / 4,   orientation: 'portrait' as const },
  { name: '1:1'  as const, val: 1,       orientation: 'square'   as const },
  { name: '16:9' as const, val: 16 / 9,  orientation: 'landscape' as const },
];

/**
 * Spec §M2: clamp the actual width/height ratio to the nearest of 9:16, 3:4, 1:1, 16:9.
 * Lineare absolute distance — sufficient for the 4 target points (verified manually:
 * the transition points are roughly r ≈ 0.66, 0.875, 1.39).
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
    const diff = Math.abs(r - t.val);
    if (diff < minDiff) {
      minDiff = diff;
      best = t;
    }
  }
  return { ratio: best.name, orientation: best.orientation };
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
  const effectiveOrientation = orientation ?? 'landscape'; // fallback safe per link previews ancora senza orientation

  if (effectiveOrientation === 'portrait' || effectiveOrientation === 'square') {
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

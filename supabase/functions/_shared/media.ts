import { fetchImageDimensions } from './image-dimensions.ts';

/**
 * Shared media helpers for Deno Edge Functions
 * (Duplicated from src/lib/mediaUtils.ts for Deno container compatibility — sync if modified)
 */

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
 */
export function classifyOrientation(
  width: number,
  height: number
): { ratio: '9:16' | '3:4' | '1:1' | '16:9' | '4:3' | '3:2'; orientation: 'portrait' | 'landscape' | 'square' } {
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

/**
 * Full classification pipeline per link preview image:
 * fetch dimensions → classifyOrientation → generateAmbientUrl.
 *
 * Returns { width, height, ratio, orientation, ambient_url } or null on failure.
 * Safe to call: never throws, gracefully returns null.
 */
export async function classifyLinkPreviewImage(imageUrl: string): Promise<{
  width: number;
  height: number;
  ratio: string;
  orientation: 'portrait' | 'landscape' | 'square';
  ambient_url: string;
} | null> {
  const dims = await fetchImageDimensions(imageUrl);
  if (!dims) return null;
  const { width, height } = dims;
  if (width <= 0 || height <= 0) return null;
  const { ratio, orientation } = classifyOrientation(width, height);
  const ambient_url = generateAmbientUrl(imageUrl, 'image');
  return { width, height, ratio, orientation, ambient_url };
}

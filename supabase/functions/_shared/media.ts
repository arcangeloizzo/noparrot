/**
 * Shared media helpers for Deno Edge Functions
 * (Duplicated from src/lib/mediaUtils.ts for Deno container compatibility — sync if modified)
 */

const RATIO_TARGETS = [
  { name: '9:16' as const, val: 9 / 16,  orientation: 'portrait' as const },
  { name: '3:4'  as const, val: 3 / 4,   orientation: 'portrait' as const },
  { name: '1:1'  as const, val: 1,       orientation: 'square'   as const },
  { name: '16:9' as const, val: 16 / 9,  orientation: 'landscape' as const },
];

/**
 * Spec §M2: clamp the actual width/height ratio to the nearest of 9:16, 3:4, 1:1, 16:9.
 */
export function classifyOrientation(
  width: number,
  height: number
): { ratio: '9:16' | '3:4' | '1:1' | '16:9'; orientation: 'portrait' | 'landscape' | 'square' } {
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

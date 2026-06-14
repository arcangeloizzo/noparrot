import type { UnifiedMedia } from '@/types/media';

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

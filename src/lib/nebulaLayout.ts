import {
  CATEGORIES as CATEGORY_DEFS,
  CATEGORY_NAMES,
  CATEGORY_COLORS,
  normalizeCategory,
} from "@/config/categories";

export interface PlanetLayout {
  name: string;
  color: string;
  count: number;
  angle: number;
  cx: number;
  cy: number;
  radius: number;
}

export interface NebulaLayout {
  cx: number;
  cy: number;
  maxRadius: number;
  planets: PlanetLayout[];
}

const PLANET_DISTANCE_RATIO = 0.55;

/** Even angular distribution around the circle, same order as CATEGORIES. */
const CATEGORY_ANGLES: Record<string, number> = Object.fromEntries(
  CATEGORY_DEFS.map((c, i) => [c.name, (Math.PI * 2 * i) / CATEGORY_DEFS.length])
);

function computePlanetRadius(weight: number, min: number, max: number): number {
  if (weight <= 0) return 0;
  return min + Math.sqrt(weight) * (max - min);
}

/**
 * Pure layout function shared between the animated in-app canvas and the
 * static share-image generator. Given macro counts and a rendering box,
 * returns the planet positions and radii so the two views coincide by
 * construction.
 */
export function computeNebulaLayout(
  counts: Record<string, number>,
  width: number,
  height: number,
  opts?: { minRadius?: number; maxRadius?: number; radiusScale?: number }
): NebulaLayout {
  const normalized: Record<string, number> = {};
  Object.entries(counts || {}).forEach(([rawKey, value]) => {
    const key = normalizeCategory(rawKey);
    if (key && CATEGORY_NAMES.includes(key)) {
      normalized[key] = (normalized[key] || 0) + (value || 0);
    }
  });

  const values = CATEGORY_NAMES.map((c) => normalized[c] || 0);
  const maxValue = Math.max(...values, 1);

  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(width, height) * 0.42;
  const scale = opts?.radiusScale ?? 1;
  const minR = (opts?.minRadius ?? 12) * scale;
  const maxR = (opts?.maxRadius ?? 50) * scale;

  const planets: PlanetLayout[] = CATEGORY_NAMES.map((name) => {
    const count = normalized[name] || 0;
    const weight = count / maxValue;
    const angle = CATEGORY_ANGLES[name];
    const radius = computePlanetRadius(weight, minR, maxR);
    return {
      name,
      color: CATEGORY_COLORS[name],
      count,
      angle,
      cx: cx + Math.cos(angle) * (maxRadius * PLANET_DISTANCE_RATIO),
      cy: cy + Math.sin(angle) * (maxRadius * PLANET_DISTANCE_RATIO),
      radius,
    };
  });

  return { cx, cy, maxRadius, planets };
}

export { PLANET_DISTANCE_RATIO, CATEGORY_ANGLES };
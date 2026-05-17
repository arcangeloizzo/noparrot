import { useEffect, useRef, useCallback, useState } from 'react';
import {
  CATEGORIES as CATEGORY_DEFS,
  CATEGORY_NAMES,
  CATEGORY_COLORS,
  CATEGORY_SHORT_NAMES,
  normalizeCategory,
} from '@/config/categories';
import type { CognitiveDensityData } from '@/hooks/useCognitiveDensity';

interface CognitiveNebulaCanvasProps {
  /** Accetta sia il nuovo formato strutturato sia il vecchio Record per back-compat */
  data: CognitiveDensityData | Record<string, number>;
  showCounts?: boolean;
  /** Phase 4.5: macro attualmente selezionata come filtro */
  selectedMacro?: string | null;
  /** Phase 4.5: callback al tap su una label di pianeta */
  onMacroClick?: (macro: string) => void;
}

function isStructured(
  d: CognitiveDensityData | Record<string, number> | undefined | null
): d is CognitiveDensityData {
  return !!d && typeof d === 'object' && 'byMacroFlat' in (d as object);
}

// Use the 8 new canonical category names from the central config.
const CATEGORIES = CATEGORY_NAMES;

// Distribute the 8 categories evenly around the circle (0, π/4, π/2, ...).
const CATEGORY_ANGLES: Record<string, number> = Object.fromEntries(
  CATEGORY_DEFS.map((c, i) => [c.name, (Math.PI * 2 * i) / CATEGORY_DEFS.length])
);

// Parse hex color to RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
};

// Particle interface for radial distribution
interface Particle {
  category: string;
  /** Phase 4.6a — particella confinata DENTRO al pianeta (offset relativo al centro del pianeta) */
  localAngle: number;
  localDistanceRatio: number;
  size: number;
  driftPhase: number;
  twinklePhase: number;
  color: { r: number; g: number; b: number };
}

// Phase 4.6a — geometria pianeti: dal centro canvas verso il bordo, distanza fissa.
// Layout angolare resta CATEGORY_ANGLES (verrà sostituito da force-directed in 4.7).
const PLANET_DISTANCE_RATIO = 0.55; // % di maxRadius
const PLANET_MIN_RADIUS = 12;
const PLANET_MAX_RADIUS = 50;

/** Raggio del pianeta proporzionale a sqrt(density / maxDensity). */
function computePlanetRadius(weight: number, min: number, max: number): number {
  if (weight <= 0) return 0;
  // weight è già normalizzato 0..1 (density / maxDensity, vedi useEffect).
  const scaled = Math.sqrt(weight);
  return min + scaled * (max - min);
}

export const CognitiveNebulaCanvas = ({
  data,
  showCounts = false,
  selectedMacro,
  onMacroClick,
}: CognitiveNebulaCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const prevDataRef = useRef<string>('');
  // Phase 4.6a — geometria pianeti calcolata in useEffect quando i weights cambiano
  const planetGeometryRef = useRef<Record<string, {
    angle: number;
    radius: number;
    color: { r: number; g: number; b: number };
  }> | null>(null);
  // Ref live per dim/highlight nel render loop
  const selectedMacroRef = useRef<string | null>(selectedMacro ?? null);
  selectedMacroRef.current = selectedMacro ?? null;
  // Layout corrente del canvas (per posizionare le label HTML overlay)
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  // Phase 4.6a — raggi pianeti per posizionare le label fuori dal bordo
  const [planetRadii, setPlanetRadii] = useState<Record<string, number>>({});

  // Phase 4.6 - Intersection Observer per mettere in pausa l'animazione se fuori schermo
  const isVisibleRef = useRef(true);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting && !animationRef.current) {
          animationRef.current = requestAnimationFrame(animate);
        }
      },
      { threshold: 0.01 }
    );
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [animate]);

  // Source flat map: nuovo formato (RPC) → byMacroFlat; vecchio → record diretto.
  const flatSource: Record<string, number> = isStructured(data)
    ? data.byMacroFlat
    : ((data as Record<string, number>) || {});

  const normalizedData: Record<string, number> = {};
  Object.entries(flatSource).forEach(([rawKey, value]) => {
    const key = normalizeCategory(rawKey);
    if (key && CATEGORIES.includes(key)) {
      normalizedData[key] = (normalizedData[key] || 0) + (value || 0);
    }
  });

  // Initialize particles based on weights
  const initializeParticles = useCallback((weights: Record<string, number>) => {
    const particles: Particle[] = [];

    // Phase 4.6a — particelle CONFINATE dentro al pianeta (atmosfera interna).
    const baseCount = 6;
    const extraCount = 24;

    CATEGORIES.forEach(category => {
      const weight = weights[category] || 0;
      // Niente più floor: pianeti vuoti restano invisibili (0 particelle).
      if (weight <= 0) return;
      const particleCount = Math.floor(baseCount + weight * extraCount);
      const color = hexToRgb(CATEGORY_COLORS[category]);

      for (let i = 0; i < particleCount; i++) {
        // Particelle distribuite uniformemente DENTRO al pianeta (disco)
        const localAngle = Math.random() * Math.PI * 2;
        const localDistanceRatio = Math.sqrt(Math.random()) * 0.85;

        particles.push({
          category,
          localAngle,
          localDistanceRatio,
          size: 0.8 + Math.random() * 1.8,
          driftPhase: Math.random() * Math.PI * 2,
          twinklePhase: Math.random() * Math.PI * 2,
          color
        });
      }
    });

    particlesRef.current = particles;
  }, []);

  const animate = useCallback(() => {
    if (!isVisibleRef.current) {
      animationRef.current = undefined;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.42; // più spazio: i pianeti hanno raggio proprio

    // Update time
    timeRef.current += 0.006;
    const time = timeRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sel = selectedMacroRef.current;
    const planetGeometry = planetGeometryRef.current;
    if (!planetGeometry) {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }

    // ---- 1) Disegna i PIANETI (gradient atmosfera + bordo) ----
    CATEGORIES.forEach(category => {
      const geom = planetGeometry[category];
      if (!geom || geom.radius <= 0) return;
      const isSelected = sel === category;
      const isDimmed = !!sel && !isSelected;

      const cx = centerX + Math.cos(geom.angle) * (maxRadius * PLANET_DISTANCE_RATIO);
      const cy = centerY + Math.sin(geom.angle) * (maxRadius * PLANET_DISTANCE_RATIO);
      const radius = geom.radius * (isSelected ? 1.1 : 1);
      const { r, g, b } = geom.color;

      // Atmosfera gradient
      const innerAlpha = isSelected ? 0.55 : isDimmed ? 0.18 : 0.35;
      const midAlpha = isSelected ? 0.3 : isDimmed ? 0.08 : 0.18;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${innerAlpha})`);
      grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${midAlpha})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Bordo sottile
      const borderAlpha = isSelected ? 0.7 : isDimmed ? 0.2 : 0.4;
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${borderAlpha})`;
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    // ---- 2) Disegna le PARTICELLE dentro ai pianeti ----
    particlesRef.current.forEach(particle => {
      const geom = planetGeometry[particle.category];
      if (!geom || geom.radius <= 0) return;
      const isSelected = sel === particle.category;
      const isDimmed = !!sel && !isSelected;

      const planetRadius = geom.radius * (isSelected ? 1.1 : 1);
      const cx = centerX + Math.cos(geom.angle) * (maxRadius * PLANET_DISTANCE_RATIO);
      const cy = centerY + Math.sin(geom.angle) * (maxRadius * PLANET_DISTANCE_RATIO);

      // Drift ridotto per non sforare il bordo
      const driftX = Math.sin(time * 0.4 + particle.driftPhase) * 1.5;
      const driftY = Math.cos(time * 0.35 + particle.driftPhase * 1.2) * 1.5;
      const twinkle = 0.5 + 0.5 * Math.sin(time * 0.7 + particle.twinklePhase);

      const distance = particle.localDistanceRatio * planetRadius;
      const x = cx + Math.cos(particle.localAngle) * distance + driftX;
      const y = cy + Math.sin(particle.localAngle) * distance + driftY;

      const baseAlpha = 0.55 + 0.45 * twinkle;
      const alpha = baseAlpha * (isDimmed ? 0.3 : 1);
      const sizeMul = isSelected ? 1.15 : 1;

      ctx.beginPath();
      ctx.arc(x, y, particle.size * sizeMul, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${alpha})`;
      ctx.fill();
    });

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const container = canvas.parentElement;
    if (!container) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    setCanvasSize({ w: rect.width, h: rect.height });
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  useEffect(() => {
    // Normalize weights using the already-bucketed normalizedData
    const values = CATEGORIES.map(cat => normalizedData[cat] || 0);
    const maxValue = Math.max(...values, 1);
    const weights: Record<string, number> = {};
    CATEGORIES.forEach(cat => {
      weights[cat] = (normalizedData[cat] || 0) / maxValue;
    });

    // Only reinitialize particles if data changed
    const dataKey = JSON.stringify(weights);
    if (dataKey !== prevDataRef.current) {
      prevDataRef.current = dataKey;
      initializeParticles(weights);
    }

    // Phase 4.6a — calcola geometria pianeti (angle + radius + color) e salva in ref
    const geometry: Record<string, { angle: number; radius: number; color: { r: number; g: number; b: number } }> = {};
    const radiiState: Record<string, number> = {};
    CATEGORIES.forEach(cat => {
      const w = weights[cat] || 0;
      const radius = computePlanetRadius(w, PLANET_MIN_RADIUS, PLANET_MAX_RADIUS);
      geometry[cat] = {
        angle: CATEGORY_ANGLES[cat],
        radius,
        color: hexToRgb(CATEGORY_COLORS[cat]),
      };
      radiiState[cat] = radius;
    });
    planetGeometryRef.current = geometry;
    setPlanetRadii(prev => {
      // evita re-render inutili se identico
      const same = CATEGORIES.every(c => Math.abs((prev[c] ?? -1) - radiiState[c]) < 0.5);
      return same ? prev : radiiState;
    });

    handleResize();
    
    window.addEventListener('resize', handleResize);
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [data, handleResize, initializeParticles, animate]);

  return (
    <div className="w-full h-[350px] relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ background: 'transparent' }}
      />
      {/* Phase 4.5: overlay HTML con label clickable per filtrare il Diario */}
      {canvasSize.w > 0 && canvasSize.h > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {CATEGORIES.map((category) => {
            const angle = CATEGORY_ANGLES[category];
            const categoryValue = normalizedData[category] || 0;
            const isActive = categoryValue > 0;
            const isSelected = selectedMacro === category;
            const isDimmed = !!selectedMacro && !isSelected;

            const centerX = canvasSize.w / 2;
            const centerY = canvasSize.h / 2;
            const maxRadius = Math.min(canvasSize.w, canvasSize.h) * 0.42;
            // Phase 4.6a — label posizionata FUORI dal bordo del pianeta
            const planetCenterDistance = maxRadius * PLANET_DISTANCE_RATIO;
            const planetRadius = planetRadii[category] ?? PLANET_MIN_RADIUS;
            const labelOffset = planetRadius + 14;
            const x = centerX + Math.cos(angle) * (planetCenterDistance + labelOffset);
            const y = centerY + Math.sin(angle) * (planetCenterDistance + labelOffset);

            // Allineamento orizzontale
            const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            let translateX = '-50%';
            if (normalizedAngle > Math.PI * 0.6 && normalizedAngle < Math.PI * 1.4) {
              translateX = '-100%';
            } else if (normalizedAngle > Math.PI * 1.6 || normalizedAngle < Math.PI * 0.4) {
              translateX = '0%';
            }

            const shortLabel = CATEGORY_SHORT_NAMES[category] ?? category;
            const displayLabel = showCounts && categoryValue > 0
              ? `${shortLabel} (${Math.round(categoryValue)})`
              : shortLabel;

            const color = CATEGORY_COLORS[category];
            const clickable = isActive && !!onMacroClick;

            return (
              <button
                key={category}
                type="button"
                disabled={!clickable}
                onClick={(e) => {
                  e.stopPropagation();
                  if (clickable) onMacroClick?.(category);
                }}
                className="absolute text-[11px] whitespace-nowrap transition-all duration-200 disabled:cursor-default enabled:hover:scale-110 enabled:active:scale-95 enabled:cursor-pointer"
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  transform: `translate(${translateX}, -50%) ${isSelected ? 'scale(1.15)' : 'scale(1)'}`,
                  color,
                  fontWeight: isSelected ? 800 : 600,
                  opacity: !isActive ? 0.35 : isDimmed ? 0.45 : 1,
                  textShadow: '0 1px 3px rgba(0,0,0,0.85)',
                  pointerEvents: clickable ? 'auto' : 'none',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                }}
                aria-label={clickable ? `Filtra Diario per ${category}` : category}
              >
                {displayLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

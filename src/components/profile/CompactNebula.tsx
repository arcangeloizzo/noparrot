import { useEffect, useRef, useCallback, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import {
  CATEGORY_NAMES as CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_SHORT_NAMES,
  normalizeCategory,
} from '@/config/categories';
import type { CognitiveDensityData } from '@/hooks/useCognitiveDensity';

interface CompactNebulaProps {
  data: CognitiveDensityData | Record<string, number>;
  /** Apre lo Sheet espanso. Triggerato SOLO dal bottone "Espandi" (4.5 bug-fix). */
  onExpand: () => void;
  /** Phase 4.5: macro selezionata (per highlight + dim altre) */
  selectedMacro?: string | null;
  /** Phase 4.5: tap su una label di pianeta → filtra Diario */
  onMacroClick?: (macro: string) => void;
}

function isStructured(
  d: CognitiveDensityData | Record<string, number> | undefined | null
): d is CognitiveDensityData {
  return !!d && typeof d === 'object' && 'byMacroFlat' in (d as object);
}

// Radar-style angles for the 8 canonical categories (distributed around center).
// Order matches the CATEGORIES export from @/config/categories.
const CATEGORY_ANGLES: Record<string, number> = Object.fromEntries(
  CATEGORIES.map((name, i) => [name, (Math.PI * 2 * i) / CATEGORIES.length])
);

// Circular label positions (degrees) — 8 evenly-spaced spokes, clockwise from right.
const LABEL_POSITIONS: { name: string; angle: number }[] = CATEGORIES.map(
  (name, i) => ({ name, angle: (360 * i) / CATEGORIES.length })
);

// Helper to get label position based on angle and radius
const getLabelStyle = (angle: number, containerWidth: number, containerHeight: number) => {
  const radians = (angle * Math.PI) / 180;
  const radiusX = containerWidth * 0.45; // Horizontal radius
  const radiusY = containerHeight * 0.42; // Vertical radius
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;
  
  const x = centerX + Math.cos(radians) * radiusX;
  const y = centerY + Math.sin(radians) * radiusY;
  
  // Determine text alignment based on position
  let textAlign: 'left' | 'right' | 'center' = 'center';
  let translateX = '-50%';
  
  if (angle > 45 && angle < 135) {
    // Bottom area
    textAlign = 'center';
    translateX = '-50%';
  } else if (angle >= 135 && angle <= 225) {
    // Left side
    textAlign = 'right';
    translateX = '-100%';
  } else if (angle > 225 && angle < 315) {
    // Top area
    textAlign = 'center';
    translateX = '-50%';
  } else {
    // Right side (315-360, 0-45)
    textAlign = 'left';
    translateX = '0%';
  }
  
  return {
    left: `${x}px`,
    top: `${y}px`,
    transform: `translate(${translateX}, -50%)`,
    textAlign,
  };
};

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
};

interface Particle {
  category: string;
  /** Phase 4.6a — particella confinata DENTRO al pianeta */
  localAngle: number;
  localDistanceRatio: number;
  size: number;
  driftPhase: number;
  twinklePhase: number;
  color: { r: number; g: number; b: number };
}

// Phase 4.6a — geometria pianeti per la versione compatta
const PLANET_DISTANCE_RATIO = 0.5;
const PLANET_MIN_RADIUS = 8;
const PLANET_MAX_RADIUS = 28;

function computePlanetRadius(weight: number, min: number, max: number): number {
  if (weight <= 0) return 0;
  return min + Math.sqrt(weight) * (max - min);
}

export const CompactNebula = ({ data, onExpand, selectedMacro, onMacroClick }: CompactNebulaProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const prevDataRef = useRef<string>('');
  // Phase 4.6a — geometria pianeti calcolata in useEffect
  const planetGeometryRef = useRef<Record<string, {
    angle: number;
    radius: number;
    color: { r: number; g: number; b: number };
  }> | null>(null);
  const [planetRadii, setPlanetRadii] = useState<Record<string, number>>({});
  // Ref aggiornato a ogni render per dare al loop d'animazione il valore live
  const selectedMacroRef = useRef<string | null>(selectedMacro ?? null);
  selectedMacroRef.current = selectedMacro ?? null;

  const initializeParticles = useCallback((weights: Record<string, number>) => {
    const particles: Particle[] = [];
    const baseCount = 3;
    const extraCount = 14;

    CATEGORIES.forEach(category => {
      const weight = weights[category] || 0;
      if (weight <= 0) return;
      const particleCount = Math.floor(baseCount + weight * extraCount);
      const color = hexToRgb(CATEGORY_COLORS[category]);

      for (let i = 0; i < particleCount; i++) {
        const localAngle = Math.random() * Math.PI * 2;
        const localDistanceRatio = Math.sqrt(Math.random()) * 0.85;

        particles.push({
          category,
          localAngle,
          localDistanceRatio,
          size: 0.6 + Math.random() * 1.2,
          driftPhase: Math.random() * Math.PI * 2,
          twinklePhase: Math.random() * Math.PI * 2,
          color
        });
      }
    });

    particlesRef.current = particles;
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.45;

    timeRef.current += 0.006;
    const time = timeRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sel = selectedMacroRef.current;
    const planetGeometry = planetGeometryRef.current;
    if (!planetGeometry) {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }

    // ---- 1) Pianeti (atmosfera gradient + bordo sottile) ----
    CATEGORIES.forEach(category => {
      const geom = planetGeometry[category];
      if (!geom || geom.radius <= 0) return;
      const isSelected = sel === category;
      const isDimmed = !!sel && !isSelected;

      const cx = centerX + Math.cos(geom.angle) * (maxRadius * PLANET_DISTANCE_RATIO);
      const cy = centerY + Math.sin(geom.angle) * (maxRadius * PLANET_DISTANCE_RATIO);
      const radius = geom.radius * (isSelected ? 1.1 : 1);
      const { r, g, b } = geom.color;

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

      const borderAlpha = isSelected ? 0.7 : isDimmed ? 0.2 : 0.4;
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${borderAlpha})`;
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    // ---- 2) Particelle dentro ai pianeti ----
    particlesRef.current.forEach(particle => {
      const geom = planetGeometry[particle.category];
      if (!geom || geom.radius <= 0) return;
      const isSelected = sel === particle.category;
      const isDimmed = !!sel && !isSelected;

      const planetRadius = geom.radius * (isSelected ? 1.1 : 1);
      const cx = centerX + Math.cos(geom.angle) * (maxRadius * PLANET_DISTANCE_RATIO);
      const cy = centerY + Math.sin(geom.angle) * (maxRadius * PLANET_DISTANCE_RATIO);

      const driftX = Math.sin(time * 0.4 + particle.driftPhase) * 1;
      const driftY = Math.cos(time * 0.35 + particle.driftPhase * 1.2) * 1;
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
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  useEffect(() => {
    const flatSource: Record<string, number> = isStructured(data)
      ? data.byMacroFlat
      : ((data as Record<string, number>) || {});

    const normalizedData: Record<string, number> = {};
    Object.entries(flatSource).forEach(([rawKey, value]) => {
      const key = normalizeCategory(rawKey) ?? rawKey;
      if (CATEGORIES.includes(key)) {
        normalizedData[key] = (normalizedData[key] || 0) + (value || 0);
      }
    });

    const values = CATEGORIES.map(cat => normalizedData[cat] || 0);
    const maxValue = Math.max(...values, 1);
    const weights: Record<string, number> = {};
    CATEGORIES.forEach(cat => {
      weights[cat] = (normalizedData[cat] || 0) / maxValue;
    });

    const dataKey = JSON.stringify(weights);
    if (dataKey !== prevDataRef.current) {
      prevDataRef.current = dataKey;
      initializeParticles(weights);
    }

    // Phase 4.6a — calcola geometria pianeti
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

  // Get categories that have data for showing labels
  const flatSourceLabels: Record<string, number> = isStructured(data)
    ? data.byMacroFlat
    : ((data as Record<string, number>) || {});
  const normalizedDataForLabels: Record<string, number> = {};
  Object.entries(flatSourceLabels).forEach(([rawKey, value]) => {
    const key = normalizeCategory(rawKey) ?? rawKey;
    if (CATEGORIES.includes(key)) {
      normalizedDataForLabels[key] = (normalizedDataForLabels[key] || 0) + (value || 0);
    }
  });
  const activeCategories = CATEGORIES
    .map(cat => ({ name: cat, value: normalizedDataForLabels[cat] || 0 }))
    .filter(c => c.value > 0);

  // Get labels to show - only active categories
  const labelsToShow = LABEL_POSITIONS.filter(pos => 
    activeCategories.some(cat => cat.name === pos.name)
  );

  // Container dimensions for label positioning
  const containerWidth = 320;
  const containerHeight = 135;

  return (
    <div
      className="w-full rounded-2xl bg-card border border-border p-4 relative overflow-hidden"
    >
      {/* Strong urban texture background - GPU optimized */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.08] urban-noise-overlay" />
      
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-black/20 pointer-events-none" />
      
      {/* Header with title and explicit expand button (4.5 bug-fix) */}
      <div className="flex items-center justify-between mb-2 relative z-10">
        <h4 className="text-base font-semibold text-foreground">Nebulosa Cognitiva</h4>
        <button
          type="button"
          onClick={onExpand}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-muted-foreground border border-border/60 hover:bg-white/5 hover:text-foreground transition-colors"
          aria-label="Espandi Nebulosa Cognitiva"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Espandi</span>
        </button>
      </div>

      {/* Main nebula area with circular radar-style labels */}
      <div className="relative h-[160px] z-10" style={{ width: `${containerWidth}px`, margin: '0 auto' }}>
        {/* Phase 4.6a — canvas a piena dimensione (no più riquadro centrale) */}
        <div className="absolute inset-0 pointer-events-none">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ background: 'transparent' }}
          />
        </div>

        {/* Circular labels positioned around the nebula (z-20 + pointer-events-auto per garantire i click) */}
        {labelsToShow.map((pos) => {
          const isSelected = selectedMacro === pos.name;
          const isDimmed = !!selectedMacro && !isSelected;

          // Phase 4.6a — posizione label = bordo del pianeta + offset
          const angleRad = (pos.angle * Math.PI) / 180;
          const cw = containerWidth;
          const ch = 160;
          const cx = cw / 2;
          const cy = ch / 2;
          const maxR = Math.min(cw, ch) * 0.45;
          const planetCenterDist = maxR * PLANET_DISTANCE_RATIO;
          const planetR = planetRadii[pos.name] ?? PLANET_MIN_RADIUS;
          const labelOffset = planetR + 10;
          const lx = cx + Math.cos(angleRad) * (planetCenterDist + labelOffset);
          const ly = cy + Math.sin(angleRad) * (planetCenterDist + labelOffset);

          // Allineamento orizzontale in base al quadrante
          let translateX = '-50%';
          if (pos.angle >= 135 && pos.angle <= 225) translateX = '-100%';
          else if (pos.angle > 315 || pos.angle < 45) translateX = '0%';

          return (
            <button
              key={pos.name}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMacroClick?.(pos.name);
              }}
              className="absolute z-20 text-[11px] font-semibold whitespace-nowrap transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer px-1.5 py-0.5"
              style={{
                color: CATEGORY_COLORS[pos.name],
                left: `${lx}px`,
                top: `${ly}px`,
                transform: `translate(${translateX}, -50%) ${isSelected ? 'scale(1.15)' : 'scale(1)'}`,
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                opacity: isDimmed ? 0.45 : 1,
                fontWeight: isSelected ? 800 : 600,
                pointerEvents: 'auto',
              }}
              aria-label={`Filtra Diario per ${pos.name}`}
            >
              {CATEGORY_SHORT_NAMES[pos.name]}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {activeCategories.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-card/80 rounded-2xl">
          <p className="text-sm text-muted-foreground text-center px-8">
            Esplora contenuti per attivare la tua nebulosa cognitiva
          </p>
        </div>
      )}
    </div>
  );
};

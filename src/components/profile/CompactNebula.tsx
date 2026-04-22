import { useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  CATEGORY_NAMES as CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_SHORT_NAMES,
  normalizeCategory,
} from '@/config/categories';

interface CompactNebulaProps {
  data: Record<string, number>;
  onClick: () => void;
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
  baseAngle: number;
  angleOffset: number;
  distanceRatio: number;
  size: number;
  driftPhase: number;
  twinklePhase: number;
  color: { r: number; g: number; b: number };
}

export const CompactNebula = ({ data, onClick }: CompactNebulaProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const prevDataRef = useRef<string>('');

  const initializeParticles = useCallback((weights: Record<string, number>) => {
    const particles: Particle[] = [];
    const baseCount = 10;
    const extraCount = 35;
    const angleSpread = Math.PI / 6;

    CATEGORIES.forEach(category => {
      const weight = weights[category] || 0;
      const normalizedWeight = Math.max(0.1, weight);
      const particleCount = Math.floor(baseCount + normalizedWeight * extraCount);
      const baseAngle = CATEGORY_ANGLES[category];
      const color = hexToRgb(CATEGORY_COLORS[category]);

      for (let i = 0; i < particleCount; i++) {
        const angleOffset = (Math.random() - 0.5) * 2 * angleSpread;
        const distanceRatio = Math.pow(Math.random(), 0.5) * normalizedWeight;
        
        particles.push({
          category,
          baseAngle,
          angleOffset,
          distanceRatio,
          size: 1.5 + Math.random() * 2.5,
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
    const maxRadius = Math.min(width, height) * 0.35;
    
    timeRef.current += 0.006;
    const time = timeRef.current;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particlesRef.current.forEach(particle => {
      const driftX = Math.sin(time * 0.4 + particle.driftPhase) * 2;
      const driftY = Math.cos(time * 0.35 + particle.driftPhase * 1.2) * 2;
      const twinkle = 0.5 + 0.5 * Math.sin(time * 0.7 + particle.twinklePhase);
      
      const angle = particle.baseAngle + particle.angleOffset;
      const distance = particle.distanceRatio * maxRadius;
      
      const x = centerX + Math.cos(angle) * distance + driftX;
      const y = centerY + Math.sin(angle) * distance + driftY;

      const distanceAlpha = 1 - (particle.distanceRatio * 0.4);
      const alpha = distanceAlpha * (0.6 + 0.4 * twinkle);

      ctx.beginPath();
      ctx.arc(x, y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${alpha})`;
      ctx.fill();
    });

    // Core glow
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius * 0.15);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

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
    // Normalize the incoming density data: legacy keys (e.g. "Salute") are
    // collapsed into their new canonical buckets ("Benessere"), summing weights.
    const normalizedData: Record<string, number> = {};
    Object.entries(data || {}).forEach(([rawKey, value]) => {
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
  const normalizedDataForLabels: Record<string, number> = {};
  Object.entries(data || {}).forEach(([rawKey, value]) => {
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
    <button
      onClick={onClick}
      className="w-full rounded-2xl bg-card border border-border p-4 transition-all hover:border-border/50 active:scale-[0.99] relative overflow-hidden"
    >
      {/* Strong urban texture background - GPU optimized */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.08] urban-noise-overlay" />
      
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-black/20 pointer-events-none" />
      
      {/* Header with title and expand icon */}
      <div className="flex items-center justify-between mb-2 relative z-10">
        <h4 className="text-base font-semibold text-foreground">Nebulosa Cognitiva</h4>
        <ChevronDown className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Main nebula area with circular radar-style labels */}
      <div className="relative h-[135px] z-10" style={{ width: `${containerWidth}px`, margin: '0 auto' }}>
        {/* Circular labels positioned around the nebula */}
        {labelsToShow.map((pos) => {
          const style = getLabelStyle(pos.angle, containerWidth, containerHeight);
          return (
            <span
              key={pos.name}
              className="absolute text-[11px] font-semibold whitespace-nowrap pointer-events-none"
              style={{ 
                color: CATEGORY_COLORS[pos.name],
                left: style.left,
                top: style.top,
                transform: style.transform,
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              }}
            >
              {CATEGORY_SHORT_NAMES[pos.name]}
            </span>
          );
        })}

        {/* Center canvas for particle nebula */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[50%] h-[70%]">
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ background: 'transparent' }}
            />
          </div>
        </div>
      </div>

      {/* Empty state */}
      {activeCategories.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-card/80 rounded-2xl">
          <p className="text-sm text-muted-foreground text-center px-8">
            Esplora contenuti per attivare la tua nebulosa cognitiva
          </p>
        </div>
      )}
    </button>
  );
};

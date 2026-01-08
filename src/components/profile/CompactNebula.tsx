import { useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

interface CompactNebulaProps {
  data: Record<string, number>;
  onClick: () => void;
}

const CATEGORIES = [
  'Società & Politica',
  'Economia & Business',
  'Scienza & Tecnologia',
  'Cultura & Arte',
  'Pianeta & Ambiente',
  'Sport & Lifestyle',
  'Salute & Benessere',
  'Media & Comunicazione',
];

const CATEGORY_COLORS: Record<string, string> = {
  'Società & Politica': '#E76A6A',
  'Economia & Business': '#FFD464',
  'Scienza & Tecnologia': '#2AD2C9',
  'Cultura & Arte': '#A98FF8',
  'Pianeta & Ambiente': '#65D08C',
  'Sport & Lifestyle': '#FFB273',
  'Salute & Benessere': '#F28DB7',
  'Media & Comunicazione': '#9AA3AB',
};

// Short display names for the labels
const CATEGORY_SHORT_NAMES: Record<string, string> = {
  'Società & Politica': 'Società',
  'Economia & Business': 'Economia',
  'Scienza & Tecnologia': 'Scienza',
  'Cultura & Arte': 'Cultura',
  'Pianeta & Ambiente': 'Pianeta',
  'Sport & Lifestyle': 'Sport',
  'Salute & Benessere': 'Salute',
  'Media & Comunicazione': 'Media',
};

const CATEGORY_ANGLES: Record<string, number> = {
  'Società & Politica': 0,
  'Economia & Business': Math.PI * 0.25,
  'Scienza & Tecnologia': Math.PI * 0.5,
  'Cultura & Arte': Math.PI * 0.75,
  'Pianeta & Ambiente': Math.PI,
  'Sport & Lifestyle': Math.PI * 1.25,
  'Salute & Benessere': Math.PI * 1.5,
  'Media & Comunicazione': Math.PI * 1.75,
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
    const centerX = width * 0.6; // Offset to the right
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
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
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
    const values = CATEGORIES.map(cat => data[cat] || 0);
    const maxValue = Math.max(...values, 1);
    const weights: Record<string, number> = {};
    CATEGORIES.forEach(cat => {
      weights[cat] = (data[cat] || 0) / maxValue;
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

  // Get top categories with values for labels
  const topCategories = CATEGORIES
    .map(cat => ({ name: cat, value: data[cat] || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .filter(c => c.value > 0);

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl bg-[#0E1419]/90 backdrop-blur-xl border border-white/[0.06] p-4 transition-all hover:border-white/10 active:scale-[0.99] relative overflow-hidden"
    >
      {/* Urban texture overlay */}
      <div className="absolute inset-0 urban-texture opacity-[0.03] pointer-events-none" />
      
      {/* Header with title and expand icon */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <h4 className="text-base font-semibold text-foreground">Nebulosa Cognitiva</h4>
        <ChevronDown className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Main nebula area with labels */}
      <div className="relative h-[180px] z-10">
        {/* Category labels positioned around the nebula */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Left side labels */}
          {topCategories.slice(0, 3).map((cat, index) => (
            <span
              key={cat.name}
              className="absolute text-xs font-medium"
              style={{ 
                color: CATEGORY_COLORS[cat.name],
                left: '8px',
                top: `${30 + index * 45}px`,
              }}
            >
              {CATEGORY_SHORT_NAMES[cat.name]}
            </span>
          ))}
          
          {/* Right side labels */}
          {topCategories.slice(3, 5).map((cat, index) => (
            <span
              key={cat.name}
              className="absolute text-xs font-medium text-right"
              style={{ 
                color: CATEGORY_COLORS[cat.name],
                right: '8px',
                top: `${45 + index * 50}px`,
              }}
            >
              {CATEGORY_SHORT_NAMES[cat.name]}
            </span>
          ))}
        </div>

        {/* Canvas for particle nebula */}
        <div className="absolute inset-0">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ background: 'transparent' }}
          />
        </div>
      </div>

      {/* Empty state */}
      {topCategories.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <p className="text-sm text-muted-foreground text-center px-8">
            Esplora contenuti per attivare la tua nebulosa cognitiva
          </p>
        </div>
      )}
    </button>
  );
};

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
    const baseCount = 6; // Fewer particles for compact view
    const extraCount = 24;
    const angleSpread = Math.PI / 8;

    CATEGORIES.forEach(category => {
      const weight = weights[category] || 0;
      const normalizedWeight = Math.max(0.08, weight);
      const particleCount = Math.floor(baseCount + normalizedWeight * extraCount);
      const baseAngle = CATEGORY_ANGLES[category];
      const color = hexToRgb(CATEGORY_COLORS[category]);

      for (let i = 0; i < particleCount; i++) {
        const angleOffset = (Math.random() - 0.5) * 2 * angleSpread;
        const distanceRatio = Math.pow(Math.random(), 0.6) * normalizedWeight;
        
        particles.push({
          category,
          baseAngle,
          angleOffset,
          distanceRatio,
          size: 1 + Math.random() * 1.5,
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
    const maxRadius = Math.min(width, height) * 0.38;
    
    timeRef.current += 0.006;
    const time = timeRef.current;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particlesRef.current.forEach(particle => {
      const driftX = Math.sin(time * 0.4 + particle.driftPhase) * 1.5;
      const driftY = Math.cos(time * 0.35 + particle.driftPhase * 1.2) * 1.5;
      const twinkle = 0.5 + 0.5 * Math.sin(time * 0.7 + particle.twinklePhase);
      
      const angle = particle.baseAngle + particle.angleOffset;
      const distance = particle.distanceRatio * maxRadius;
      
      const x = centerX + Math.cos(angle) * distance + driftX;
      const y = centerY + Math.sin(angle) * distance + driftY;

      const distanceAlpha = 1 - (particle.distanceRatio * 0.5);
      const alpha = distanceAlpha * (0.55 + 0.45 * twinkle);

      ctx.beginPath();
      ctx.arc(x, y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${alpha})`;
      ctx.fill();
    });

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius * 0.12);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
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

  // Get top 3 categories for summary labels
  const topCategories = CATEGORIES
    .map(cat => ({ name: cat, value: data[cat] || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .filter(c => c.value > 0);

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl bg-[#0E1419]/80 backdrop-blur-xl border border-white/5 p-3 transition-all hover:border-white/10 active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        {/* Compact canvas */}
        <div className="w-20 h-20 flex-shrink-0 relative">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ background: 'transparent' }}
          />
        </div>

        {/* Summary info */}
        <div className="flex-1 text-left">
          <h4 className="text-sm font-semibold text-foreground mb-1">Nebulosa Cognitiva</h4>
          {topCategories.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {topCategories.map(cat => (
                <span
                  key={cat.name}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ 
                    backgroundColor: `${CATEGORY_COLORS[cat.name]}20`,
                    color: CATEGORY_COLORS[cat.name]
                  }}
                >
                  {cat.name.split(' ')[0]}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Esplora contenuti per attivare la nebulosa
            </p>
          )}
        </div>

        {/* Expand indicator */}
        <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      </div>
    </button>
  );
};

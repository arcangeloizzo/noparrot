import { useEffect, useRef, useCallback } from 'react';

interface CognitiveNebulaCanvasProps {
  data: Record<string, number>;
  showCounts?: boolean;
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

// Angular positions for each category (radians) - distributed around the circle
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
  baseAngle: number;
  angleOffset: number;
  distanceRatio: number;
  size: number;
  driftPhase: number;
  twinklePhase: number;
  color: { r: number; g: number; b: number };
}

export const CognitiveNebulaCanvas = ({ data, showCounts = false }: CognitiveNebulaCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const prevDataRef = useRef<string>('');

  // Initialize particles based on weights
  const initializeParticles = useCallback((weights: Record<string, number>) => {
    const particles: Particle[] = [];
    
    const baseCount = 12;
    const extraCount = 48;
    const angleSpread = Math.PI / 8; // ±22.5 degrees

    CATEGORIES.forEach(category => {
      const weight = weights[category] || 0;
      const normalizedWeight = Math.max(0.08, weight); // Minimum visibility
      const particleCount = Math.floor(baseCount + normalizedWeight * extraCount);
      const baseAngle = CATEGORY_ANGLES[category];
      const color = hexToRgb(CATEGORY_COLORS[category]);

      for (let i = 0; i < particleCount; i++) {
        // Random angle within the category's cone
        const angleOffset = (Math.random() - 0.5) * 2 * angleSpread;
        
        // Distance ratio: particles can only go as far as the weight allows
        // Use power function for better distribution (more particles near center)
        const distanceRatio = Math.pow(Math.random(), 0.6) * normalizedWeight;
        
        particles.push({
          category,
          baseAngle,
          angleOffset,
          distanceRatio,
          size: 1 + Math.random() * 2.5,
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
    const maxRadius = Math.min(width, height) * 0.32; // Smaller to leave room for labels
    
    // Update time
    timeRef.current += 0.006;
    const time = timeRef.current;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw particles
    particlesRef.current.forEach(particle => {
      // Drift animation - small oscillation in position
      const driftX = Math.sin(time * 0.4 + particle.driftPhase) * 2.5;
      const driftY = Math.cos(time * 0.35 + particle.driftPhase * 1.2) * 2.5;

      // Twinkle animation - alpha pulsing
      const twinkle = 0.5 + 0.5 * Math.sin(time * 0.7 + particle.twinklePhase);
      
      // Calculate position
      const angle = particle.baseAngle + particle.angleOffset;
      const distance = particle.distanceRatio * maxRadius;
      
      const x = centerX + Math.cos(angle) * distance + driftX;
      const y = centerY + Math.sin(angle) * distance + driftY;

      // Alpha: higher near center, fades with distance, plus twinkle
      const distanceAlpha = 1 - (particle.distanceRatio * 0.5);
      const alpha = distanceAlpha * (0.55 + 0.45 * twinkle);

      // Draw particle
      ctx.beginPath();
      ctx.arc(x, y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${alpha})`;
      ctx.fill();
    });

    // Add subtle central glow
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius * 0.12);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw category labels at the edges
    const labelRadius = maxRadius + 24;
    ctx.textBaseline = 'middle';
    
    CATEGORIES.forEach(category => {
      const angle = CATEGORY_ANGLES[category];
      const color = CATEGORY_COLORS[category];
      const categoryValue = data[category] || 0;
      
      const x = centerX + Math.cos(angle) * labelRadius;
      const y = centerY + Math.sin(angle) * labelRadius;
      
      // Short label (first word only) with optional count
      const shortLabel = category.split(' ')[0];
      const displayLabel = showCounts && categoryValue > 0 
        ? `${shortLabel} (${Math.round(categoryValue)})`
        : shortLabel;
      
      // Align text based on angular position
      const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      
      if (normalizedAngle > Math.PI * 0.6 && normalizedAngle < Math.PI * 1.4) {
        ctx.textAlign = 'right';
      } else if (normalizedAngle >= Math.PI * 1.4 && normalizedAngle <= Math.PI * 1.6) {
        ctx.textAlign = 'center';
      } else if (normalizedAngle >= Math.PI * 0.4 && normalizedAngle <= Math.PI * 0.6) {
        ctx.textAlign = 'center';
      } else if (normalizedAngle > Math.PI * 1.6 || normalizedAngle < Math.PI * 0.4) {
        ctx.textAlign = 'left';
      } else {
        ctx.textAlign = 'center';
      }
      
      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      
      // Draw text shadow for better contrast
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      ctx.fillText(displayLabel, x + 1, y + 1);
      
      // Draw main text
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillText(displayLabel, x, y);
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
    // Normalize weights
    const values = CATEGORIES.map(cat => data[cat] || 0);
    const maxValue = Math.max(...values, 1);
    const weights: Record<string, number> = {};
    CATEGORIES.forEach(cat => {
      weights[cat] = (data[cat] || 0) / maxValue;
    });

    // Only reinitialize particles if data changed
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

  return (
    <div className="w-full h-[350px] relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ background: 'transparent' }}
      />
    </div>
  );
};

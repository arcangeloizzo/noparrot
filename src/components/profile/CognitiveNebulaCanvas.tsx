import { useEffect, useRef, useCallback } from 'react';

interface CognitiveNebulaCanvasProps {
  data: Record<string, number>;
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

// Simple noise function using sin combinations for organic movement
const noise = (x: number, y: number, t: number): number => {
  return (
    Math.sin(x * 1.2 + t * 0.3) * 0.3 +
    Math.cos(y * 0.9 + t * 0.4) * 0.3 +
    Math.sin((x + y) * 0.7 + t * 0.2) * 0.2 +
    Math.cos(x * 0.5 - y * 0.8 + t * 0.5) * 0.2
  );
};

// Star particle interface
interface Star {
  x: number;
  y: number;
  size: number;
  twinkleOffset: number;
  twinkleSpeed: number;
}

export const CognitiveNebulaCanvas = ({ data }: CognitiveNebulaCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);
  const starsRef = useRef<Star[]>([]);

  // Initialize stars once
  const initializeStars = useCallback(() => {
    const stars: Star[] = [];
    const starCount = 80;
    
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        size: 0.5 + Math.random() * 1.5,
        twinkleOffset: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.5 + Math.random() * 1.5,
      });
    }
    
    starsRef.current = stars;
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
    
    // Update time
    timeRef.current += 0.008;
    const time = timeRef.current;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate normalized weights
    const values = CATEGORIES.map(cat => data[cat] || 0);
    const maxValue = Math.max(...values, 1);
    const weights: Record<string, number> = {};
    CATEGORIES.forEach(cat => {
      weights[cat] = (data[cat] || 0) / maxValue;
    });
    
    // Draw central glow first (warm white core)
    const coreGradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, maxRadius * 0.4
    );
    coreGradient.addColorStop(0, 'rgba(255, 250, 240, 0.15)');
    coreGradient.addColorStop(0.3, 'rgba(255, 245, 230, 0.08)');
    coreGradient.addColorStop(0.6, 'rgba(255, 240, 220, 0.03)');
    coreGradient.addColorStop(1, 'rgba(255, 235, 210, 0)');
    ctx.fillStyle = coreGradient;
    ctx.fillRect(0, 0, width, height);
    
    // Enable additive blending for nebula clouds
    ctx.globalCompositeOperation = 'lighter';
    
    // Sort categories by weight (draw weaker ones first, stronger on top)
    const sortedCategories = [...CATEGORIES].sort((a, b) => weights[a] - weights[b]);
    
    // Draw nebula clouds for each category
    sortedCategories.forEach(category => {
      const weight = weights[category];
      const color = hexToRgb(CATEGORY_COLORS[category]);
      const angle = CATEGORY_ANGLES[category];
      
      // Calculate extension based on weight (0.2 = 25% radius, 1.0 = 90% radius)
      const minExtension = 0.25;
      const maxExtension = 0.9;
      const extension = minExtension + (maxExtension - minExtension) * weight;
      
      // Calculate density/alpha based on weight
      const baseDensity = 0.08 + weight * 0.25;
      
      // Number of layers based on weight
      const layerCount = Math.floor(2 + weight * 3);
      
      // Direction offset from center
      const directionOffset = 0.15 + weight * 0.2;
      
      // Draw multiple layers for depth
      for (let layer = 0; layer < layerCount; layer++) {
        // Animate cloud position with noise
        const noiseX = noise(layer * 0.7, category.length * 0.3, time + layer);
        const noiseY = noise(layer * 0.5 + 100, category.length * 0.2, time + layer * 0.8);
        
        // Cloud center offset from canvas center in the category's direction
        const layerSpread = 0.7 + (layer / layerCount) * 0.6;
        const cloudCenterX = centerX + Math.cos(angle) * maxRadius * directionOffset * layerSpread + noiseX * 20;
        const cloudCenterY = centerY + Math.sin(angle) * maxRadius * directionOffset * layerSpread + noiseY * 20;
        
        // Cloud radius
        const cloudRadius = maxRadius * extension * (0.6 + layer * 0.15);
        
        // Layer alpha (outer layers are more transparent)
        const layerAlpha = baseDensity * (1 - layer * 0.15);
        
        // Create radial gradient for this cloud layer
        const gradient = ctx.createRadialGradient(
          cloudCenterX, cloudCenterY, 0,
          cloudCenterX, cloudCenterY, cloudRadius
        );
        
        // Gradient stops - dense center fading to transparent
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${layerAlpha * 0.8})`);
        gradient.addColorStop(0.2, `rgba(${color.r}, ${color.g}, ${color.b}, ${layerAlpha * 0.6})`);
        gradient.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, ${layerAlpha * 0.35})`);
        gradient.addColorStop(0.6, `rgba(${color.r}, ${color.g}, ${color.b}, ${layerAlpha * 0.15})`);
        gradient.addColorStop(0.8, `rgba(${color.r}, ${color.g}, ${color.b}, ${layerAlpha * 0.05})`);
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
      
      // Add a subtle concentrated core for strong categories
      if (weight > 0.4) {
        const coreNoiseX = noise(0, category.length, time * 0.5);
        const coreNoiseY = noise(100, category.length, time * 0.5);
        const coreCenterX = centerX + Math.cos(angle) * maxRadius * directionOffset * 0.5 + coreNoiseX * 10;
        const coreCenterY = centerY + Math.sin(angle) * maxRadius * directionOffset * 0.5 + coreNoiseY * 10;
        const coreRadius = maxRadius * 0.2 * weight;
        
        const coreGrad = ctx.createRadialGradient(
          coreCenterX, coreCenterY, 0,
          coreCenterX, coreCenterY, coreRadius
        );
        coreGrad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${weight * 0.4})`);
        coreGrad.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${weight * 0.15})`);
        coreGrad.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
        
        ctx.fillStyle = coreGrad;
        ctx.fillRect(0, 0, width, height);
      }
    });
    
    // Reset composite operation for stars
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw twinkling stars
    starsRef.current.forEach(star => {
      const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
      const alpha = 0.3 + twinkle * 0.3;
      const size = star.size * (0.8 + twinkle * 0.2);
      
      const x = star.x * width;
      const y = star.y * height;
      
      // Star glow
      const starGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
      starGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.8})`);
      starGradient.addColorStop(0.3, `rgba(255, 255, 255, ${alpha * 0.3})`);
      starGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = starGradient;
      ctx.beginPath();
      ctx.arc(x, y, size * 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Star core
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    });
    
    animationRef.current = requestAnimationFrame(animate);
  }, [data]);

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
    handleResize();
    initializeStars();
    
    window.addEventListener('resize', handleResize);
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [handleResize, initializeStars, animate]);

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

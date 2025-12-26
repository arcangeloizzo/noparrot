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

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  categoryIndex: number;
  baseAlpha: number;
  size: number;
}

interface Attractor {
  x: number;
  y: number;
  z: number;
  color: string;
  category: string;
}

// Lerp helper
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Gaussian-ish random
const gaussianRandom = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * 0.3;
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

export const CognitiveNebulaCanvas = ({ data }: CognitiveNebulaCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const attractorsRef = useRef<Attractor[]>([]);
  const timeRef = useRef(0);

  const initializeParticles = useCallback(() => {
    const particles: Particle[] = [];
    const attractors: Attractor[] = [];
    
    // Calculate max value for normalization
    const values = CATEGORIES.map(cat => data[cat] || 0);
    const maxValue = Math.max(...values, 1);
    
    // Create attractors on a sphere/ring
    CATEGORIES.forEach((category, index) => {
      const angle = (index / CATEGORIES.length) * Math.PI * 2;
      const elevation = (Math.random() - 0.5) * 0.4; // Slight z variation
      
      attractors.push({
        x: Math.cos(angle) * 0.6,
        y: Math.sin(angle) * 0.6,
        z: elevation,
        color: CATEGORY_COLORS[category],
        category
      });
      
      // Calculate weight and particle count
      const value = data[category] || 0;
      const weight = value / maxValue;
      const particleCount = Math.floor(40 + 220 * weight);
      const clusterRadius = lerp(0.35, 0.12, weight); // Tighter for stronger categories
      
      // Generate particles for this category
      for (let i = 0; i < particleCount; i++) {
        const offsetX = gaussianRandom() * clusterRadius;
        const offsetY = gaussianRandom() * clusterRadius;
        const offsetZ = gaussianRandom() * clusterRadius * 0.5;
        
        particles.push({
          x: attractors[index].x + offsetX,
          y: attractors[index].y + offsetY,
          z: attractors[index].z + offsetZ,
          vx: (Math.random() - 0.5) * 0.0003,
          vy: (Math.random() - 0.5) * 0.0003,
          vz: (Math.random() - 0.5) * 0.0002,
          categoryIndex: index,
          baseAlpha: 0.3 + Math.random() * 0.5,
          size: 1.5 + Math.random() * 2.5
        });
      }
    });
    
    particlesRef.current = particles;
    attractorsRef.current = attractors;
  }, [data]);

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
    const radius = Math.min(width, height) * 0.38;
    
    // Camera settings
    const cameraZ = 2.2;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update time
    timeRef.current += 0.016;
    const time = timeRef.current;
    
    // Update and collect particles with projected coordinates
    const projectedParticles: Array<{
      screenX: number;
      screenY: number;
      screenRadius: number;
      alpha: number;
      color: { r: number; g: number; b: number };
      z: number;
    }> = [];
    
    particlesRef.current.forEach((particle) => {
      const attractor = attractorsRef.current[particle.categoryIndex];
      
      // Attraction force (gentle pull toward attractor)
      const dx = attractor.x - particle.x;
      const dy = attractor.y - particle.y;
      const dz = attractor.z - particle.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      if (dist > 0.01) {
        const attractionStrength = 0.00008;
        particle.vx += (dx / dist) * attractionStrength;
        particle.vy += (dy / dist) * attractionStrength;
        particle.vz += (dz / dist) * attractionStrength * 0.5;
      }
      
      // Add subtle noise/drift
      particle.vx += (Math.sin(time * 0.5 + particle.x * 10) * 0.00002);
      particle.vy += (Math.cos(time * 0.4 + particle.y * 10) * 0.00002);
      particle.vz += (Math.sin(time * 0.3 + particle.z * 10) * 0.00001);
      
      // Damping
      particle.vx *= 0.995;
      particle.vy *= 0.995;
      particle.vz *= 0.995;
      
      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.z += particle.vz;
      
      // 3D to 2D projection
      const scale = cameraZ / (cameraZ - particle.z);
      const screenX = centerX + particle.x * scale * radius;
      const screenY = centerY + particle.y * scale * radius;
      const screenRadius = particle.size * scale;
      
      // Alpha based on depth and base alpha
      const depthAlpha = lerp(0.2, 1, (particle.z + 1) / 2);
      const alpha = particle.baseAlpha * depthAlpha * scale * 0.6;
      
      const color = hexToRgb(attractor.color);
      
      projectedParticles.push({
        screenX,
        screenY,
        screenRadius,
        alpha: Math.min(Math.max(alpha, 0.1), 0.9),
        color,
        z: particle.z
      });
    });
    
    // Sort by z (painter's algorithm - far to near)
    projectedParticles.sort((a, b) => a.z - b.z);
    
    // Draw particles with glow effect
    projectedParticles.forEach(({ screenX, screenY, screenRadius, alpha, color }) => {
      // Outer glow
      const gradient = ctx.createRadialGradient(
        screenX, screenY, 0,
        screenX, screenY, screenRadius * 3
      );
      gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.4})`);
      gradient.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.15})`);
      gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
      
      ctx.beginPath();
      ctx.arc(screenX, screenY, screenRadius * 3, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Inner bright core
      ctx.beginPath();
      ctx.arc(screenX, screenY, screenRadius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.8})`;
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
    handleResize();
    initializeParticles();
    
    window.addEventListener('resize', handleResize);
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [handleResize, initializeParticles, animate]);

  // Reinitialize when data changes
  useEffect(() => {
    initializeParticles();
  }, [data, initializeParticles]);

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

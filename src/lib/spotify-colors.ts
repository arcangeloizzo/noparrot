/**
 * Spotify Colors - Generative gradient utilities based on Audio Features
 * 
 * Maps Spotify Audio Features to visual properties:
 * - Valence (0-1): Color temperature (cold → warm)
 * - Energy (0-1): Saturation and contrast
 * - Tempo (BPM): Animation speed
 */

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface AudioFeatures {
  energy: number;      // 0.0-1.0
  valence: number;     // 0.0-1.0
  tempo: number;       // BPM (60-200+)
  danceability?: number;
}

/**
 * Convert hex color to HSL
 */
export function hexToHSL(hex: string): HSL {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Parse RGB
  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Convert HSL to CSS string
 */
export function hslToString(hsl: HSL): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

/**
 * Adjust color temperature based on valence
 * Low valence (sad) → shift toward blue/cool
 * High valence (happy) → shift toward orange/warm
 */
export function adjustColorTemperature(hsl: HSL, valence: number): HSL {
  const newHsl = { ...hsl };
  
  if (valence < 0.35) {
    // Cold shift: push toward blue (220-260)
    const coldTarget = 230;
    const shift = (0.35 - valence) * 40; // Max 14 degree shift
    newHsl.h = newHsl.h + (coldTarget - newHsl.h) * (shift / 40);
    newHsl.s = Math.max(20, newHsl.s - 10); // Slightly desaturate
  } else if (valence > 0.65) {
    // Warm shift: push toward orange/red (20-50)
    const warmTarget = 30;
    const shift = (valence - 0.65) * 40; // Max 14 degree shift
    newHsl.h = newHsl.h + (warmTarget - newHsl.h) * (shift / 40);
    newHsl.s = Math.min(90, newHsl.s + 10); // Boost saturation
  }
  
  // Keep hue in valid range
  newHsl.h = ((newHsl.h % 360) + 360) % 360;
  
  return newHsl;
}

/**
 * Adjust saturation and lightness based on energy
 * Low energy → muted, desaturated
 * High energy → vivid, high contrast
 */
export function adjustForEnergy(hsl: HSL, energy: number): HSL {
  const newHsl = { ...hsl };
  
  if (energy < 0.4) {
    // Low energy: desaturate and darken
    const factor = energy / 0.4; // 0-1 within low range
    newHsl.s = Math.max(15, newHsl.s * (0.5 + factor * 0.5));
    newHsl.l = Math.max(10, newHsl.l * (0.7 + factor * 0.3));
  } else if (energy > 0.7) {
    // High energy: boost saturation and contrast
    const factor = (energy - 0.7) / 0.3; // 0-1 within high range
    newHsl.s = Math.min(95, newHsl.s * (1 + factor * 0.3));
    newHsl.l = Math.min(50, Math.max(25, newHsl.l)); // Keep in mid range for vibrancy
  }
  
  return newHsl;
}

/**
 * Get animation class based on tempo
 */
export function getTempoAnimationClass(tempo: number): string {
  if (tempo < 90) {
    return ''; // No animation for very slow tracks
  } else if (tempo < 120) {
    return 'animate-spotify-pulse-slow';
  } else if (tempo < 145) {
    return 'animate-spotify-pulse-medium';
  } else {
    return 'animate-spotify-pulse-fast';
  }
}

/**
 * Generate a CSS gradient from dominant colors and audio features
 */
export function generateSpotifyGradient(
  primaryColor: string,
  secondaryColor: string,
  audioFeatures?: AudioFeatures
): { gradient: string; animationClass: string } {
  // Parse colors
  let primary = hexToHSL(primaryColor.replace('#', ''));
  let secondary = hexToHSL(secondaryColor.replace('#', ''));
  
  let animationClass = '';
  
  if (audioFeatures) {
    // Apply valence (temperature)
    primary = adjustColorTemperature(primary, audioFeatures.valence);
    secondary = adjustColorTemperature(secondary, audioFeatures.valence);
    
    // Apply energy (saturation/contrast)
    primary = adjustForEnergy(primary, audioFeatures.energy);
    secondary = adjustForEnergy(secondary, audioFeatures.energy);
    
    // Get animation based on tempo
    animationClass = getTempoAnimationClass(audioFeatures.tempo);
  }
  
  // Create a third color (darker variant) for depth
  const tertiary: HSL = {
    h: (secondary.h + 20) % 360,
    s: Math.max(15, secondary.s - 20),
    l: Math.max(8, secondary.l - 15)
  };
  
  // Build gradient string
  const gradient = `linear-gradient(
    135deg,
    ${hslToString(primary)} 0%,
    ${hslToString(secondary)} 50%,
    ${hslToString(tertiary)} 100%
  )`;
  
  return { gradient, animationClass };
}

/**
 * Fallback gradient when no audio features available
 */
export function getFallbackSpotifyGradient(primaryColor: string, secondaryColor: string): string {
  return `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 50%, #0d1117 100%)`;
}

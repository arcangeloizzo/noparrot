import { useDominantColors } from "@/hooks/useDominantColors";
import { 
  generateSpotifyGradient, 
  getFallbackSpotifyGradient,
  type AudioFeatures 
} from "@/lib/spotify-colors";
import { cn } from "@/lib/utils";

interface SpotifyGradientBackgroundProps {
  albumArtUrl: string;
  audioFeatures?: AudioFeatures;
  className?: string;
}

/**
 * SpotifyGradientBackground
 * 
 * Generates a dynamic, animated background for Spotify content based on:
 * 1. Dominant colors extracted from album art
 * 2. Audio features (energy, valence, tempo) that modify the visual style
 * 
 * - Valence influences color temperature (sad = cool blue, happy = warm orange)
 * - Energy influences saturation (low = muted, high = vivid)
 * - Tempo influences animation speed (slow = no pulse, fast = quick pulse)
 */
export const SpotifyGradientBackground = ({
  albumArtUrl,
  audioFeatures,
  className
}: SpotifyGradientBackgroundProps) => {
  const { primary, secondary, loading } = useDominantColors(albumArtUrl);
  
  // Static fallback while loading or if no image
  const fallbackGradient = "linear-gradient(to bottom, #121212, #1a1a2e, #0d1117)";
  
  if (loading || !albumArtUrl) {
    return (
      <div className={cn("absolute inset-0", className)}>
        <div 
          className="absolute inset-0"
          style={{ background: fallbackGradient }}
        />
        {/* Subtle Spotify green accent */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1DB954]/10 to-transparent" />
      </div>
    );
  }
  
  // Generate dynamic gradient
  const { gradient, animationClass } = audioFeatures 
    ? generateSpotifyGradient(primary, secondary, audioFeatures)
    : { gradient: getFallbackSpotifyGradient(primary, secondary), animationClass: '' };
  
  return (
    <div className={cn("absolute inset-0", className)}>
      {/* Main dynamic gradient */}
      <div 
        className={cn("absolute inset-0 transition-all duration-1000", animationClass)}
        style={{ background: gradient }}
      />
      
      {/* Subtle overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
      
      {/* Soft glow from album colors */}
      <div 
        className="absolute inset-0 opacity-30 blur-3xl"
        style={{ 
          background: `radial-gradient(circle at 50% 30%, ${primary} 0%, transparent 60%)` 
        }}
      />
    </div>
  );
};

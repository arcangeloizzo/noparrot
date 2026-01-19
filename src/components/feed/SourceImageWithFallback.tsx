import { useState } from "react";
import { TrustBadgeOverlay } from "@/components/ui/trust-badge-overlay";
import { UnanalyzableBadge } from "@/components/ui/unanalyzable-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SourceImageWithFallbackProps {
  src: string | undefined | null;
  sharedUrl?: string;
  isIntent?: boolean;
  trustScore?: {
    band: "ALTO" | "MEDIO" | "BASSO";
    score: number;
    reasons?: string[];
  } | null;
  /** Hide overlay badge (for original posts where badge is in header) */
  hideOverlay?: boolean;
}

/**
 * Optimized image component that:
 * 1. Blocks Instagram/Meta CDN URLs immediately (they expire)
 * 2. Uses single <img> with skeleton overlay (no double-download)
 * 3. Fades in when loaded for smooth appearance
 */
export function SourceImageWithFallback({ 
  src, 
  sharedUrl,
  isIntent, 
  trustScore,
  hideOverlay = false,
}: SourceImageWithFallbackProps) {
  // Check if the shared URL is from Instagram - BLOCK IMMEDIATELY
  const isInstagramPost = sharedUrl?.includes('instagram.com') || sharedUrl?.includes('instagram');
  
  // Check if URL is from Instagram/Meta CDN (these always expire)
  const isMetaCdnUrl = (url: string) => 
    url.includes('cdninstagram.com') || 
    url.includes('scontent') ||
    url.includes('fbcdn.net') ||
    url.includes('instagram.com') ||
    url.includes('instagram');

  // BLOCK Instagram posts immediately - no state, no render
  if (isInstagramPost || !src) {
    return null;
  }

  // BLOCK Meta CDN URLs immediately
  if (isMetaCdnUrl(src)) {
    return null;
  }

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Don't render if image failed to load
  if (error) {
    return null;
  }

  return (
    <div className="relative mb-3 rounded-2xl overflow-hidden border border-white/10 shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_20px_rgba(0,0,0,0.3)] h-40 sm:h-48">
      {/* Skeleton overlay while loading */}
      {!loaded && (
        <Skeleton className="absolute inset-0 bg-white/5" />
      )}
      
      {/* Single image element - no double download */}
      <img 
        src={src} 
        alt="" 
        loading="lazy"
        decoding="async"
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
      
      {/* Trust Score Badge Overlay - only show after image loads */}
      {loaded && !hideOverlay && (
        isIntent ? (
          <UnanalyzableBadge className="absolute bottom-3 right-3" />
        ) : trustScore ? (
          <TrustBadgeOverlay 
            band={trustScore.band}
            score={trustScore.score}
            reasons={trustScore.reasons}
          />
        ) : null
      )}
    </div>
  );
}

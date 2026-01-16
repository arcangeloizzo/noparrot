import { useState, memo } from "react";
import { TrustBadgeOverlay } from "@/components/ui/trust-badge-overlay";
import { UnanalyzableBadge } from "@/components/ui/unanalyzable-badge";
import { getThumbUrl } from "@/lib/imageCache";

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

const SourceImageWithFallbackInner = ({ 
  src, 
  sharedUrl,
  isIntent, 
  trustScore,
  hideOverlay = false,
}: SourceImageWithFallbackProps) => {
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
  if (isInstagramPost) {
    return null;
  }

  // BLOCK Meta CDN URLs immediately
  if (src && isMetaCdnUrl(src)) {
    return null;
  }

  // Simple loading state - no preload validation (avoids double-download)
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  // Don't render if no src
  if (!src) {
    return null;
  }

  // Get thumbnail URL for faster loading
  const thumbUrl = getThumbUrl(src) || src;

  // Show skeleton while loading
  if (status === 'loading') {
    return (
      <div className="relative mb-3 rounded-2xl overflow-hidden border border-white/10">
        <div className="w-full h-40 sm:h-48 bg-white/5 animate-pulse" />
        {/* Hidden image to trigger load */}
        <img 
          src={thumbUrl} 
          alt="" 
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover opacity-0"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      </div>
    );
  }

  // Don't render if error
  if (status === 'error') {
    return null;
  }

  return (
    <div className="relative mb-3 rounded-2xl overflow-hidden border border-white/10 shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_20px_rgba(0,0,0,0.3)]">
      <img 
        src={thumbUrl} 
        alt="" 
        loading="lazy"
        decoding="async"
        className="w-full h-40 sm:h-48 object-cover"
        onError={() => setStatus('error')}
      />
      {/* Trust Score Badge Overlay - Hidden for original posts (hideOverlay), Intent posts show "NON ANALIZZABILE" */}
      {!hideOverlay && (
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
};

export const SourceImageWithFallback = memo(SourceImageWithFallbackInner);

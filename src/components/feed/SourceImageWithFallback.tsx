import { useState, useEffect } from "react";
import { TrustBadgeOverlay } from "@/components/ui/trust-badge-overlay";
import { UnanalyzableBadge } from "@/components/ui/unanalyzable-badge";

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
  if (isInstagramPost) {
    return null;
  }

  // BLOCK Meta CDN URLs immediately
  if (src && isMetaCdnUrl(src)) {
    return null;
  }

  const [imageStatus, setImageStatus] = useState<'loading' | 'valid' | 'error'>(!src ? 'error' : 'loading');

  useEffect(() => {
    if (!src) {
      setImageStatus('error');
      return;
    }

    // Reset status when src changes
    setImageStatus('loading');

    // Validate image by preloading
    const img = new Image();
    
    // Timeout for slow/hanging requests (5 seconds)
    const timeout = setTimeout(() => {
      console.log('[SourceImage] Timeout reached for:', src);
      setImageStatus('error');
    }, 5000);
    
    img.onload = () => {
      clearTimeout(timeout);
      // Check for tiny placeholder images (Instagram sometimes returns 1x1 transparent)
      if (img.naturalWidth <= 10 || img.naturalHeight <= 10) {
        console.log('[SourceImage] Tiny placeholder detected:', src, img.naturalWidth, img.naturalHeight);
        setImageStatus('error');
      } else {
        setImageStatus('valid');
      }
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      console.log('[SourceImage] Load error for:', src);
      setImageStatus('error');
    };
    
    img.src = src;
    
    return () => {
      clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  // Don't render if no src or image failed validation
  if (!src || imageStatus === 'error') {
    return null;
  }
  
  // Show skeleton while validating
  if (imageStatus === 'loading') {
    return (
      <div className="relative mb-3 rounded-2xl overflow-hidden border border-white/10 bg-white/5 animate-pulse h-40 sm:h-48" />
    );
  }

  return (
    <div className="relative mb-3 rounded-2xl overflow-hidden border border-white/10 shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_20px_rgba(0,0,0,0.3)]">
      <img 
        src={src} 
        alt="" 
        className="w-full h-40 sm:h-48 object-cover"
        onError={() => setImageStatus('error')}
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
}

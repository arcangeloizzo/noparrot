import { useState } from "react";
import { ExternalLink, Link2, Music, Video, Newspaper } from "lucide-react";
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
  /** Platform type for branded fallback styling */
  platform?: 'spotify' | 'youtube' | 'twitter' | 'linkedin' | 'tiktok' | 'threads' | string;
  /** Hostname for fallback display */
  hostname?: string;
  className?: string; // Allow custom styling/constraints from parent
}

// Platform-specific gradient colors
const platformGradients: Record<string, string> = {
  spotify: 'from-[#1DB954]/40 via-[#121212] to-black',
  youtube: 'from-[#FF0000]/30 via-[#282828] to-black',
  twitter: 'from-[#1DA1F2]/25 via-[#15202B] to-black',
  linkedin: 'from-[#0A66C2]/30 via-[#1a1a2e] to-black',
  tiktok: 'from-[#00F2EA]/20 via-[#FF0050]/20 to-black',
  threads: 'from-white/10 via-[#1a1a1a] to-black',
  default: 'from-white/10 via-[#2a2a3a] to-[#0d0d14]',
};

// Platform icons
const PlatformIcon = ({ platform }: { platform?: string }) => {
  const iconClass = "w-8 h-8 text-white/40";

  switch (platform) {
    case 'spotify':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      );
    case 'youtube':
      return <Video className={iconClass} />;
    case 'twitter':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      );
    default:
      return <Link2 className={iconClass} />;
  }
};

/**
 * Optimized image component that:
 * 1. Blocks Instagram/Meta CDN URLs immediately (they expire)
 * 2. Uses single <img> with skeleton overlay (no double-download)
 * 3. Fades in when loaded for smooth appearance
 * 4. Shows branded fallback gradient when image is missing
 */
export function SourceImageWithFallback({
  src,
  sharedUrl,
  isIntent,
  trustScore,
  hideOverlay = false,
  platform,
  hostname,
  className,
}: SourceImageWithFallbackProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Check if the shared URL is from Instagram - BLOCK IMMEDIATELY
  const isInstagramPost = sharedUrl?.includes('instagram.com') || sharedUrl?.includes('instagram');

  // Check if URL is from Instagram/Meta CDN (these always expire)
  const isMetaCdnUrl = (url: string) =>
    url.includes('cdninstagram.com') ||
    url.includes('scontent') ||
    url.includes('fbcdn.net') ||
    url.includes('instagram.com') ||
    url.includes('instagram');

  // Determine platform from URL if not provided
  const detectedPlatform = platform || (() => {
    if (!sharedUrl) return 'default';
    const url = sharedUrl.toLowerCase();
    if (url.includes('spotify')) return 'spotify';
    if (url.includes('youtube') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('twitter') || url.includes('x.com')) return 'twitter';
    if (url.includes('linkedin')) return 'linkedin';
    if (url.includes('tiktok')) return 'tiktok';
    if (url.includes('threads')) return 'threads';
    return 'default';
  })();

  // Get hostname for display
  const displayHostname = hostname || (() => {
    if (!sharedUrl) return 'Fonte';
    try {
      const urlWithProtocol = sharedUrl.startsWith('http') ? sharedUrl : `https://${sharedUrl}`;
      return new URL(urlWithProtocol).hostname.replace(/^www\./, '');
    } catch {
      return 'Fonte';
    }
  })();

  // Determine if we should show image or fallback
  const shouldShowImage = src && !isInstagramPost && !isMetaCdnUrl(src) && !error;
  const shouldShowFallback = !shouldShowImage;

  // Branded Fallback UI
  if (shouldShowFallback) {
    const gradientClass = platformGradients[detectedPlatform] || platformGradients.default;

    return (
      <div className={cn(
        "relative mb-2 sm:mb-3 rounded-2xl overflow-hidden border border-white/10 shadow-xl aspect-[1.91/1] max-h-[20vh] sm:max-h-none",
        className
      )}>
        {/* Gradient Background */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br",
          gradientClass
        )} />

        {/* Urban noise texture */}
        <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay urban-noise-overlay" />

        {/* Centered content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <PlatformIcon platform={detectedPlatform} />
          <span className="text-white/40 text-xs font-medium uppercase tracking-widest">
            {displayHostname}
          </span>
        </div>

        {/* Trust Score Badge Overlay */}
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

  return (
    <div className={cn(
      "relative mb-2 sm:mb-3 rounded-2xl overflow-hidden border border-white/10 shadow-xl h-32 sm:h-48",
      className
    )}>
      {/* Skeleton overlay while loading */}
      {!loaded && (
        <Skeleton className="absolute inset-0 bg-white/5" />
      )}

      {/* Single image element - no double download */}
      <img
        src={src!}
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

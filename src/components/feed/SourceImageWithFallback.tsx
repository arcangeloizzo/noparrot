import { useState } from "react";
import { TrustBadgeOverlay } from "@/components/ui/trust-badge-overlay";
import { UnanalyzableBadge } from "@/components/ui/unanalyzable-badge";

interface SourceImageWithFallbackProps {
  src: string | undefined | null;
  isIntent?: boolean;
  trustScore?: {
    band: "ALTO" | "MEDIO" | "BASSO";
    score: number;
    reasons?: string[];
  } | null;
}

export function SourceImageWithFallback({ 
  src, 
  isIntent, 
  trustScore 
}: SourceImageWithFallbackProps) {
  const [imageError, setImageError] = useState(false);

  // Don't render anything if no src or if image failed to load
  if (!src || imageError) {
    return null;
  }

  return (
    <div className="relative mb-3 rounded-2xl overflow-hidden border border-white/10 shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_20px_rgba(0,0,0,0.3)]">
      <img 
        src={src} 
        alt="" 
        className="w-full h-40 sm:h-48 object-cover"
        onError={() => setImageError(true)}
      />
      {/* Trust Score Badge Overlay - Intent posts show "NON ANALIZZABILE" */}
      {isIntent ? (
        <UnanalyzableBadge className="absolute bottom-3 right-3" />
      ) : trustScore ? (
        <TrustBadgeOverlay 
          band={trustScore.band}
          score={trustScore.score}
          reasons={trustScore.reasons}
        />
      ) : null}
    </div>
  );
}

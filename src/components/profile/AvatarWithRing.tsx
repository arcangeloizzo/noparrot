import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AvatarWithRingProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  /** Diametro avatar in px (default 88) */
  size?: number;
  /**
   * Colori del conic-gradient dell'anello.
   * Default: palette brand statica. In futuro popolato dinamicamente
   * con i colori dominanti della Nebulosa cognitiva dell'utente.
   */
  ringColors?: string[];
  className?: string;
}

const DEFAULT_RING_COLORS = [
  "#E41E52",
  "#A78BFA",
  "#0A7AFF",
  "#06B6D4",
  "#FFD464",
  "#E41E52",
];

/**
 * Avatar con anello gradient (effetto "storia").
 * Wrapper dedicato alla pagina profilo: NON sostituisce il componente
 * Avatar condiviso usato negli altri 20+ callsite (feed, commenti, msg, ecc.).
 */
export const AvatarWithRing = ({
  src,
  alt,
  fallback,
  size = 88,
  ringColors = DEFAULT_RING_COLORS,
  className,
}: AvatarWithRingProps) => {
  const ringBg = `conic-gradient(from 180deg, ${ringColors.join(", ")})`;

  return (
    <div
      className={cn("relative flex-shrink-0 rounded-full", className)}
      style={{ width: size, height: size }}
    >
      {/* Anello gradient — sporge 3px oltre l'avatar */}
      <div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: -3,
          background: ringBg,
          filter: "blur(1px)",
          opacity: 0.95,
        }}
      />
      {/* Avatar Radix con bordo background per "stacco" dall'anello */}
      <Avatar
        className="absolute inset-0 h-auto w-auto rounded-full border-[3px] border-background"
        style={{ width: size, height: size }}
      >
        {src ? <AvatarImage src={src} alt={alt} /> : null}
        <AvatarFallback className="text-2xl font-semibold">
          {fallback ?? "?"}
        </AvatarFallback>
      </Avatar>
    </div>
  );
};

export default AvatarWithRing;
import { cn } from "@/lib/utils";

interface TrustBadgeOverlayProps {
  band: 'ALTO' | 'MEDIO' | 'BASSO';
  score: number;
  className?: string;
}

export function TrustBadgeOverlay({ band, score, className }: TrustBadgeOverlayProps) {
  const config = {
    ALTO: {
      bg: 'bg-emerald-500/90',
      text: 'text-white',
      letter: 'A'
    },
    MEDIO: {
      bg: 'bg-yellow-500/90',
      text: 'text-white',
      letter: 'M'
    },
    BASSO: {
      bg: 'bg-red-500/90',
      text: 'text-white',
      letter: 'B'
    },
  };
  
  const { bg, text, letter } = config[band];
  
  return (
    <div className={cn(
      "absolute top-3 right-3 px-2.5 py-1 rounded-full",
      "backdrop-blur-md border border-white/20 shadow-lg",
      "flex items-center gap-1.5 text-xs font-bold",
      bg,
      text,
      className
    )}>
      <span>{letter}</span>
      <span className="opacity-80">{score}</span>
    </div>
  );
}

import { cn } from "@/lib/utils";

interface TrustBadgeOverlayProps {
  band: 'ALTO' | 'MEDIO' | 'BASSO';
  score: number;
  className?: string;
}

export function TrustBadgeOverlay({ band, score, className }: TrustBadgeOverlayProps) {
  const config = {
    ALTO: {
      bg: 'hsl(142 76% 46% / 0.35)',
      text: 'white',
      letter: 'A'
    },
    MEDIO: {
      bg: 'hsl(38 92% 50% / 0.4)',
      text: 'hsl(38 92% 50%)',
      letter: 'M'
    },
    BASSO: {
      bg: 'hsl(0 84% 60% / 0.5)',
      text: 'hsl(0 84% 60%)',
      letter: 'B'
    },
  };
  
  const { bg, text, letter } = config[band];
  
  return (
    <div 
      className={cn(
        "absolute top-3 right-3 px-2.5 py-1 rounded-full",
        "backdrop-blur-md border shadow-lg",
        "flex items-center gap-1.5 text-xs font-bold",
        className
      )}
      style={{
        backgroundColor: bg,
        color: text,
        borderColor: 'hsl(0 0% 50% / 0.3)'
      }}
    >
      <span>{letter}</span>
      <span className="opacity-80">{score}</span>
    </div>
  );
}

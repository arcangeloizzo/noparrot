import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TrustBadgeOverlayProps {
  band: 'ALTO' | 'MEDIO' | 'BASSO';
  score: number;
  reasons?: string[];
  className?: string;
}

const BAND_LABELS = {
  BASSO: "Basso",
  MEDIO: "Medio", 
  ALTO: "Alto",
} as const;

export function TrustBadgeOverlay({ band, score, reasons = [], className }: TrustBadgeOverlayProps) {
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
  const label = BAND_LABELS[band];
  
  return (
    <div 
      className={cn(
        "absolute top-3 right-3 px-2 py-1 rounded-full",
        "backdrop-blur-md border shadow-lg",
        "flex items-center gap-1.5",
        className
      )}
      style={{
        backgroundColor: 'hsl(0 0% 0% / 0.4)',
        borderColor: 'hsl(0 0% 100% / 0.15)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Colored circle with letter */}
      <div 
        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border shadow-sm"
        style={{
          backgroundColor: bg,
          color: text,
          borderColor: 'hsl(0 0% 50% / 0.3)'
        }}
      >
        {letter}
      </div>

      {/* Label */}
      <span className="text-[11px] font-medium text-white/90">
        Trust {label}
      </span>

      {/* Info Button with Dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="p-0.5 h-auto hover:bg-white/10 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Info className="w-3 h-3 text-white/60" />
          </Button>
        </DialogTrigger>
        <DialogContent 
          className="sm:max-w-md"
          onPointerDownCapture={(e) => e.stopPropagation()}
          onClickCapture={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Trust Score</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              Il Trust Score indica il livello di affidabilità delle fonti citate, 
              <strong className="text-foreground"> non la verità o la qualità del contenuto</strong>.
            </p>
            <p>
              È calcolato automaticamente e può contenere errori.
            </p>
            
            {reasons.length > 0 && (
              <div className="pt-3 border-t border-border">
                <p className="font-medium text-foreground mb-2">Perché questo punteggio:</p>
                <ul className="space-y-1.5">
                  {reasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                      <span className="flex-1">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <p className="text-xs pt-2 border-t border-border text-muted-foreground">
              Valuta la qualità delle fonti e la coerenza col contenuto. Non è fact-checking.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { cn } from "@/lib/utils";
import { ShieldCheck, Info } from "lucide-react";
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

export function TrustBadgeOverlay({ band, score, reasons = [], className }: TrustBadgeOverlayProps) {
  // Color mapping matching header badge
  const colorClass = {
    ALTO: 'text-emerald-400',
    MEDIO: 'text-amber-400',
    BASSO: 'text-red-400',
  }[band];
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button 
          className={cn(
            "absolute top-3 right-3 px-2.5 py-1.5 rounded-full",
            "backdrop-blur-md border shadow-lg",
            "flex items-center gap-1.5",
            "hover:bg-white/10 transition-colors",
            colorClass,
            className
          )}
          style={{
            backgroundColor: 'hsl(0 0% 0% / 0.4)',
            borderColor: 'hsl(0 0% 100% / 0.15)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[10px] font-bold tracking-wider uppercase">
            TRUST {band}
          </span>
        </button>
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
  );
}

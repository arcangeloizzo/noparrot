import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface TrustBadgeProps {
  band?: "BASSO" | "MEDIO" | "ALTO";
  score?: number;
  reasons?: string[];
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const BAND_COLORS = {
  BASSO: "hsl(var(--destructive))",
  MEDIO: "hsl(var(--warning))", 
  ALTO: "hsl(var(--success))",
} as const;

const BAND_LABELS = {
  BASSO: "Fonte: Basso",
  MEDIO: "Fonte: Medio", 
  ALTO: "Fonte: Alto",
} as const;

const SIZE_CONFIG = {
  sm: { badge: "w-5 h-5 text-[9px]", text: "text-[11px]", icon: "w-3 h-3" },
  md: { badge: "w-8 h-8 text-xs", text: "text-sm", icon: "w-4 h-4" },
  lg: { badge: "w-10 h-10 text-sm", text: "text-base", icon: "w-5 h-5" },
} as const;

export function TrustBadge({ 
  band, 
  score, 
  reasons = [], 
  color, 
  size = "md",
  className 
}: TrustBadgeProps) {
  const hasData = band && score !== undefined;
  const label = band ? BAND_LABELS[band] : "Nessuna fonte";
  const letter = band ? band[0] : "?";
  const config = SIZE_CONFIG[size];
  
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {/* Trust Badge Circle */}
      <div 
        className={cn(
          "rounded-full flex items-center justify-center font-bold tracking-wide transition-all duration-200 hover-lift border shadow-sm",
          config.badge,
          !hasData && "opacity-60"
        )}
        style={{ 
          backgroundColor: band === "BASSO" 
            ? "hsl(0 84% 60% / 0.5)"
            : band === "MEDIO"
            ? "hsl(38 92% 50% / 0.4)"
            : band === "ALTO"
            ? "hsl(142 76% 46% / 0.35)"
            : "hsl(0 0% 50% / 0.2)",
          borderColor: "hsl(0 0% 50% / 0.3)",
          color: band === "ALTO" ? "white" : (
            band === "BASSO" ? "hsl(0 84% 60%)" : 
            band === "MEDIO" ? "hsl(38 92% 50%)" : 
            "hsl(0 0% 50%)"
          )
        }}
        title={`Trust Score: ${label}${score ? ` (${score}%)` : ""}`}
      >
        {letter}
      </div>

      {/* Label */}
      <span className={cn(
        "font-medium text-muted-foreground transition-colors",
        config.text
      )}>
        {label}
      </span>

      {/* Info Button with Dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "p-1 h-auto hover:bg-muted/50 transition-colors",
              config.icon
            )}
          >
            <Info className={config.icon} />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
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

export type { TrustBadgeProps };

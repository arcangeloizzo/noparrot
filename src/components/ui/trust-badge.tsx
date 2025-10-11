import React, { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

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
  BASSO: "Basso",
  MEDIO: "Medio", 
  ALTO: "Alto",
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
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top');
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const hasData = band && score !== undefined;
  const finalColor = color || (band ? BAND_COLORS[band] : "hsl(var(--muted))");
  const label = band ? BAND_LABELS[band] : "Nessuna fonte";
  const letter = band ? band[0] : "?";
  const config = SIZE_CONFIG[size];

  const handleMouseEnter = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      
      setTooltipPosition(spaceBelow > 300 ? 'bottom' : 'top');
    }
    setShowTooltip(true);
  };
  
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {/* Trust Badge Circle */}
      <div 
        className={cn(
          "rounded-full flex items-center justify-center font-bold tracking-wide transition-all duration-200 hover-lift glass-panel border-glass shadow-glass",
          config.badge,
          !hasData && "opacity-60"
        )}
        style={{ 
          backgroundColor: `${finalColor}15`,
          borderColor: `${finalColor}30`,
          color: band === "ALTO" ? "white" : finalColor
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

      {/* Info Button with Tooltip */}
      {reasons.length > 0 && (
        <div className="relative">
          <Button
            ref={buttonRef}
            variant="ghost"
            size="sm"
            className={cn(
              "p-1 h-auto hover:bg-muted/50 transition-colors",
              config.icon
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={handleMouseEnter}
          >
            <Info className={config.icon} />
          </Button>

          {/* Tooltip */}
          {showTooltip && (
            <Card 
              className={cn(
                "absolute left-1/2 -translate-x-1/2 w-[280px] max-w-[90vw] p-4",
                "glass-panel border-glass shadow-xl z-[100]",
                "animate-in fade-in-0 zoom-in-95 duration-200",
                tooltipPosition === 'top' 
                  ? "bottom-full mb-2" 
                  : "top-full mt-2"
              )}
            >
              <div className="space-y-3">
                <div className="font-semibold text-sm text-foreground">
                  Perché questo punteggio
                </div>
                
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {reasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                      <span className="flex-1">{reason}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="text-[10px] text-muted-foreground/80 pt-2 border-t border-border/30">
                  Valuta qualità delle fonti e coerenza col contenuto. Non è fact-checking.
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export type { TrustBadgeProps };
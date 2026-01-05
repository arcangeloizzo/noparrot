import React from "react";
import { CircleDot, RefreshCw, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface PulseBadgeProps {
  popularity?: number;
  size?: "sm" | "md";
  className?: string;
}

type PulseCategory = "NICCHIA" | "IN_ROTAZIONE" | "HOT";

const PULSE_CONFIG: Record<PulseCategory, {
  label: string;
  Icon: typeof CircleDot;
  color: string;
  bgColor: string;
  glowColor: string;
}> = {
  NICCHIA: {
    label: "NICCHIA",
    Icon: CircleDot,
    color: "hsl(260 60% 70%)",      // viola
    bgColor: "hsl(260 60% 50% / 0.2)",
    glowColor: "hsl(260 60% 50% / 0.3)",
  },
  IN_ROTAZIONE: {
    label: "IN ROTAZIONE",
    Icon: RefreshCw,
    color: "hsl(190 80% 60%)",      // ciano
    bgColor: "hsl(190 80% 50% / 0.2)",
    glowColor: "hsl(190 80% 50% / 0.3)",
  },
  HOT: {
    label: "HOT",
    Icon: Flame,
    color: "hsl(25 95% 60%)",       // arancione
    bgColor: "hsl(25 95% 55% / 0.2)",
    glowColor: "hsl(25 95% 55% / 0.3)",
  },
};

function getPulseCategory(popularity: number): PulseCategory {
  if (popularity <= 30) return "NICCHIA";
  if (popularity <= 70) return "IN_ROTAZIONE";
  return "HOT";
}

export function PulseBadge({ 
  popularity, 
  size = "md",
  className 
}: PulseBadgeProps) {
  if (popularity === undefined || popularity === null) return null;
  
  const category = getPulseCategory(popularity);
  const config = PULSE_CONFIG[category];
  const { Icon, label, color, bgColor, glowColor } = config;
  
  const sizeClasses = size === "sm" 
    ? "h-8 px-2.5 gap-1.5 text-[10px]" 
    : "h-10 px-3 gap-2 text-xs";
  
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 transition-all duration-200 hover:bg-black/40 active:scale-[0.97]",
            sizeClasses,
            className
          )}
          style={{
            boxShadow: `0 0 12px ${glowColor}`,
          }}
        >
          {/* Pulse Indicator */}
          <span 
            className="font-bold tracking-wide"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            ◉ PULSE
          </span>
          
          {/* Category Icon */}
          <Icon 
            className={iconSize} 
            style={{ color }}
          />
          
          {/* Category Label */}
          <span 
            className="font-bold tracking-wider"
            style={{ color }}
          >
            {label}
          </span>
        </button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" style={{ color }} />
            <span>PULSE</span>
            <span className="text-muted-foreground font-normal">— {label}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 text-sm text-muted-foreground">
          <p className="text-foreground/90">
            Indica quanto questo brano sta circolando su Spotify in questo momento.
          </p>
          <p>
            Misura la diffusione, <strong className="text-foreground">non il valore artistico</strong>.
          </p>
          
          {/* Categories Legend */}
          <div className="pt-3 border-t border-border space-y-3">
            <div className="flex items-center gap-3">
              <Flame className="w-4 h-4 flex-shrink-0" style={{ color: PULSE_CONFIG.HOT.color }} />
              <div>
                <span className="font-medium text-foreground">HOT</span>
                <span className="text-muted-foreground"> — È caldo ora, sta esplodendo</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <RefreshCw className="w-4 h-4 flex-shrink-0" style={{ color: PULSE_CONFIG.IN_ROTAZIONE.color }} />
              <div>
                <span className="font-medium text-foreground">IN ROTAZIONE</span>
                <span className="text-muted-foreground"> — Sta girando, è in movimento</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CircleDot className="w-4 h-4 flex-shrink-0" style={{ color: PULSE_CONFIG.NICCHIA.color }} />
              <div>
                <span className="font-medium text-foreground">NICCHIA</span>
                <span className="text-muted-foreground"> — Scoperta, underground</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { PulseBadgeProps };

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

const PULSE_CONFIG = {
  NICCHIA: {
    label: "NICCHIA",
    Icon: CircleDot,
    // Light: Violet-100/800 | Dark: Neutral Glass
    lightClass: "bg-violet-100 text-violet-800 border-violet-200",
    darkClass: "dark:bg-black/30 dark:text-white dark:border-white/10 dark:shadow-[0_0_12px_rgba(255,255,255,0.1)]",
    iconColor: "text-violet-700 dark:text-violet-400"
  },
  IN_ROTAZIONE: {
    label: "IN ROTAZIONE",
    Icon: RefreshCw,
    // Light: Cyan-100/800 | Dark: Neutral Glass
    lightClass: "bg-cyan-100 text-cyan-800 border-cyan-200",
    darkClass: "dark:bg-black/30 dark:text-white dark:border-white/10 dark:shadow-[0_0_12px_rgba(255,255,255,0.1)]",
    iconColor: "text-cyan-700 dark:text-cyan-400"
  },
  HOT: {
    label: "HOT",
    Icon: Flame,
    // Light: Orange-100/800 | Dark: Neutral Glass
    lightClass: "bg-orange-100 text-orange-800 border-orange-200",
    darkClass: "dark:bg-black/30 dark:text-white dark:border-white/10 dark:shadow-[0_0_12px_rgba(255,255,255,0.1)]",
    iconColor: "text-orange-700 dark:text-orange-400"
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

  // Safety check for category
  const categoryKey = category as keyof typeof PULSE_CONFIG;
  const config = PULSE_CONFIG[categoryKey] || PULSE_CONFIG.NICCHIA;
  const { Icon, label, lightClass, darkClass, iconColor } = config;

  const sizeClasses = size === "sm"
    ? "h-8 px-2.5 gap-1.5 text-[10px]"
    : "h-10 px-3 gap-2 text-xs";

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center justify-center rounded-full border transition-all duration-200 active:scale-[0.97] backdrop-blur-md",
            lightClass,
            darkClass,
            sizeClasses,
            className
          )}
        >
          {/* Pulse Indicator */}
          <span
            className="font-bold tracking-wide opacity-60 text-current"
          >
            PULSE
          </span>

          {/* Category Icon */}
          <Icon
            className={cn(iconSize, iconColor)}
          />

          {/* Category Label */}
          <span
            className="font-bold tracking-wider text-current"
          >
            {label}
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn("w-5 h-5", iconColor)} />
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

          <div className="pt-3 border-t border-border space-y-3">
            <div className="flex items-center gap-3">
              <Flame className="w-4 h-4 flex-shrink-0 text-orange-500" />
              <div>
                <span className="font-medium text-foreground">HOT</span>
                <span className="text-muted-foreground"> — È caldo ora, sta esplodendo</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <RefreshCw className="w-4 h-4 flex-shrink-0 text-cyan-500" />
              <div>
                <span className="font-medium text-foreground">IN ROTAZIONE</span>
                <span className="text-muted-foreground"> — Sta girando, è in movimento</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CircleDot className="w-4 h-4 flex-shrink-0 text-violet-500" />
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

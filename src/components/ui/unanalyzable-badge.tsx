import { EyeOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface UnanalyzableBadgeProps {
  className?: string;
}

export function UnanalyzableBadge({ className }: UnanalyzableBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "px-2.5 py-1.5 rounded-full flex items-center gap-1.5",
              "bg-zinc-800/80 border border-zinc-700",
              "text-muted-foreground cursor-help backdrop-blur-sm",
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold tracking-wider uppercase">
              Non analizzabile
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          className="max-w-[280px] text-center bg-zinc-900 border-zinc-700"
        >
          <p className="text-sm text-muted-foreground">
            Il contenuto proviene da una piattaforma chiusa (es. Social Media) 
            che non permette l'analisi AI. L'affidabilità dipende esclusivamente dall'utente.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

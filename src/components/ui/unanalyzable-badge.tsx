import { useState } from 'react';
import { EyeOff, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface UnanalyzableBadgeProps {
  className?: string;
}

export function UnanalyzableBadge({ className }: UnanalyzableBadgeProps) {
  const [open, setOpen] = useState(false);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            "px-2.5 py-1.5 rounded-full flex items-center gap-1.5",
            "bg-zinc-800/80 border border-zinc-700",
            "text-muted-foreground backdrop-blur-sm",
            "hover:bg-zinc-700/80 transition-colors",
            className
          )}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold tracking-wider uppercase">
            NON ANALIZZABILE
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {/* Custom close button */}
        <button 
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 ring-offset-background transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" />
        </button>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-muted-foreground" />
            Contenuto Non Analizzabile
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Il contenuto proviene da una <strong className="text-foreground">piattaforma chiusa</strong> (es. Instagram, Facebook, TikTok) che non permette l'analisi automatica del testo.
          </p>
          <p>
            L'affidabilità di questo post dipende esclusivamente dal <strong className="text-foreground">giudizio dell'utente</strong> che lo ha condiviso, non da una verifica AI.
          </p>
          <p className="text-xs pt-2 border-t border-border">
            Per questi contenuti, l'utente deve aggiungere un commento personale di almeno 30 parole.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

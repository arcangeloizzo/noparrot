import { X } from 'lucide-react';
import { CATEGORY_COLORS } from '@/config/categories';

interface DiarioFilterChipProps {
  macro: string;
  count?: number;
  onClear: () => void;
}

/**
 * Phase 4.5 — Chip rimovibile mostrato sopra il Diario Cognitivo quando un
 * pianeta della Nebulosa è selezionato come filtro.
 */
export function DiarioFilterChip({ macro, count, onClear }: DiarioFilterChipProps) {
  const color = CATEGORY_COLORS[macro] || 'hsl(var(--muted-foreground))';

  return (
    <div className="flex items-center justify-between gap-2 mb-3 animate-fade-in">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xs text-muted-foreground shrink-0">Filtro:</span>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-card hover:bg-muted transition-colors"
          style={{ borderColor: `${color}66`, color }}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="truncate">{macro}</span>
          {typeof count === 'number' && (
            <span className="opacity-70 tabular-nums">· {count}</span>
          )}
          <X className="w-3 h-3 shrink-0" aria-label="Rimuovi filtro" />
        </button>
      </div>
    </div>
  );
}
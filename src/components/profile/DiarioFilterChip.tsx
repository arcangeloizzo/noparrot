import { X, Hash } from 'lucide-react';
import { CATEGORY_COLORS } from '@/config/categories';

export type DiarioFilterChipVariant = 'macro' | 'topic';

interface DiarioFilterChipProps {
  /** Phase 4.6c — variante chip: 'macro' o 'topic'. Default 'macro' per back-compat. */
  variant?: DiarioFilterChipVariant;
  /** Etichetta visibile. Per 'macro' è il nome categoria; per 'topic' è il topic_label. */
  label?: string;
  /** Colore brand HEX. Se non passato, derivato da `macro` (back-compat). */
  color?: string;
  /** Back-compat 4.5: se passato e label non è specificato, viene usato come label e per derivare colore. */
  macro?: string;
  count?: number;
  onClear: () => void;
}

/**
 * Phase 4.5 / 4.6c — Chip rimovibile mostrato sopra il Diario Cognitivo.
 * Supporta due varianti:
 *  - 'macro': pallino colorato + nome macro (filtro categoria)
 *  - 'topic': icona hash + topic_label (filtro topic specifico)
 */
export function DiarioFilterChip({
  variant = 'macro',
  label,
  color,
  macro,
  count,
  onClear,
}: DiarioFilterChipProps) {
  const resolvedLabel = label ?? macro ?? '';
  const resolvedColor =
    color ?? (macro ? CATEGORY_COLORS[macro] : undefined) ?? 'hsl(var(--muted-foreground))';

  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-card hover:bg-muted transition-colors animate-fade-in max-w-full"
      style={{ borderColor: `${resolvedColor}66`, color: resolvedColor }}
      aria-label={`Rimuovi filtro ${variant === 'topic' ? 'topic' : 'categoria'} ${resolvedLabel}`}
    >
      {variant === 'topic' ? (
        <Hash className="w-3 h-3 shrink-0" />
      ) : (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: resolvedColor }}
        />
      )}
      <span className="truncate">{resolvedLabel}</span>
      {typeof count === 'number' && (
        <span className="opacity-70 tabular-nums">· {count}</span>
      )}
      <X className="w-3 h-3 shrink-0" aria-hidden="true" />
    </button>
  );
}
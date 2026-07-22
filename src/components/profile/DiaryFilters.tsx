export type DiaryFilterType = 'all' | 'original' | 'reshared' | 'gated';

interface DiaryFiltersProps {
  activeFilter: DiaryFilterType;
  onFilterChange: (filter: DiaryFilterType) => void;
}

const FILTERS: { id: DiaryFilterType; label: string }[] = [
  { id: 'all', label: 'Tutto' },
  { id: 'original', label: 'Originali' },
  { id: 'reshared', label: 'Ricondivisi' },
  { id: 'gated', label: 'Percorsi' },
];

/**
 * Filtri del Diario Cognitivo — pillole mono uppercase.
 * Aderisce alla grammatica `.pill-filter` della shell (index.css).
 */
export const DiaryFilters = ({ activeFilter, onFilterChange }: DiaryFiltersProps) => {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2"
      style={{ scrollbarWidth: "none" }}
    >
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onFilterChange(f.id)}
          className="pill-filter"
          data-active={activeFilter === f.id}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
};
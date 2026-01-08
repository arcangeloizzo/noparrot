import { cn } from "@/lib/utils";

export type DiaryFilterType = 'all' | 'original' | 'reshared' | 'gated';

interface DiaryFiltersProps {
  activeFilter: DiaryFilterType;
  onFilterChange: (filter: DiaryFilterType) => void;
}

const filters: { id: DiaryFilterType; label: string }[] = [
  { id: 'all', label: 'Tutto' },
  { id: 'original', label: 'Originali' },
  { id: 'reshared', label: 'Ricondivisi' },
  { id: 'gated', label: 'Percorsi' },
];

export const DiaryFilters = ({ activeFilter, onFilterChange }: DiaryFiltersProps) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={() => onFilterChange(filter.id)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200",
            activeFilter === filter.id
              ? "bg-white text-black"
              : "bg-[#1A2127] text-muted-foreground hover:text-foreground hover:bg-[#242B33]"
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
};
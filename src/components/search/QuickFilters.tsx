import { cn } from "@/lib/utils";

interface QuickFiltersProps {
  activeFilters: string[];
  onToggle: (filter: string) => void;
}

const filters = [
  { id: "today", label: "Oggi" },
  { id: "week", label: "Ultima settimana" },
  { id: "media", label: "Media" },
  { id: "links", label: "Solo link" },
  { id: "video", label: "Solo video" },
  { id: "high-trust", label: "Trust Score alto" },
];

export const QuickFilters = ({ activeFilters, onToggle }: QuickFiltersProps) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={() => onToggle(filter.id)}
          className={cn(
            "flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
            activeFilters.includes(filter.id)
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
};

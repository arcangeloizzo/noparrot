import { useState, useEffect } from "react";
import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecentSearchesProps {
  onSelect: (query: string) => void;
}

export const RecentSearches = ({ onSelect }: RecentSearchesProps) => {
  const [searches, setSearches] = useState<string[]>([]);

  useEffect(() => {
    const recent = JSON.parse(localStorage.getItem("recentSearches") || "[]");
    setSearches(recent);
  }, []);

  const handleRemove = (query: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = searches.filter(s => s !== query);
    setSearches(updated);
    localStorage.setItem("recentSearches", JSON.stringify(updated));
  };

  const handleClearAll = () => {
    setSearches([]);
    localStorage.removeItem("recentSearches");
  };

  if (searches.length === 0) {
    return null;
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Ricerche recenti</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancella cronologia
        </Button>
      </div>

      <div className="space-y-2">
        {searches.map((search, i) => (
          <button
            key={i}
            onClick={() => onSelect(search)}
            className="w-full flex items-center justify-between gap-3 p-3 hover:bg-muted rounded-lg transition-colors text-left group"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{search}</span>
            </div>
            <button
              onClick={(e) => handleRemove(search, e)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-background rounded"
              aria-label="Rimuovi"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </button>
        ))}
      </div>
    </div>
  );
};

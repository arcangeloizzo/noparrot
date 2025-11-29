import { useState, useRef, useEffect } from "react";
import { SearchIcon, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SearchSuggestions } from "./SearchSuggestions";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
}

export const SearchBar = ({ value, onChange, onSearch }: SearchBarProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSuggestions(false);
      } else if (e.key === "Enter" && value) {
        onSearch(value);
        setShowSuggestions(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [value, onSearch]);

  const handleClear = () => {
    onChange("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Cerca concetti o fatti..."
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          className="pl-12 pr-10 h-12 bg-muted border-0 rounded-full focus-visible:ring-1 focus-visible:ring-primary"
          aria-label="Campo di ricerca"
        />
        {value && (
          <button
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cancella ricerca"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {showSuggestions && (
        <SearchSuggestions
          query={value}
          onSelect={(suggestion) => {
            onChange(suggestion);
            onSearch(suggestion);
            setShowSuggestions(false);
          }}
          onClose={() => setShowSuggestions(false)}
        />
      )}
    </div>
  );
};

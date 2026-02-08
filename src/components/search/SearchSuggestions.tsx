import { useEffect, useState } from "react";
import { Clock, Hash, User, Link as LinkIcon } from "lucide-react";
import { useUserSearch } from "@/hooks/useUserSearch";
import { usePopularTopics } from "@/hooks/usePopularTopics";
import { usePopularSources } from "@/hooks/usePopularSources";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SearchSuggestionsProps {
  query: string;
  onSelect: (suggestion: string) => void;
  onClose: () => void;
}

export const SearchSuggestions = ({ query, onSelect, onClose }: SearchSuggestionsProps) => {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { data: users = [] } = useUserSearch(query);
  const { data: popularTopics = [] } = usePopularTopics();
  const { data: popularSources = [] } = usePopularSources();

  useEffect(() => {
    const recent = JSON.parse(localStorage.getItem("recentSearches") || "[]");
    setRecentSearches(recent.slice(0, 5));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-suggestions')) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const filteredTopics = query
    ? popularTopics.filter(t => t.toLowerCase().includes(query.toLowerCase()))
    : [];

  const filteredSources = query
    ? popularSources.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    : [];

  if (!query && recentSearches.length === 0) {
    return null;
  }

  return (
    <div className="search-suggestions absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-lg max-h-96 overflow-y-auto z-50">
      {/* Ricerche recenti */}
      {!query && recentSearches.length > 0 && (
        <div className="p-2">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Ricerche recenti</div>
          {recentSearches.map((search, i) => (
            <button
              key={i}
              onClick={() => onSelect(search)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-lg transition-colors text-left"
            >
              <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm">{search}</span>
            </button>
          ))}
        </div>
      )}

      {/* Utenti */}
      {users.length > 0 && (
        <div className="p-2 border-t border-border">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Persone</div>
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelect(`@${user.username}`)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-lg transition-colors"
            >
              <Avatar className="w-8 h-8">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">{user.full_name}</div>
                <div className="text-xs text-muted-foreground">@{user.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Argomenti */}
      {filteredTopics.length > 0 && (
        <div className="p-2 border-t border-border">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Argomenti</div>
          {filteredTopics.slice(0, 5).map((topic, i) => (
            <button
              key={i}
              onClick={() => onSelect(`#${topic}`)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-lg transition-colors text-left"
            >
              <Hash className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm">#{topic}</span>
            </button>
          ))}
        </div>
      )}

      {/* Fonti */}
      {filteredSources.length > 0 && (
        <div className="p-2 border-t border-border">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Fonti</div>
          {filteredSources.slice(0, 5).map((source, i) => (
            <button
              key={i}
              onClick={() => onSelect(`site:${source}`)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-lg transition-colors text-left"
            >
              <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm">{source}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

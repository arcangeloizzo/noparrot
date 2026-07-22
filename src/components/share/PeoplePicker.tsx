import { useMemo, useState, useEffect } from "react";
import { X, Search, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserSearch } from "@/hooks/useUserSearch";
import { useMessageThreads } from "@/hooks/useMessageThreads";
import { useAuth } from "@/contexts/AuthContext";

interface PeoplePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (selectedUserIds: string[]) => void;
}

interface Person {
  id: string;
  username: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

export const PeoplePicker = ({ isOpen, onClose, onSend }: PeoplePickerProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const { user } = useAuth();
  const { data: users, isLoading } = useUserSearch(searchQuery);
  const { data: threads = [] } = useMessageThreads();

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSelectedUserIds([]);
    }
  }, [isOpen]);

  // Recent people = distinct participants across threads (max 8), 1:1 first.
  const recents: Person[] = useMemo(() => {
    if (searchQuery.trim()) return [];
    const map = new Map<string, Person>();
    for (const t of threads) {
      for (const p of t.participants || []) {
        if (p.user_id === user?.id) continue;
        if (map.has(p.user_id)) continue;
        if (!p.profile) continue;
        map.set(p.user_id, {
          id: p.user_id,
          username: p.profile.username,
          full_name: p.profile.full_name,
          avatar_url: p.profile.avatar_url,
        });
        if (map.size >= 8) break;
      }
      if (map.size >= 8) break;
    }
    return Array.from(map.values());
  }, [threads, user?.id, searchQuery]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSend = () => {
    if (selectedUserIds.length === 0) return;
    onSend(selectedUserIds);
  };

  if (!isOpen) return null;

  const canSend = selectedUserIds.length > 0;
  const showingSearch = !!searchQuery.trim();
  const list: Person[] = showingSearch ? (users || []) as Person[] : recents;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: "var(--base)",
        color: "var(--txt)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* Header — shell grammar */}
      <div
        className="sticky top-0 z-10"
        style={{
          background: "linear-gradient(180deg, var(--base) 0%, rgba(14,21,34,0.9) 55%, rgba(14,21,34,0) 100%)",
        }}
      >
        <div className="flex items-center justify-between px-4" style={{ height: 56 }}>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="flex items-center justify-center rounded-full"
            style={{ width: 36, height: 36, color: "var(--txt-2)" }}
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="shell-title" style={{ fontSize: 18 }}>Nuovo messaggio</h2>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="pill-filter"
            data-active={canSend}
            style={{
              opacity: canSend ? 1 : 0.4,
              background: canSend ? "rgba(10,122,255,0.18)" : undefined,
              borderColor: canSend ? "rgba(10,122,255,0.45)" : undefined,
              color: canSend ? "#FFFFFF" : undefined,
            }}
          >
            Invia{canSend ? ` · ${selectedUserIds.length}` : ""}
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--txt-3)" }}
            />
            <input
              type="search"
              placeholder="Cerca persone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                height: 46,
                borderRadius: 23,
                paddingLeft: 44,
                paddingRight: 16,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "var(--txt)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-6">
        {!showingSearch && recents.length > 0 && (
          <div style={{ padding: "10px 20px 6px" }}>
            <span className="mono-eyebrow">Recenti</span>
          </div>
        )}
        {showingSearch && isLoading ? (
          <div className="flex items-center justify-center py-16" style={{ color: "var(--txt-3)" }}>
            Caricamento…
          </div>
        ) : list.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-center px-6" style={{ color: "var(--txt-3)" }}>
            {showingSearch ? "Nessun risultato" : "Nessun contatto recente. Cerca una persona per iniziare."}
          </div>
        ) : (
          <ul>
            {list.map((u) => {
              const isSelected = selectedUserIds.includes(u.id);
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className="w-full flex items-center gap-3 text-left transition-colors"
                    style={{
                      padding: "10px 20px",
                      background: isSelected ? "rgba(10,122,255,0.08)" : "transparent",
                    }}
                  >
                    <Avatar style={{ width: 42, height: 42 }}>
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback style={{ background: "rgba(255,255,255,0.08)", color: "var(--txt-2)", fontSize: 14, fontWeight: 600 }}>
                        {u.username?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ fontSize: 15, fontWeight: 600, color: "var(--txt)" }}>
                        {u.full_name || u.username}
                      </p>
                      <p
                        className="truncate"
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10.5,
                          letterSpacing: "0.05em",
                          color: "var(--txt-3)",
                          textTransform: "lowercase",
                        }}
                      >
                        @{u.username}
                      </p>
                    </div>
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: isSelected ? "#0A7AFF" : "transparent",
                        border: isSelected ? "none" : "1.5px solid rgba(255,255,255,0.18)",
                        transition: "background 0.15s ease, border-color 0.15s ease",
                      }}
                    >
                      {isSelected && <Check className="h-4 w-4" style={{ color: "#FFFFFF" }} />}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
import { useState } from "react";
import { X, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserSearch } from "@/hooks/useUserSearch";
import { Checkbox } from "@/components/ui/checkbox";

interface PeoplePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (selectedUserIds: string[]) => void;
}

export const PeoplePicker = ({ isOpen, onClose, onSend }: PeoplePickerProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const { data: users, isLoading } = useUserSearch(searchQuery);

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleSend = () => {
    onSend(Array.from(selectedUserIds));
    setSelectedUserIds(new Set());
    setSearchQuery("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="flex items-center justify-between px-4 h-14">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
          <h2 className="font-semibold">Invia a</h2>
          <Button
            variant="ghost"
            onClick={handleSend}
            disabled={selectedUserIds.size === 0}
            className="font-semibold text-primary disabled:text-muted-foreground"
          >
            Invia
          </Button>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cerca persone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Selected count */}
      {selectedUserIds.size > 0 && (
        <div className="px-4 py-2 bg-muted/50 text-sm text-muted-foreground">
          {selectedUserIds.size} {selectedUserIds.size === 1 ? 'persona selezionata' : 'persone selezionate'}
        </div>
      )}

      {/* User list */}
      <div className="overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">Caricamento...</p>
          </div>
        ) : users && users.length > 0 ? (
          <div className="divide-y divide-border">
            {users.map((user) => {
              const isSelected = selectedUserIds.has(user.id);
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 cursor-pointer"
                  onClick={() => toggleUser(user.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleUser(user.id)}
                    className="flex-shrink-0"
                  />

                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>
                      {user.username?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {user.full_name || user.username}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      @{user.username}
                    </p>
                  </div>

                  {isSelected && (
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        ) : searchQuery ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">Nessun risultato</p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">Cerca per iniziare</p>
          </div>
        )}
      </div>
    </div>
  );
};

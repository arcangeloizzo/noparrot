import { useEffect, useState } from 'react';
import { UserSearchResult } from '@/hooks/useUserSearch';
import { cn } from '@/lib/utils';

interface MentionDropdownProps {
  users: UserSearchResult[];
  onSelect: (user: UserSearchResult) => void;
  isLoading: boolean;
}

export const MentionDropdown = ({ users, onSelect, isLoading }: MentionDropdownProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [users]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (users.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % users.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
      } else if (e.key === 'Enter' && users[selectedIndex]) {
        e.preventDefault();
        onSelect(users[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [users, selectedIndex, onSelect]);

  if (isLoading) {
    return (
      <div className="absolute bottom-full left-0 mb-2 w-full max-w-sm bg-background border border-border rounded-lg shadow-lg p-3">
        <div className="text-sm text-muted-foreground">Ricerca...</div>
      </div>
    );
  }

  if (users.length === 0) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 w-full max-w-sm bg-background border border-border rounded-lg shadow-lg overflow-hidden">
      {users.map((user, index) => (
        <button
          key={user.id}
          onClick={() => onSelect(user)}
          className={cn(
            "w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left",
            selectedIndex === index && "bg-muted"
          )}
        >
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.full_name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
              {getInitials(user.full_name || user.username)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{user.full_name}</div>
            <div className="text-muted-foreground text-xs">@{user.username}</div>
          </div>
        </button>
      ))}
    </div>
  );
};

import { cn, getDisplayUsername } from '@/lib/utils';
import { UserSearchResult } from '@/hooks/useUserSearch';

interface MentionDropdownProps {
  users: UserSearchResult[];
  selectedIndex: number;
  onSelect: (user: UserSearchResult) => void;
  isLoading: boolean;
  position?: 'above' | 'below';
}

export const MentionDropdown = ({ 
  users, 
  selectedIndex, 
  onSelect, 
  isLoading, 
  position = 'above' 
}: MentionDropdownProps) => {
  const positionClass = position === 'below' 
    ? 'absolute top-full left-0 mt-2 z-50' 
    : 'absolute bottom-full left-0 mb-2 z-50';

  if (isLoading) {
    return (
      <div className={`${positionClass} w-full max-w-sm bg-background border border-border rounded-lg shadow-lg p-3`}>
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
    <div className={`${positionClass} w-full max-w-sm bg-background border border-border rounded-lg shadow-lg overflow-hidden z-50`}>
      {users.map((user, index) => (
        <button
          key={user.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(user);
          }}
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
            <div className="font-semibold text-sm">{user.full_name || getDisplayUsername(user.username)}</div>
            <div className="text-muted-foreground text-xs">@{getDisplayUsername(user.username)}</div>
          </div>
        </button>
      ))}
    </div>
  );
};

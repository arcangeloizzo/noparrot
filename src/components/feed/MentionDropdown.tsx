import { cn, getDisplayUsername } from '@/lib/utils';
import { UserSearchResult } from '@/hooks/useUserSearch';
import { useEffect, useRef, useState } from 'react';

interface MentionDropdownProps {
  users: UserSearchResult[];
  selectedIndex: number;
  onSelect: (user: UserSearchResult) => void;
  isLoading: boolean;
  position?: 'above' | 'below';
  containerRef?: React.RefObject<HTMLElement>;
}

export const MentionDropdown = ({ 
  users, 
  selectedIndex, 
  onSelect, 
  isLoading, 
  position = 'above',
  containerRef
}: MentionDropdownProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [actualPosition, setActualPosition] = useState(position);
  
  // Check if dropdown fits above, otherwise show below
  useEffect(() => {
    if (dropdownRef.current && containerRef?.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = dropdownRef.current.offsetHeight || 200;
      const spaceAbove = containerRect.top;
      
      if (position === 'above' && spaceAbove < dropdownHeight + 20) {
        setActualPosition('below');
      } else {
        setActualPosition(position);
      }
    }
  }, [users, position, containerRef]);

  // Force below on mobile when space is limited
  const positionClass = actualPosition === 'below' 
    ? 'left-0 right-0 mt-2' 
    : 'left-0 right-0 mb-2';
  
  const positionStyle = actualPosition === 'below'
    ? { top: '100%', bottom: 'auto' }
    : { bottom: '100%', top: 'auto' };

  if (isLoading) {
    return (
      <div 
        ref={dropdownRef}
        className={`absolute ${positionClass} max-w-sm bg-card border border-border rounded-lg shadow-xl p-3`}
        style={{ zIndex: 9999999, ...positionStyle }}
      >
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
    <div 
      ref={dropdownRef}
      className={`absolute ${positionClass} max-w-sm bg-card border-2 border-primary rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto`}
      style={{ zIndex: 9999999, ...positionStyle }}
    >
      {users.map((user, index) => (
        <div
          key={user.id}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect(user);
          }}
          className={cn(
            "w-full flex items-center gap-3 p-3 hover:bg-muted/80 transition-colors cursor-pointer",
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
        </div>
      ))}
    </div>
  );
};

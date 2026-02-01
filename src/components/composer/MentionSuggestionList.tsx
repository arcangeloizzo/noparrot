import { forwardRef, useEffect, useImperativeHandle, useState, useCallback } from 'react';
import { cn, getDisplayUsername } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Loader2 } from 'lucide-react';
import { haptics } from '@/lib/haptics';

interface MentionItem {
  id: string;
  label: string;
  username: string;
  avatar_url?: string | null;
  full_name?: string | null;
}

interface MentionSuggestionListProps {
  items: MentionItem[];
  command: (item: { id: string; label: string }) => void;
  query: string;
}

export const MentionSuggestionList = forwardRef<any, MentionSuggestionListProps>(
  ({ items, command, query }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    
    const selectItem = useCallback((index: number) => {
      const item = items[index];
      if (item) {
        haptics.selection();
        command({ id: item.id, label: item.label });
      }
    }, [items, command]);
    
    const upHandler = useCallback(() => {
      setSelectedIndex((prevIndex) => 
        (prevIndex + items.length - 1) % items.length
      );
    }, [items.length]);
    
    const downHandler = useCallback(() => {
      setSelectedIndex((prevIndex) => 
        (prevIndex + 1) % items.length
      );
    }, [items.length]);
    
    const enterHandler = useCallback(() => {
      selectItem(selectedIndex);
    }, [selectItem, selectedIndex]);
    
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);
    
    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'ArrowUp') {
          upHandler();
          return true;
        }
        
        if (event.key === 'ArrowDown') {
          downHandler();
          return true;
        }
        
        if (event.key === 'Enter') {
          enterHandler();
          return true;
        }
        
        return false;
      },
    }));
    
    const getInitials = (name: string) => {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };
    
    // Empty state with search prompt (X-style)
    if (items.length === 0) {
      return (
        <div className="w-[280px] py-4 px-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Search className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Trova chi stai cercando
              </p>
              <p className="text-xs text-muted-foreground">
                Cerca l'utente che vuoi menzionare.
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="w-[280px] max-h-[280px] overflow-y-auto">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 transition-colors',
              'hover:bg-zinc-800/70 active:bg-zinc-700/50',
              selectedIndex === index && 'bg-zinc-800/70'
            )}
          >
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage src={item.avatar_url || undefined} className="object-cover" />
              <AvatarFallback className="bg-zinc-700 text-zinc-300 text-sm font-medium">
                {getInitials(item.full_name || item.username)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-foreground truncate">
                {item.full_name || getDisplayUsername(item.username)}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                @{getDisplayUsername(item.username)}
              </p>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

MentionSuggestionList.displayName = 'MentionSuggestionList';

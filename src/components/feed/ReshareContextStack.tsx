import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Repeat } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn, getDisplayUsername } from '@/lib/utils';
import type { ContextItem } from '@/hooks/useReshareContextStack';

interface ReshareContextStackProps {
  stack: ContextItem[];
}

const MAX_COLLAPSED_ITEMS = 3;

export const ReshareContextStack = ({ stack }: ReshareContextStackProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  if (!stack.length) return null;

  const visibleItems = expanded ? stack : stack.slice(0, MAX_COLLAPSED_ITEMS);
  const hasMore = stack.length > MAX_COLLAPSED_ITEMS;

  const handleItemClick = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/post/${postId}`);
  };

  const getAvatarContent = (author: ContextItem['author']) => {
    if (author.avatar_url) {
      return (
        <img 
          src={author.avatar_url}
          alt={author.full_name || author.username}
          className="w-full h-full object-cover"
        />
      );
    }
    
    const initial = (author.full_name || author.username).charAt(0).toUpperCase();
    const bgColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500'];
    const colorIndex = author.username.charCodeAt(0) % bgColors.length;
    
    return (
      <div className={`${bgColors[colorIndex]} w-full h-full flex items-center justify-center text-white font-bold text-[10px]`}>
        {initial}
      </div>
    );
  };

  return (
    <div className="mt-4 pt-2">
      {/* Header - flusso di condivisione */}
      <div className="flex items-center gap-1.5 mb-3 text-white/40">
        <Repeat className="w-3 h-3" />
        <span className="text-[11px] font-medium">ha condiviso</span>
        <ChevronDown className="w-3 h-3" />
      </div>

      {/* Context Items with thread line */}
      <div className="relative">
        {/* Thread line verticale */}
        <div className="absolute left-[11px] top-3 bottom-3 w-px bg-white/15" />

        <div className="space-y-1">
          {visibleItems.map((item, index) => {
            const timeAgo = formatDistanceToNow(new Date(item.created_at), { 
              addSuffix: false, 
              locale: it 
            });
            const isLastVisible = index === visibleItems.length - 1;
            const isOriginal = index === stack.length - 1 && (expanded || !hasMore);

            return (
              <div key={item.id} className="relative flex items-stretch">
                {/* Connettore visivo */}
                <div className="flex items-start pt-2.5 w-6 flex-shrink-0 z-10">
                  <span className={cn(
                    "text-white/25 text-xs font-mono leading-none",
                    isLastVisible && "text-white/35"
                  )}>
                    {isLastVisible ? '└' : '├'}
                  </span>
                </div>

                {/* Card contenuto */}
                <button
                  onClick={(e) => handleItemClick(item.id, e)}
                  className="flex-1 text-left bg-white/5 hover:bg-white/10 rounded-xl p-2.5 transition-colors active:scale-[0.99]"
                >
                  <div className="flex items-start gap-2">
                    {/* Small Avatar */}
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                      {getAvatarContent(item.author)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Username + Time + Badge */}
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-white/80 truncate">
                          {getDisplayUsername(item.author.username)}
                        </span>
                        <span className="text-[10px] text-white/40">·</span>
                        <span className="text-[10px] text-white/40 flex-shrink-0">
                          {timeAgo}
                        </span>
                        {isOriginal && (
                          <span className="ml-auto text-[9px] px-1.5 py-0.5 bg-white/10 rounded-full text-white/50 flex-shrink-0">
                            originale
                          </span>
                        )}
                      </div>

                      {/* Comment snippet */}
                      <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">
                        {item.content || 'Ha condiviso'}
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expand/Collapse Button */}
      {hasMore && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 text-white/50 hover:text-white/70 transition-colors"
        >
          <span className="text-xs font-medium">
            {expanded ? 'Mostra meno' : `Mostra tutto (${stack.length})`}
          </span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
};

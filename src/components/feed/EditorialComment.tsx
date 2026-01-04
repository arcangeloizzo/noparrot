import { cn } from "@/lib/utils";
import { EDITORIAL } from "@/config/brand";

interface EditorialCommentProps {
  content: string;
  createdAt?: string;
  className?: string;
}

/**
 * EditorialComment - Commento ufficiale della redazione IL PUNTO
 * Stile distintivo: avatar con ◉, bordo accent, sfondo speciale
 */
export const EditorialComment = ({ content, createdAt, className }: EditorialCommentProps) => {
  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'ora';
    if (diffHours < 24) return `${diffHours}h fa`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}g fa`;
    return past.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };

  return (
    <div className={cn(
      "bg-[#0A7AFF]/5 border-l-2 border-[#0A7AFF] p-4 rounded-r-lg",
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {/* Editorial Avatar - Cerchio con ◉ */}
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: EDITORIAL.AVATAR_BG }}
        >
          <span 
            className="text-sm font-bold"
            style={{ color: EDITORIAL.AVATAR_SYMBOL_COLOR }}
          >
            {EDITORIAL.SYMBOL}
          </span>
        </div>
        
        {/* Name and Handle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white font-mono text-sm">
              {EDITORIAL.SYMBOL} {EDITORIAL.NAME}
            </span>
            <span className="text-gray-500 text-xs">
              {EDITORIAL.HANDLE}
            </span>
          </div>
          {createdAt && (
            <span className="text-xs text-gray-500">
              {formatTimeAgo(createdAt)}
            </span>
          )}
        </div>
      </div>

      {/* Label */}
      <div className="mb-2">
        <span className="text-[10px] uppercase tracking-widest text-[#0A7AFF] font-semibold">
          Nota della redazione
        </span>
      </div>
      
      {/* Content */}
      <p className="text-gray-200 text-sm leading-relaxed">
        {content}
      </p>
    </div>
  );
};

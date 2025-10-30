import { cn } from '@/lib/utils';

interface CommentMetricsBarProps {
  commentsCount: number;
  likesCount: number;
  activeFilter: 'relevance' | 'recent' | 'top';
  onFilterChange: (filter: 'relevance' | 'recent' | 'top') => void;
}

export const CommentMetricsBar = ({
  commentsCount,
  likesCount,
  activeFilter,
  onFilterChange
}: CommentMetricsBarProps) => {
  return (
    <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-20 border-b border-border">
      {/* Metriche */}
      <div className="px-4 py-3 flex items-center gap-4 text-sm text-muted-foreground border-b border-border/50">
        <span>
          <span className="font-semibold text-foreground">{commentsCount}</span> rispost{commentsCount === 1 ? 'a' : 'e'}
        </span>
        {likesCount > 0 && (
          <>
            <span>·</span>
            <span>
              <span className="font-semibold text-foreground">{likesCount}</span> mi piace
            </span>
          </>
        )}
      </div>

      {/* Filtri */}
      <div className="flex items-center border-b border-border/50">
        <button
          onClick={() => onFilterChange('relevance')}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors relative",
            activeFilter === 'relevance'
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Pertinenza
          {activeFilter === 'relevance' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => onFilterChange('recent')}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors relative",
            activeFilter === 'recent'
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Recenti
          {activeFilter === 'recent' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => onFilterChange('top')}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors relative",
            activeFilter === 'top'
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Top
          {activeFilter === 'top' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>
    </div>
  );
};

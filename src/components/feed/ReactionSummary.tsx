import * as React from "react";
import { cn } from "@/lib/utils";
import { reactionToEmoji, type ReactionType } from "@/components/ui/reaction-picker";

interface ReactionCount {
  type: ReactionType;
  count: number;
}

interface ReactionSummaryProps {
  reactions: ReactionCount[];
  totalCount: number;
  onClick?: () => void;
  className?: string;
  /** Show count next to emoji stack */
  showCount?: boolean;
}

/**
 * ReactionSummary - Shows up to 3 overlapping emoji icons with total count
 * Displays the most frequent reaction types first
 */
export const ReactionSummary = React.memo(({
  reactions,
  totalCount,
  onClick,
  className,
  showCount = true,
}: ReactionSummaryProps) => {
  // Sort by count (descending) and take top 3
  const topReactions = React.useMemo(() => {
    return [...reactions]
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [reactions]);

  if (totalCount === 0 || topReactions.length === 0) {
    return null;
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full",
        "bg-white/5 hover:bg-white/10 transition-colors",
        "cursor-pointer active:scale-95",
        className
      )}
    >
      {/* Overlapping Emoji Stack */}
      <div className="flex items-center">
        {topReactions.map((reaction, index) => (
          <span
            key={reaction.type}
            className={cn(
              "w-5 h-5 flex items-center justify-center text-sm",
              "bg-popover border border-border/30 rounded-full",
              index > 0 && "-ml-1.5"
            )}
            style={{ zIndex: topReactions.length - index }}
          >
            {reactionToEmoji(reaction.type)}
          </span>
        ))}
      </div>

      {/* Total Count */}
      {showCount && (
        <span className="text-xs font-medium text-white/70 ml-0.5">
          {totalCount}
        </span>
      )}
    </button>
  );
});

ReactionSummary.displayName = "ReactionSummary";

/**
 * Helper to convert byType record to ReactionCount array
 */
export const getReactionCounts = (
  byType: Record<ReactionType, number> | undefined
): ReactionCount[] => {
  if (!byType) return [];
  
  return Object.entries(byType).map(([type, count]) => ({
    type: type as ReactionType,
    count: count as number,
  }));
};

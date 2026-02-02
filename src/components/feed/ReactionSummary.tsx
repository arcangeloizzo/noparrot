import * as React from "react";
import { cn } from "@/lib/utils";
import { type ReactionType } from "@/components/ui/reaction-picker";

interface ReactionCount {
  type: ReactionType;
  count: number;
}

interface ReactionSummaryProps {
  reactions: ReactionCount[];
  totalCount: number;
  onClick?: () => void;
  className?: string;
  /** Show count next to text (default true) */
  showCount?: boolean;
}

/**
 * ReactionSummary - Instagram-style text count that opens reactions drawer
 * Displays "{count} reazioni" as clickable text
 */
export const ReactionSummary = React.memo(({
  reactions,
  totalCount,
  onClick,
  className,
  showCount = true,
}: ReactionSummaryProps) => {
  if (totalCount === 0) {
    return null;
  }

  const label = totalCount === 1 ? 'reazione' : 'reazioni';

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "text-sm text-muted-foreground hover:text-foreground transition-colors",
        "cursor-pointer active:opacity-70 select-none",
        className
      )}
    >
      {showCount && (
        <span className="font-medium">{totalCount}</span>
      )}
      {showCount && <span className="ml-1">{label}</span>}
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

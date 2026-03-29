import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PollData, useVotePoll } from "@/hooks/usePollVote";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface PollWidgetProps {
  poll: PollData;
  postId: string;
  readOnly?: boolean;
  onVoteAttempt?: (optionId: string) => Promise<boolean>;
}

const PollWidgetInner = ({ poll, postId, readOnly = false, onVoteAttempt }: PollWidgetProps) => {
  const votePoll = useVotePoll();
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);

  const hasVoted = poll.user_vote_option_ids.length > 0;
  const showResults = hasVoted || poll.is_expired || readOnly;

  const handleVote = async (optionId: string) => {
    if (readOnly || poll.is_expired || votePoll.isPending) return;

    if (onVoteAttempt) {
      setPendingOptionId(optionId);
      const allowed = await onVoteAttempt(optionId);
      setPendingOptionId(null);
      if (!allowed) return;
    }

    votePoll.mutate({ pollId: poll.id, optionId, postId, allowMultiple: poll.allow_multiple });
  };

  const expiresLabel = poll.expires_at
    ? poll.is_expired
      ? 'Sondaggio terminato'
      : `Termina ${formatDistanceToNow(new Date(poll.expires_at), { addSuffix: true, locale: it })}`
    : null;

  return (
    <div className="space-y-2 py-2">
      <AnimatePresence mode="wait">
        {poll.options.map((option) => {
          const percentage = poll.total_votes > 0
            ? Math.round((option.vote_count / poll.total_votes) * 100)
            : 0;
          const isSelected = poll.user_vote_option_ids.includes(option.id);
          const isPending = pendingOptionId === option.id;
          const canStillVote = poll.allow_multiple && !poll.is_expired && !readOnly;

          return (
            <motion.button
              key={option.id}
              type="button"
              disabled={readOnly || poll.is_expired || votePoll.isPending}
              onClick={() => handleVote(option.id)}
              className={cn(
                "relative w-full rounded-xl overflow-hidden text-left transition-all",
                "border",
                showResults
                  ? isSelected
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/40 bg-muted/20"
                  : "border-border/60 bg-card hover:bg-muted/30 hover:border-primary/30 active:scale-[0.98]",
                (readOnly || poll.is_expired) && !canStillVote && "cursor-default",
                isPending && "animate-pulse"
              )}
              whileTap={!readOnly && !poll.is_expired ? { scale: 0.98 } : undefined}
              layout
            >
              {/* Progress bar background */}
              {showResults && (
                <motion.div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-xl",
                    isSelected ? "bg-primary/15" : "bg-muted/40"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              )}

              {/* Content */}
              <div className="relative z-10 flex items-center justify-between px-3.5 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Show checkbox for multi-select, check icon for single */}
                  {poll.allow_multiple ? (
                    <Checkbox
                      checked={isSelected}
                      className="pointer-events-none h-4 w-4 flex-shrink-0"
                      tabIndex={-1}
                    />
                  ) : (
                    showResults && isSelected && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )
                  )}
                  <span className={cn(
                    "text-sm truncate",
                    isSelected ? "font-semibold text-foreground" : "text-foreground/80"
                  )}>
                    {option.label}
                  </span>
                </div>
                {showResults && (
                  <span className={cn(
                    "text-sm font-bold tabular-nums flex-shrink-0 ml-2",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )}>
                    {percentage}%
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>

      {/* Footer: total votes + expiry */}
      <div className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BarChart3 className="h-3 w-3" />
          <span>
            {poll.total_votes} {poll.total_votes === 1 ? 'voto' : 'voti'}
            {poll.allow_multiple && ' · Scelta multipla'}
          </span>
        </div>
        {expiresLabel && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{expiresLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const PollWidget = memo(PollWidgetInner);
PollWidget.displayName = 'PollWidget';

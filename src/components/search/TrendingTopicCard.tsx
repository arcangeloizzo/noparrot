import { ArrowRight, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendingTopicCardProps {
  title: string;
  summary: string;
  badgeCategory?: string;
  postCount: number;
  commentCount?: number;
  onClick: () => void;
}

export const TrendingTopicCard = ({
  title,
  summary,
  badgeCategory,
  postCount,
  commentCount,
  onClick,
}: TrendingTopicCardProps) => {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-[#151F2B] rounded-xl p-4 cursor-pointer",
        "border border-white/5 transition-all hover:border-white/10 hover:bg-[#1A2633]"
      )}
    >
      {badgeCategory && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary mb-2 inline-block">
          {badgeCategory}
        </span>
      )}
      <h3 className="text-lg font-bold text-white mb-2 leading-tight">
        {title}
      </h3>
      <p className="text-sm text-gray-400 leading-relaxed mb-3">
        {summary}
      </p>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-primary hover:underline flex items-center gap-1">
          Vedi {postCount} post
          <ArrowRight className="w-4 h-4" />
        </span>
        {commentCount !== undefined && commentCount > 0 && (
          <span className="text-muted-foreground flex items-center gap-1">
            <MessageCircle className="w-3.5 h-3.5" />
            {commentCount}
          </span>
        )}
      </div>
    </div>
  );
};

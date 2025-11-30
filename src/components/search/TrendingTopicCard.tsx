import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendingTopicCardProps {
  title: string;
  summary: string;
  postCount: number;
  onClick: () => void;
}

export const TrendingTopicCard = ({
  title,
  summary,
  postCount,
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
      <h3 className="text-lg font-bold text-white mb-2 leading-tight">
        {title}
      </h3>
      <p className="text-sm text-gray-400 leading-relaxed mb-3">
        {summary}
      </p>
      <div className="flex items-center gap-2 text-sm text-primary hover:underline">
        <span>Vedi {postCount} post</span>
        <ArrowRight className="w-4 h-4" />
      </div>
    </div>
  );
};

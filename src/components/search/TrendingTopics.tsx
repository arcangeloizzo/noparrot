import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Hash } from "lucide-react";

interface TrendingTopicsProps {
  onSelect: (query: string) => void;
}

export const TrendingTopics = ({ onSelect }: TrendingTopicsProps) => {
  const { data: trending } = useQuery({
    queryKey: ["trending-topics"],
    queryFn: async () => {
      // Get recent posts with topics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: posts, error } = await supabase
        .from("posts")
        .select("topic_tag")
        .not("topic_tag", "is", null)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Count topic occurrences
      const topicCounts = (posts || []).reduce((acc: Record<string, number>, post) => {
        const tag = post.topic_tag;
        if (tag) {
          acc[tag] = (acc[tag] || 0) + 1;
        }
        return acc;
      }, {});

      // Convert to array and sort by count
      return Object.entries(topicCounts)
        .map(([topic, posts]) => ({ topic, posts, trending: posts > 5 }))
        .sort((a, b) => b.posts - a.posts)
        .slice(0, 8);
    },
  });

  if (!trending || trending.length === 0) {
    return null;
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Tendenze per te</h3>
      </div>

      <div className="space-y-2">
        {trending.map((trend, i) => (
          <button
            key={i}
            onClick={() => onSelect(`#${trend.topic}`)}
            className="w-full flex items-start gap-3 p-3 hover:bg-muted rounded-lg transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              {trend.trending ? (
                <TrendingUp className="w-5 h-5 text-primary" />
              ) : (
                <Hash className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold group-hover:text-primary transition-colors truncate">
                {trend.topic}
              </div>
              <div className="text-sm text-muted-foreground">
                {trend.posts} post
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

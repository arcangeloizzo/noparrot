import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Hash, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

interface TopicsResultsProps {
  query: string;
}

export const TopicsResults = ({ query }: TopicsResultsProps) => {
  const { data: topics, isLoading } = useQuery({
    queryKey: ["search-topics", query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      // Get all posts with topics that match the query
      const { data: posts, error } = await supabase
        .from("posts")
        .select("topic_tag")
        .not("topic_tag", "is", null)
        .ilike("topic_tag", `%${query}%`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Count occurrences of each topic
      const topicCounts = (posts || []).reduce((acc: Record<string, number>, post) => {
        const tag = post.topic_tag;
        if (tag) {
          acc[tag] = (acc[tag] || 0) + 1;
        }
        return acc;
      }, {});

      // Convert to array and sort by count
      return Object.entries(topicCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
    },
    enabled: !!query && query.length >= 2,
  });

  if (isLoading || !topics || topics.length === 0) {
    return null;
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-3">
        {topics.map((topic) => (
          <Link
            key={topic.tag}
            to={`/search?q=${encodeURIComponent(`#${topic.tag}`)}&tab=posts`}
            className="flex items-start gap-3 p-4 bg-muted rounded-xl hover:bg-muted/80 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              {topic.count > 10 ? (
                <TrendingUp className="w-5 h-5 text-primary" />
              ) : (
                <Hash className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">#{topic.tag}</div>
              <div className="text-xs text-muted-foreground">
                {topic.count} post
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

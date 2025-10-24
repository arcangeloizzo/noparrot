import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FeedCard } from "@/components/feed/FeedCard";
import type { SearchFiltersState } from "../SearchFilters";
import { Skeleton } from "@/components/ui/skeleton";

interface PostsResultsProps {
  query: string;
  filters: SearchFiltersState;
}

export const PostsResults = ({ query, filters }: PostsResultsProps) => {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["search-posts", query, filters],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      let queryBuilder = supabase
        .from("posts")
        .select(`
          *,
          profiles!posts_author_id_fkey (
            id,
            username,
            full_name,
            avatar_url
          ),
          quoted_post:posts!posts_quoted_post_id_fkey (
            id,
            content,
            created_at,
            profiles!posts_author_id_fkey (
              username,
              full_name,
              avatar_url
            )
          )
        `)
        .order("created_at", { ascending: false });

      // Search in content, title, or topic
      const searchPattern = `%${query}%`;
      queryBuilder = queryBuilder.or(
        `content.ilike.${searchPattern},shared_title.ilike.${searchPattern},topic_tag.ilike.${searchPattern}`
      );

      // Apply date range filter
      const now = new Date();
      if (filters.dateRange === "today") {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        queryBuilder = queryBuilder.gte("created_at", today.toISOString());
      } else if (filters.dateRange === "7days") {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        queryBuilder = queryBuilder.gte("created_at", weekAgo.toISOString());
      } else if (filters.dateRange === "30days") {
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        queryBuilder = queryBuilder.gte("created_at", monthAgo.toISOString());
      }

      // Apply trust score filter
      if (filters.trustScore === "high") {
        queryBuilder = queryBuilder.eq("trust_level", "ALTO");
      } else if (filters.trustScore === "medium") {
        queryBuilder = queryBuilder.in("trust_level", ["MEDIO", "ALTO"]);
      }

      queryBuilder = queryBuilder.limit(50);

      const { data, error } = await queryBuilder;

      if (error) {
        console.error("Search error:", error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!query && query.length >= 2,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0">
      {posts.map((post: any) => (
        <FeedCard key={post.id} post={post} />
      ))}
    </div>
  );
};

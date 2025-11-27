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
  const { data: posts, isLoading, error } = useQuery({
    queryKey: ["search-posts", query, filters],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      console.log('🔍 [PostsResults] Searching for:', query);

      let queryBuilder = supabase
        .from("posts")
        .select(`
          *,
          author:profiles!author_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          reactions (
            reaction_type,
            user_id
          ),
          comments(count),
          quoted_post:posts!quoted_post_id (
            id,
            content,
            created_at,
            author:profiles!author_id (
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
        console.error("❌ [PostsResults] Search error:", error);
        throw error;
      }
      
      console.log('✅ [PostsResults] Found', data?.length || 0, 'posts');
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

  if (error) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Errore nella ricerca</p>
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Nessun post trovato per "{query}"</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {posts.map((post: any) => {
        // Format post data to match FeedCard expectations
        const formattedPost = {
          ...post,
          reactions: {
            hearts: post.reactions?.filter((r: any) => r.reaction_type === 'heart').length || 0,
            comments: post.comments?.[0]?.count || 0
          },
          user_reactions: {
            has_hearted: false,
            has_bookmarked: false
          }
        };
        return <FeedCard key={post.id} post={formattedPost} />;
      })}
    </div>
  );
};

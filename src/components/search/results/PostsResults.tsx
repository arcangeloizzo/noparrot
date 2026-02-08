import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SearchFiltersState } from "../SearchFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface PostsResultsProps {
  query: string;
  filters: SearchFiltersState;
  searchType?: "text" | "category";
}

// Utility to extract hostname from URL
const getHostnameFromUrl = (url: string | undefined): string => {
  if (!url) return 'Fonte';
  try {
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    return new URL(urlWithProtocol).hostname;
  } catch {
    return 'Fonte';
  }
};

// Component for individual search result card
const SearchResultCard = ({ post, query }: { post: any; query: string }) => {
  const navigate = useNavigate();
  
  const highlightText = (text: string) => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-[#0A7AFF]/40 text-foreground px-0.5 rounded">
          {part}
        </mark>
      ) : part
    );
  };
  
  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: it
  });

  const hasContent = post.content && post.content.trim().length > 0;
  const hasSharedLink = post.shared_url;
  
  return (
    <div 
      onClick={() => navigate(`/post/${post.id}`)}
      className="bg-[#141A1E] border border-white/10 rounded-2xl p-4 cursor-pointer hover:bg-[#1A2329] transition-colors"
    >
      {/* Author */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
          {post.author?.avatar_url ? (
            <img src={post.author.avatar_url} className="w-full h-full object-cover" alt="" />
          ) : (
            <span className="text-sm font-semibold">
              {(post.author?.full_name || post.author?.username || 'U').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1">
          <div className="font-medium">{post.author?.full_name || post.author?.username || 'Utente'}</div>
          <div className="text-xs text-muted-foreground">{timeAgo}</div>
        </div>
      </div>
      
      {/* Content with highlighting */}
      {hasContent && (
        <p className="text-sm text-foreground/90 line-clamp-4 mb-3">
          {highlightText(post.content || '')}
        </p>
      )}

      {/* Link preview for posts without content */}
      {!hasContent && hasSharedLink && (
        <div className="border border-white/5 rounded-xl overflow-hidden mb-3 bg-[#0F1417]">
          {post.preview_img && (
            <div className="w-full aspect-video bg-muted/50">
              <img 
                src={post.preview_img} 
                alt="Preview" 
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="p-3">
            <p className="text-xs text-muted-foreground mb-1">
              {getHostnameFromUrl(post.shared_url)}
            </p>
            <h4 className="text-sm font-medium text-foreground line-clamp-2">
              {post.shared_title || 'Link condiviso'}
            </h4>
          </div>
        </div>
      )}
      
      {/* Category */}
      {post.category && (
        <span className="text-xs bg-[#2AD2C9]/20 text-[#2AD2C9] px-2 py-0.5 rounded-full">
          {post.category}
        </span>
      )}
    </div>
  );
};

export const PostsResults = ({ query, filters, searchType }: PostsResultsProps) => {
  const { data: posts, isLoading, error } = useQuery({
    queryKey: ["search-posts", query, filters],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      console.log('🔍 [PostsResults] Searching for:', query);

      let queryBuilder = supabase
        .from("posts")
        .select(`
          *,
          author:public_profiles!author_id (
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
            author:public_profiles!author_id (
              username,
              full_name,
              avatar_url
            )
          )
        `)
        .order("created_at", { ascending: false });

      // Search logic based on type
      if (searchType === "category") {
        // Exact category match
        queryBuilder = queryBuilder.eq("category", query);
      } else {
        // Text search in content, title, topic, and category
        const searchPattern = `%${query}%`;
        queryBuilder = queryBuilder.or(
          `content.ilike.${searchPattern},shared_title.ilike.${searchPattern},topic_tag.ilike.${searchPattern},category.ilike.${searchPattern}`
        );
      }

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
    <div className="space-y-3 p-4">
      {posts.map((post: any) => (
        <SearchResultCard key={post.id} post={post} query={query} />
      ))}
    </div>
  );
};

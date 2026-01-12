import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TrendingTopic {
  topic_id: string;
  title: string;
  summary: string;
  badge_category?: string;
  stats: { posts: number; comments: number; likes: number };
  top_post_ids: string[];
}

export interface TrendingResponse {
  mode: 'TRENDING' | 'RECENT_POSTS';
  topics?: TrendingTopic[];
  recentPosts?: Array<{ id: string; content: string; shared_title?: string }>;
  generatedAt: string;
  validUntil: string;
}

export const useTrendingTopics = () => {
  return useQuery({
    queryKey: ['trending-topics'],
    queryFn: async (): Promise<TrendingResponse> => {
      const { data, error } = await supabase.functions.invoke('get-trending-topics');
      
      if (error) {
        console.error('[useTrendingTopics] Error:', error);
        throw error;
      }
      
      return data as TrendingResponse;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (cache is server-side)
    retry: 1,
  });
};

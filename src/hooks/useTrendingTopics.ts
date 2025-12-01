import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TrendingTopic {
  category: string;
  postCount: number;
  summary: string;
}

export const useTrendingTopics = () => {
  return useQuery({
    queryKey: ['trending-topics'],
    queryFn: async () => {
      // Get posts from last 7 days grouped by category
      const { data: posts, error } = await supabase
        .from('posts')
        .select('category, content, created_at')
        .not('category', 'is', null)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by category and count
      const categoryMap = new Map<string, { count: number; contents: string[] }>();
      
      posts?.forEach(post => {
        if (post.category) {
          const existing = categoryMap.get(post.category);
          if (existing) {
            existing.count++;
            existing.contents.push(post.content);
          } else {
            categoryMap.set(post.category, { count: 1, contents: [post.content] });
          }
        }
      });

      // Convert to array and sort by count
      const trending: TrendingTopic[] = Array.from(categoryMap.entries())
        .map(([category, data]) => ({
          category,
          postCount: data.count,
          summary: `La community sta discutendo attivamente su temi di ${category.toLowerCase()}. ${data.count} post negli ultimi 7 giorni.`
        }))
        .sort((a, b) => b.postCount - a.postCount)
        .slice(0, 8);

      return trending;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

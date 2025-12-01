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
            if (existing.contents.length < 10) {
              existing.contents.push(post.content);
            }
          } else {
            categoryMap.set(post.category, { count: 1, contents: [post.content] });
          }
        }
      });

      // Sort by count and get top 8
      const topCategories = Array.from(categoryMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 8);

      // Generate AI summaries for each category
      const trending: TrendingTopic[] = await Promise.all(
        topCategories.map(async ([category, data]) => {
          let summary = `La community sta discutendo attivamente su temi di ${category.toLowerCase()}. ${data.count} post negli ultimi 7 giorni.`;
          
          try {
            const { data: summaryData, error: summaryError } = await supabase.functions.invoke(
              'generate-trending-summary',
              {
                body: {
                  category,
                  contents: data.contents.filter(c => c && c.trim().length > 0)
                }
              }
            );

            if (!summaryError && summaryData?.summary) {
              summary = summaryData.summary;
            } else if (summaryError) {
              console.warn(`[useTrendingTopics] Failed to generate summary for ${category}:`, summaryError);
            }
          } catch (err) {
            console.warn(`[useTrendingTopics] Error generating summary for ${category}:`, err);
          }

          return {
            category,
            postCount: data.count,
            summary
          };
        })
      );

      return trending;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

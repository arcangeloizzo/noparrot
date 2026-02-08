import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const usePopularTopics = () => {
  return useQuery({
    queryKey: ['popular-topics'],
    queryFn: async () => {
      const { data: posts, error } = await supabase
        .from('posts')
        .select('category')
        .not('category', 'is', null)
        .limit(1000);

      if (error) throw error;

      // Count occurrences
      const categoryCount = new Map<string, number>();
      posts?.forEach(post => {
        if (post.category) {
          categoryCount.set(post.category, (categoryCount.get(post.category) || 0) + 1);
        }
      });

      // Sort by count and return top 10
      return Array.from(categoryCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([category]) => category);
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
};

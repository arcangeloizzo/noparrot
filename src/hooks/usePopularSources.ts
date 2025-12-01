import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const usePopularSources = () => {
  return useQuery({
    queryKey: ['popular-sources'],
    queryFn: async () => {
      const { data: posts, error } = await supabase
        .from('posts')
        .select('shared_url')
        .not('shared_url', 'is', null)
        .limit(1000);

      if (error) throw error;

      // Extract domains and count
      const domainCount = new Map<string, number>();
      posts?.forEach(post => {
        if (post.shared_url) {
          try {
            const url = new URL(post.shared_url);
            const domain = url.hostname.replace('www.', '');
            domainCount.set(domain, (domainCount.get(domain) || 0) + 1);
          } catch (e) {
            // Invalid URL, skip
          }
        }
      });

      // Sort by count and return top 10
      return Array.from(domainCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([domain]) => domain);
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
};

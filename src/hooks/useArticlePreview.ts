import { useQuery } from '@tanstack/react-query';
import { fetchArticlePreview } from '@/lib/ai-helpers';

interface ArticlePreview {
  title?: string;
  description?: string;
  image?: string;
  platform?: string;
  author_username?: string;
  is_verified?: boolean;
  content?: string;
  summary?: string;
  excerpt?: string;
  popularity?: number;
}

/**
 * Hook for fetching and caching article previews with React Query.
 * Uses aggressive caching (30 min staleTime, 1 hour gcTime) to minimize network requests.
 */
export function useArticlePreview(url: string | null | undefined) {
  return useQuery({
    queryKey: ['article-preview', url],
    queryFn: async (): Promise<ArticlePreview | null> => {
      if (!url) return null;
      
      try {
        const preview = await fetchArticlePreview(url);
        if (!preview) return null;
        
        // Detect platform from URL
        const platform = detectPlatformFromUrl(url);
        
        return {
          ...(preview as ArticlePreview),
          platform: (preview as any)?.platform || platform,
        };
      } catch (error) {
        console.warn('[useArticlePreview] Error fetching preview:', error);
        return null;
      }
    },
    enabled: !!url,
    staleTime: 1000 * 60 * 5,         // 5 minutes - allow refetch if data might be stale
    gcTime: 1000 * 60 * 60,           // 1 hour in memory
    refetchOnWindowFocus: false,      // Don't refetch on tab focus
    retry: 1,
  });
}

function detectPlatformFromUrl(url: string): string | undefined {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('tiktok')) return 'tiktok';
    if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'youtube';
    if (hostname.includes('twitter') || hostname.includes('x.com')) return 'twitter';
    if (hostname.includes('threads')) return 'threads';
    if (hostname.includes('linkedin')) return 'linkedin';
    if (hostname.includes('spotify')) return 'spotify';
    if (hostname.includes('instagram')) return 'instagram';
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Prefetch article previews for a list of URLs.
 * Call this on feed mount to warm the cache.
 */
export function prefetchArticlePreviews(
  queryClient: any,
  urls: (string | null | undefined)[]
) {
  const validUrls = urls.filter((u): u is string => !!u);
  
  validUrls.forEach(url => {
    queryClient.prefetchQuery({
      queryKey: ['article-preview', url],
      queryFn: async () => {
        try {
          const preview = await fetchArticlePreview(url);
          if (!preview) return null;
          const platform = detectPlatformFromUrl(url);
          return { ...(preview as any), platform: (preview as any)?.platform || platform };
        } catch {
          return null;
        }
      },
      staleTime: Infinity,
    });
  });
}

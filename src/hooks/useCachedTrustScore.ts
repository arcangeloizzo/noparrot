import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CachedTrustScore {
  band: 'ALTO' | 'MEDIO' | 'BASSO';
  score: number;
  reasons: string[];
}

/**
 * Hook to fetch cached trust score directly from database.
 * Used for reshared posts to avoid recalculating the score.
 */
export function useCachedTrustScore(sourceUrl: string | null | undefined) {
  return useQuery({
    queryKey: ['cached-trust-score', sourceUrl],
    queryFn: async (): Promise<CachedTrustScore | null> => {
      if (!sourceUrl) return null;

      // Normalize URL (same logic as backend)
      let normalizedUrl = sourceUrl;
      try {
        const url = new URL(sourceUrl);
        // Normalize YouTube URLs
        if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
          let videoId = '';
          if (url.hostname.includes('youtu.be')) {
            videoId = url.pathname.slice(1);
          } else {
            videoId = url.searchParams.get('v') || '';
          }
          if (videoId) {
            normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
          }
        }
        // Normalize Twitter/X URLs
        if (url.hostname.includes('twitter.com') || url.hostname.includes('x.com')) {
          normalizedUrl = url.href.replace('twitter.com', 'x.com');
        }
      } catch {
        // Keep original URL if parsing fails
      }

      const { data, error } = await supabase
        .from('trust_scores')
        .select('band, score, reasons')
        .eq('source_url', normalizedUrl)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error || !data) return null;
      
      return {
        band: data.band as 'ALTO' | 'MEDIO' | 'BASSO',
        score: data.score,
        reasons: data.reasons as string[]
      };
    },
    enabled: !!sourceUrl,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CachedTrustScore {
  band: 'ALTO' | 'MEDIO' | 'BASSO';
  score: number;
  reasons: string[];
}

/**
 * Hook to fetch cached trust score via edge function.
 * Used for reshared posts to avoid recalculating the score.
 * Requires authenticated user.
 */
export function useCachedTrustScore(sourceUrl: string | null | undefined) {
  return useQuery({
    queryKey: ['cached-trust-score', sourceUrl],
    queryFn: async (): Promise<CachedTrustScore | null> => {
      if (!sourceUrl) return null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('useCachedTrustScore: No session, skipping fetch');
        return null;
      }

      const { data, error } = await supabase.functions.invoke('get-trust-score', {
        body: { source_url: sourceUrl }
      });

      if (error) {
        console.error('Error fetching cached trust score:', error);
        return null;
      }

      if (!data?.data) return null;
      
      return {
        band: data.data.band as 'ALTO' | 'MEDIO' | 'BASSO',
        score: data.data.score,
        reasons: data.data.reasons as string[]
      };
    },
    enabled: !!sourceUrl,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

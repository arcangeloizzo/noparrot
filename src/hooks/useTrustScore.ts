import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchTrustScore } from '@/lib/comprehension-gate';

interface TrustScore {
  band: 'ALTO' | 'MEDIO' | 'BASSO';
  score: number;
  reasons: string[];
}

interface UseTrustScoreOptions {
  /** Post content for AI evaluation */
  postText?: string;
  /** Author username for Twitter verification */
  authorUsername?: string;
  /** Is the author verified (for Twitter) */
  isVerified?: boolean;
  /** Skip fetching (e.g., for reshares that use cached scores) */
  skip?: boolean;
}

/**
 * Hook for fetching and caching trust scores with React Query.
 * First checks the database cache, then falls back to AI calculation.
 * Uses 1-hour cache to minimize redundant AI calls.
 */
export function useTrustScore(
  sourceUrl: string | null | undefined,
  options: UseTrustScoreOptions = {}
) {
  const { postText = '', authorUsername, isVerified, skip = false } = options;

  return useQuery({
    queryKey: ['trust-score', sourceUrl],
    queryFn: async (): Promise<TrustScore | null> => {
      if (!sourceUrl) return null;

      // 1. Check DB cache first (via edge function for security)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          const { data } = await supabase.functions.invoke('get-trust-score', {
            body: { source_url: sourceUrl }
          });

          if (data?.data) {
            return {
              band: data.data.band as 'ALTO' | 'MEDIO' | 'BASSO',
              score: data.data.score,
              reasons: data.data.reasons as string[]
            };
          }
        } catch (error) {
          console.warn('[useTrustScore] Cache lookup failed:', error);
        }
      }

      // 2. Calculate new trust score via AI
      try {
        const result = await fetchTrustScore({
          postText,
          sources: [sourceUrl],
          authorUsername,
          isVerified
        });

        if (result) {
          return {
            band: result.band,
            score: result.score,
            reasons: result.reasons || []
          };
        }
      } catch (error) {
        console.warn('[useTrustScore] AI calculation failed:', error);
      }

      return null;
    },
    enabled: !!sourceUrl && !skip,
    staleTime: 1000 * 60 * 60, // 1 hour cache
    gcTime: 1000 * 60 * 60 * 2, // 2 hours in memory
    retry: 1,
  });
}

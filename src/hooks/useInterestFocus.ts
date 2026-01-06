import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InterestFocus {
  id: string;
  category: string;
  title: string;
  summary: string;
  deep_content?: string;
  sources: Array<{ icon: string; name: string; url?: string }>;
  trust_score: 'Alto' | 'Medio' | 'Basso';
  image_url?: string;
  reactions: {
    likes: number;
    comments: number;
    shares: number;
  };
  created_at: string;
  expires_at: string;
}

export const useInterestFocus = (
  userCategories: string[], 
  trackingEnabled: boolean = true,
  refreshNonce: number = 0
) => {
  const shouldForce = refreshNonce > 0;

  return useQuery({
    queryKey: ['interest-focus', userCategories, trackingEnabled, refreshNonce],
    queryFn: async (): Promise<InterestFocus[]> => {
      // If tracking is disabled, return empty array (no personalized feed)
      if (!trackingEnabled || userCategories.length === 0) {
        return [];
      }

      // Prendiamo le top 2 categorie dell'utente
      const topCategories = userCategories.slice(0, 2);
      console.log('Fetching interest focus for categories:', topCategories, shouldForce ? '(FORCE nonce:' + refreshNonce + ')' : '');

      const results = await Promise.allSettled(
        topCategories.map(async (category) => {
          try {
            // If force refresh, skip cache
            if (shouldForce) {
              console.log(`Force refreshing interest focus for ${category}...`);
              const { data, error } = await supabase.functions.invoke('fetch-interest-focus', {
                body: { category, force: true }
              });

              if (error) {
                console.error(`Error force refreshing interest focus for ${category}:`, error);
                throw error;
              }

              return data as unknown as InterestFocus;
            }

            // 1. Check cache (valido per 3 ore)
            const { data: cached } = await supabase
              .from('interest_focus')
              .select('*')
              .eq('category', category)
              .gte('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (cached) {
              console.log(`Using cached interest focus for ${category}`);
              return cached as unknown as InterestFocus;
            }

            // 2. Fetch fresh da edge function
            console.log(`Fetching fresh interest focus for ${category}...`);
            const { data, error } = await supabase.functions.invoke('fetch-interest-focus', {
              body: { category }
            });

            if (error) {
              console.error(`Error fetching interest focus for ${category}:`, error);
              throw error;
            }

            return data as unknown as InterestFocus;
          } catch (error) {
            console.error(`Failed to fetch interest focus for ${category}:`, error);
            throw error;
          }
        })
      );

      // Filtra risultati fulfilled e non null
      return results
        .filter((r): r is PromiseFulfilledResult<InterestFocus> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter((r): r is InterestFocus => r !== null);
    },
    enabled: trackingEnabled && userCategories.length > 0,
    staleTime: 1000 * 60 * 15, // 15 minuti
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

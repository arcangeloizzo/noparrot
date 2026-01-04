import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DailyFocus {
  id: string;
  title: string;
  summary: string;
  deep_content?: string;
  sources: Array<{ icon: string; name: string; url?: string }>;
  trust_score: 'Alto' | 'Medio' | 'Basso';
  category?: string;
  image_url?: string;
  reactions: {
    likes: number;
    comments: number;
    shares: number;
  };
  created_at: string;
  expires_at: string;
}

export const useDailyFocus = (refreshNonce: number = 0) => {
  const shouldForce = refreshNonce > 0;

  return useQuery({
    queryKey: ['daily-focus', refreshNonce],
    queryFn: async (): Promise<DailyFocus[]> => {
      // If force refresh, call edge function to ensure fresh data, then fetch array
      if (shouldForce) {
        console.log('Force refreshing daily focus (nonce:', refreshNonce, ')...');
        await supabase.functions.invoke('fetch-daily-focus', {
          body: { force: true }
        });
      }

      // Fetch latest 6 non-expired daily focus items (newest first)
      const { data: cached, error: cacheError } = await supabase
        .from('daily_focus')
        .select('*')
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(6);

      if (cacheError) {
        console.error('Error fetching cached daily focus:', cacheError);
        return [];
      }

      if (cached && cached.length > 0) {
        console.log('Using cached daily focus items:', cached.length);
        return cached as unknown as DailyFocus[];
      }

      // If no cache, trigger edge function to generate one
      console.log('Fetching fresh daily focus...');
      const { data, error } = await supabase.functions.invoke('fetch-daily-focus');

      if (error) {
        console.error('Error fetching daily focus:', error);
        return [];
      }

      // Return as array (single item from edge function)
      return data ? [data as unknown as DailyFocus] : [];
    },
    staleTime: 1000 * 60 * 15, // 15 minuti
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

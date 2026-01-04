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
  edition_time?: string;
  reactions: {
    likes: number;
    comments: number;
    shares: number;
  };
  created_at: string;
  expires_at: string;
}

export const useDailyFocus = (refreshNonce: number = 0) => {
  return useQuery({
    queryKey: ['daily-focus', refreshNonce],
    queryFn: async (): Promise<DailyFocus[]> => {
      // Fetch latest 8 articles (2 full days) - no expires_at filter
      console.log('Fetching daily focus from DB (nonce:', refreshNonce, ')...');
      
      const { data: cached, error: cacheError } = await supabase
        .from('daily_focus')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);

      if (cacheError) {
        console.error('Error fetching daily focus:', cacheError);
        return [];
      }

      if (cached && cached.length > 0) {
        console.log('Using cached daily focus items:', cached.length);
        return cached as unknown as DailyFocus[];
      }

      // Only if NO items in DB, call edge function to generate the first one
      console.log('No cached items, generating initial daily focus...');
      const { data, error } = await supabase.functions.invoke('fetch-daily-focus', {
        body: { scheduled: false }
      });

      if (error) {
        console.error('Error fetching daily focus:', error);
        return [];
      }

      // Return as array (single item from edge function)
      return data ? [data as unknown as DailyFocus] : [];
    },
    staleTime: 1000 * 60 * 5, // 5 minuti
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

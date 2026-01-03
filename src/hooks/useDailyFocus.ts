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
    queryFn: async (): Promise<DailyFocus | null> => {
      // If force refresh, skip cache and call edge function directly
      if (shouldForce) {
        console.log('Force refreshing daily focus (nonce:', refreshNonce, ')...');
        const { data, error } = await supabase.functions.invoke('fetch-daily-focus', {
          body: { force: true }
        });

        if (error) {
          console.error('Error force refreshing daily focus:', error);
          return null;
        }

        return data as unknown as DailyFocus;
      }

      // 1. Check cache in table (valido per 4 ore)
      const { data: cached, error: cacheError } = await supabase
        .from('daily_focus')
        .select('*')
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cacheError) {
        console.error('Error fetching cached daily focus:', cacheError);
      }

      if (cached) {
        console.log('Using cached daily focus');
        return cached as unknown as DailyFocus;
      }

      // 2. Se non c'è cache, trigger edge function
      console.log('Fetching fresh daily focus...');
      const { data, error } = await supabase.functions.invoke('fetch-daily-focus');

      if (error) {
        console.error('Error fetching daily focus:', error);
        return null;
      }

      return data as unknown as DailyFocus;
    },
    staleTime: 1000 * 60 * 15, // 15 minuti
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

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
  provider?: string;
  cached?: boolean;
}

export const useDailyFocus = () => {
  return useQuery({
    queryKey: ['daily-focus'],
    queryFn: async (): Promise<DailyFocus | null> => {
      console.log('Fetching daily focus from Perplexity...');
      
      const { data, error } = await supabase.functions.invoke('fetch-daily-focus-perplexity');

      if (error) {
        console.error('Error fetching daily focus:', error);
        return null;
      }

      console.log(`Daily Focus loaded (provider: ${data?.provider}, cached: ${data?.cached})`);
      return data as unknown as DailyFocus;
    },
    staleTime: 1000 * 60 * 30, // 30 minuti
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

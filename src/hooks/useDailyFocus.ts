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
  // Anti-duplication metadata
  raw_title?: string;
  topic_cluster?: string;
  angle_tag?: string;
  event_fingerprint?: string;
  skip_reason?: string;
}

export const useDailyFocus = (refreshNonce: number = 0) => {
  return useQuery({
    queryKey: ['daily-focus', refreshNonce],
    queryFn: async (): Promise<{ items: DailyFocus[]; totalCount: number }> => {
      // Fetch total count of ALL editorials in DB
      console.log('Fetching daily focus from DB (nonce:', refreshNonce, ')...');

      const { count: totalCount, error: countError } = await supabase
        .from('daily_focus')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('Error fetching daily focus count:', countError);
      }

      // Fetch latest 8 articles (2 full days) - no expires_at filter
      const { data: cached, error: cacheError } = await supabase
        .from('daily_focus')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);

      if (cacheError) {
        console.error('Error fetching daily focus:', cacheError);
        return { items: [], totalCount: 0 };
      }

      if (cached && cached.length > 0) {
        // Compute shares count from posts that reference this focus item
        // This makes the UI reflect real shares even if daily_focus.reactions.shares isn't kept in sync.
        const shareCounts = await Promise.all(
          cached.map(async (item: any) => {
            const sharedUrl = `focus://daily/${item.id}`;
            const { count, error } = await supabase
              .from('posts')
              .select('id', { count: 'exact', head: true })
              .eq('shared_url', sharedUrl);

            if (error) {
              console.warn('Error fetching daily focus share count for', item.id, error);
              return 0;
            }
            return count || 0;
          })
        );

        const items = cached.map((raw: any, idx: number) => {
          const r = (raw.reactions || {}) as any;
          return {
            ...(raw as DailyFocus),
            reactions: {
              likes: r.likes ?? 0,
              comments: r.comments ?? 0,
              shares: shareCounts[idx] ?? r.shares ?? 0,
            },
          } as DailyFocus;
        });

        console.log('Using cached daily focus items:', items.length, 'total in DB:', totalCount);
        return {
          items,
          totalCount: totalCount || items.length,
        };
      }

      // Only if NO items in DB, call edge function to generate the first one
      console.log('No cached items, generating initial daily focus...');
      const { data, error } = await supabase.functions.invoke('fetch-daily-focus', {
        body: { scheduled: false },
      });

      if (error) {
        console.error('Error fetching daily focus:', error);
        return { items: [], totalCount: 0 };
      }

      // Return as array (single item from edge function)
      return data ? { items: [data as unknown as DailyFocus], totalCount: 1 } : { items: [], totalCount: 0 };
    },
    staleTime: 1000 * 60 * 5, // 5 minuti
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

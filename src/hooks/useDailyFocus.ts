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
        // Use RPC to get share counts in a single aggregated query (N+1 fix)
        const focusIds = cached.map((item: any) => item.id);
        const sharedUrls = focusIds.map(id => `focus://daily/${id}`);
        
        let shareMap = new Map<string, number>();
        let commentCountMap = new Map<string, number>();
        
        // Fetch share counts and comment counts in parallel
        const [shareResult, commentResult] = await Promise.all([
          sharedUrls.length > 0 
            ? supabase.rpc('get_share_counts', { shared_urls: sharedUrls })
            : { data: [], error: null },
          // Get actual comment counts from focus_comments table
          supabase
            .from('focus_comments')
            .select('focus_id')
            .in('focus_id', focusIds)
            .eq('focus_type', 'daily')
        ]);
        
        if (shareResult.error) {
          console.warn('Error fetching share counts via RPC:', shareResult.error);
        } else if (shareResult.data && shareResult.data.length > 5000) {
          console.warn('[useDailyFocus] ⚠️ Share count rows > 5000');
        }
        
        (shareResult.data || []).forEach((row: { shared_url: string; count: number }) => {
          shareMap.set(row.shared_url, row.count);
        });
        
        // Count comments per focus_id
        if (!commentResult.error && commentResult.data) {
          commentResult.data.forEach((row: { focus_id: string }) => {
            const current = commentCountMap.get(row.focus_id) || 0;
            commentCountMap.set(row.focus_id, current + 1);
          });
        }

        const items = cached.map((raw: any) => {
          const r = (raw.reactions || {}) as any;
          return {
            ...(raw as DailyFocus),
            reactions: {
              likes: r.likes ?? 0,
              // Use actual comment count from focus_comments table
              comments: commentCountMap.get(raw.id) ?? r.comments ?? 0,
              shares: shareMap.get(`focus://daily/${raw.id}`) ?? r.shares ?? 0,
            },
          } as DailyFocus;
        });

        console.log('Using cached daily focus items:', items.length, 'total in DB:', totalCount, 'comment counts:', Object.fromEntries(commentCountMap));
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

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ReactionType } from "@/components/ui/reaction-picker";

interface Reactor {
  id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
  user: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface ReactorsData {
  reactors: Reactor[];
  byType: Record<ReactionType, Reactor[]>;
  counts: Record<ReactionType, number>;
  totalCount: number;
}

const REACTION_TYPES: ReactionType[] = ['heart', 'laugh', 'wow', 'sad', 'fire'];

/**
 * Hook to fetch all users who reacted to a post, grouped by reaction type
 */
export const usePostReactors = (postId: string | undefined, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['post-reactors', postId],
    queryFn: async (): Promise<ReactorsData> => {
      if (!postId) {
        return { reactors: [], byType: {} as Record<ReactionType, Reactor[]>, counts: {} as Record<ReactionType, number>, totalCount: 0 };
      }

      const { data, error } = await supabase
        .from('reactions')
        .select(`
          id,
          user_id,
          reaction_type,
          created_at,
          user:public_profiles!user_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .neq('reaction_type', 'bookmark')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[usePostReactors] Error fetching reactors:', error);
        throw error;
      }

      // Filter out reactors without user data and cast to proper type
      const reactors: Reactor[] = (data || [])
        .filter((r: any) => r.user && REACTION_TYPES.includes(r.reaction_type as ReactionType))
        .map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          reaction_type: r.reaction_type as ReactionType,
          created_at: r.created_at,
          user: r.user
        }));

      // Group by type
      const byType: Record<ReactionType, Reactor[]> = {
        heart: [],
        laugh: [],
        wow: [],
        sad: [],
        fire: [],
      };

      const counts: Record<ReactionType, number> = {
        heart: 0,
        laugh: 0,
        wow: 0,
        sad: 0,
        fire: 0,
      };

      for (const reactor of reactors) {
        const type = reactor.reaction_type;
        byType[type].push(reactor);
        counts[type]++;
      }

      return {
        reactors,
        byType,
        counts,
        totalCount: reactors.length,
      };
    },
    enabled: !!postId && enabled,
    staleTime: 30000, // Cache for 30 seconds
  });
};

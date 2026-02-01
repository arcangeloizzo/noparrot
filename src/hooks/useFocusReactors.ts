import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ReactionType } from "@/components/ui/reaction-picker";

interface FocusReactor {
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

interface FocusReactorsData {
  reactors: FocusReactor[];
  byType: Record<ReactionType, FocusReactor[]>;
  counts: Record<ReactionType, number>;
  totalCount: number;
}

const REACTION_TYPES: ReactionType[] = ['heart', 'laugh', 'wow', 'sad', 'fire'];

/**
 * Hook to fetch all users who reacted to a focus item (daily/interest), grouped by reaction type
 */
export const useFocusReactors = (
  focusId: string | undefined, 
  focusType: 'daily' | 'interest',
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['focus-reactors', focusId, focusType],
    queryFn: async (): Promise<FocusReactorsData> => {
      if (!focusId) {
        return { reactors: [], byType: {} as Record<ReactionType, FocusReactor[]>, counts: {} as Record<ReactionType, number>, totalCount: 0 };
      }

      const { data, error } = await supabase
        .from('focus_reactions')
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
        .eq('focus_id', focusId)
        .eq('focus_type', focusType)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useFocusReactors] Error fetching reactors:', error);
        throw error;
      }

      // Filter out reactors without user data and cast to proper type
      const reactors: FocusReactor[] = (data || [])
        .filter((r: any) => r.user && REACTION_TYPES.includes(r.reaction_type as ReactionType))
        .map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          reaction_type: r.reaction_type as ReactionType,
          created_at: r.created_at,
          user: r.user
        }));

      // Group by type
      const byType: Record<ReactionType, FocusReactor[]> = {
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
    enabled: !!focusId && enabled,
    staleTime: 30000, // Cache for 30 seconds
  });
};

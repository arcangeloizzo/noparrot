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

      // Step 1: Fetch reactions
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('focus_reactions')
        .select('id, user_id, reaction_type, created_at')
        .eq('focus_id', focusId)
        .eq('focus_type', focusType)
        .neq('reaction_type', 'bookmark')
        .order('created_at', { ascending: false });

      if (reactionsError) {
        console.error('[useFocusReactors] Error fetching reactions:', reactionsError);
        throw reactionsError;
      }

      if (!reactionsData || reactionsData.length === 0) {
        return { 
          reactors: [], 
          byType: { heart: [], laugh: [], wow: [], sad: [], fire: [] }, 
          counts: { heart: 0, laugh: 0, wow: 0, sad: 0, fire: 0 }, 
          totalCount: 0 
        };
      }

      // Step 2: Get unique user IDs
      const userIds = [...new Set(reactionsData.map(r => r.user_id).filter(Boolean))];

      // Step 3: Fetch user profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('public_profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        console.error('[useFocusReactors] Error fetching profiles:', profilesError);
        // Continue without user data rather than failing
      }

      // Create a map for quick lookup
      const profilesMap = new Map(
        (profilesData || []).map(p => [p.id, p])
      );

      // Step 4: Combine data
      const reactors: FocusReactor[] = reactionsData
        .filter(r => REACTION_TYPES.includes(r.reaction_type as ReactionType))
        .map(r => ({
          id: r.id,
          user_id: r.user_id || '',
          reaction_type: r.reaction_type as ReactionType,
          created_at: r.created_at || '',
          user: r.user_id ? (profilesMap.get(r.user_id) || null) : null
        }))
        .filter(r => r.user !== null);

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

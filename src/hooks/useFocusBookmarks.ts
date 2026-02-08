import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DailyFocus } from "./useDailyFocus";

interface FocusBookmark {
  id: string;
  user_id: string;
  focus_id: string;
  focus_type: 'daily';
  created_at: string;
}

// Check if a specific focus item is bookmarked
export const useFocusBookmark = (focusId: string, focusType: 'daily' = 'daily') => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['focus-bookmark', focusId, focusType, user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!user) return false;

      const { data, error } = await supabase
        .from('focus_bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('focus_id', focusId)
        .eq('focus_type', focusType)
        .maybeSingle();

      if (error) {
        console.error('Error checking focus bookmark:', error);
        return false;
      }

      return !!data;
    },
    enabled: !!user && !!focusId,
    staleTime: 1000 * 60 * 5,
  });
};

// Toggle bookmark for a focus item
// Con optimistic updates per feedback immediato
export const useToggleFocusBookmark = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ focusId, focusType = 'daily' }: { focusId: string; focusType?: 'daily' }) => {
      if (!user) throw new Error('User not authenticated');

      // Check if already bookmarked
      const { data: existing } = await supabase
        .from('focus_bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('focus_id', focusId)
        .eq('focus_type', focusType)
        .maybeSingle();

      if (existing) {
        // Remove bookmark
        const { error } = await supabase
          .from('focus_bookmarks')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
        return { bookmarked: false };
      } else {
        // Add bookmark
        const { error } = await supabase
          .from('focus_bookmarks')
          .insert({
            user_id: user.id,
            focus_id: focusId,
            focus_type: focusType,
          });

        if (error) throw error;
        return { bookmarked: true };
      }
    },
    
    // ===== OPTIMISTIC UI: Instant feedback =====
    onMutate: async ({ focusId, focusType = 'daily' }) => {
      if (!user) return;
      
      // Cancel in-flight queries
      await queryClient.cancelQueries({ 
        queryKey: ['focus-bookmark', focusId, focusType, user.id] 
      });
      
      // Snapshot previous state
      const previousBookmark = queryClient.getQueryData<boolean>(
        ['focus-bookmark', focusId, focusType, user.id]
      );
      
      // Optimistically toggle
      queryClient.setQueryData(
        ['focus-bookmark', focusId, focusType, user.id],
        !previousBookmark
      );
      
      return { previousBookmark };
    },
    
    // Rollback on error
    onError: (_err, variables, context) => {
      if (context?.previousBookmark !== undefined) {
        queryClient.setQueryData(
          ['focus-bookmark', variables.focusId, variables.focusType, user?.id],
          context.previousBookmark
        );
      }
    },
    
    // Background sync
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['focus-bookmark', variables.focusId, variables.focusType] 
      });
      queryClient.invalidateQueries({ queryKey: ['saved-focus'] });
    },
  });
};

// Get all bookmarked focus items for the current user
export const useSavedFocus = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['saved-focus', user?.id],
    queryFn: async (): Promise<(DailyFocus & { bookmarked_at: string })[]> => {
      if (!user) return [];

      // Get user's bookmarks
      const { data: bookmarks, error: bookmarksError } = await supabase
        .from('focus_bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .eq('focus_type', 'daily')
        .order('created_at', { ascending: false });

      if (bookmarksError) {
        console.error('Error fetching focus bookmarks:', bookmarksError);
        return [];
      }

      if (!bookmarks || bookmarks.length === 0) return [];

      // Get the actual focus items
      const focusIds = bookmarks.map(b => b.focus_id);
      const { data: focusItems, error: focusError } = await supabase
        .from('daily_focus')
        .select('*')
        .in('id', focusIds);

      if (focusError) {
        console.error('Error fetching focus items:', focusError);
        return [];
      }

      // Merge bookmark created_at with focus items
      return (focusItems || []).map(item => {
        const bookmark = bookmarks.find(b => b.focus_id === item.id);
        return {
          ...item,
          bookmarked_at: bookmark?.created_at || item.created_at,
        } as DailyFocus & { bookmarked_at: string };
      }).sort((a, b) => new Date(b.bookmarked_at).getTime() - new Date(a.bookmarked_at).getTime());
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
};

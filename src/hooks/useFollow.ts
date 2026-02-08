import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Check if the current user is following a target user
 */
export const useIsFollowing = (targetUserId: string | undefined) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['is-following', user?.id, targetUserId],
    queryFn: async () => {
      if (!user || !targetUserId) return false;
      
      const { data, error } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking follow status:', error);
        return false;
      }
      
      return !!data;
    },
    enabled: !!user && !!targetUserId && user.id !== targetUserId,
    staleTime: 30 * 1000, // 30 seconds
  });
};

/**
 * Toggle follow/unfollow for a target user
 */
export const useToggleFollow = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ targetUserId, isCurrentlyFollowing }: { 
      targetUserId: string; 
      isCurrentlyFollowing: boolean;
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      if (isCurrentlyFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);
        
        if (error) throw error;
        return { action: 'unfollowed' as const };
      } else {
        // Follow
        const { error } = await supabase
          .from('followers')
          .insert({
            follower_id: user.id,
            following_id: targetUserId,
          });
        
        if (error) throw error;
        return { action: 'followed' as const };
      }
    },
    onMutate: async ({ targetUserId, isCurrentlyFollowing }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['is-following', user?.id, targetUserId] });
      
      // Snapshot previous value
      const previousValue = queryClient.getQueryData(['is-following', user?.id, targetUserId]);
      
      // Optimistically update
      queryClient.setQueryData(['is-following', user?.id, targetUserId], !isCurrentlyFollowing);
      
      return { previousValue, targetUserId };
    },
    onError: (error, _, context) => {
      // Rollback on error
      if (context) {
        queryClient.setQueryData(
          ['is-following', user?.id, context.targetUserId], 
          context.previousValue
        );
      }
      console.error('Follow toggle error:', error);
      toast.error('Errore durante l\'operazione');
    },
    onSettled: (_, __, { targetUserId }) => {
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: ['is-following', user?.id, targetUserId] });
    },
  });
};

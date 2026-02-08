import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';
import type { ReactionType } from '@/components/ui/reaction-picker';

interface CommentReactionData {
  likesCount: number;
  likedByMe: boolean;
  myReactionType?: ReactionType | null;
  byType: Record<ReactionType, number>;
}

export const useCommentReactions = (commentId: string) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['comment-reactions', commentId],
    queryFn: async (): Promise<CommentReactionData> => {
      const { data, error } = await supabase
        .from('comment_reactions')
        .select('*')
        .eq('comment_id', commentId);
      
      if (error) throw error;
      
      const likesCount = data?.length || 0;
      const myReaction = data?.find(r => r.user_id === user?.id);
      const likedByMe = !!myReaction;
      
      // Aggregate reactions by type
      const byType: Record<ReactionType, number> = {} as Record<ReactionType, number>;
      data?.forEach(r => {
        const type = r.reaction_type as ReactionType;
        byType[type] = (byType[type] || 0) + 1;
      });
      
      return { 
        likesCount, 
        likedByMe,
        myReactionType: myReaction?.reaction_type as ReactionType | undefined,
        byType
      };
    },
    enabled: !!commentId
  });
};

export const useToggleCommentReaction = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      commentId,
      mode,
      reactionType = 'heart'
    }: { 
      commentId: string;
      mode: 'add' | 'remove' | 'update';
      reactionType?: ReactionType;
    }) => {
      if (!user) throw new Error('Not authenticated');

      if (mode === 'remove') {
        // Remove reaction
        const { error } = await supabase
          .from('comment_reactions')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else if (mode === 'add') {
        // Add reaction
        const { error } = await supabase
          .from('comment_reactions')
          .insert({
            comment_id: commentId,
            user_id: user.id,
            reaction_type: reactionType
          });
        
        if (error) throw error;
      } else {
        // Update reaction type
        const { error } = await supabase
          .from('comment_reactions')
          .update({ reaction_type: reactionType })
          .eq('comment_id', commentId)
          .eq('user_id', user.id);

        if (error) throw error;
      }
    },
    
    // ===== OPTIMISTIC UI: Instant feedback =====
    onMutate: async ({ commentId, mode, reactionType = 'heart' }) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: ['comment-reactions', commentId] });
      
      // Snapshot previous state
      const previous = queryClient.getQueryData<CommentReactionData>(
        ['comment-reactions', commentId]
      );

      const prevType = (previous?.myReactionType || 'heart') as ReactionType;
      
      // Optimistically update cache including byType
      const newByType = { ...(previous?.byType || {}) } as Record<ReactionType, number>;

      if (mode === 'remove') {
        if (newByType[prevType]) newByType[prevType] = Math.max(0, newByType[prevType] - 1);
      } else if (mode === 'add') {
        newByType[reactionType] = (newByType[reactionType] || 0) + 1;
      } else {
        // update
        if (prevType !== reactionType) {
          if (newByType[prevType]) newByType[prevType] = Math.max(0, newByType[prevType] - 1);
          newByType[reactionType] = (newByType[reactionType] || 0) + 1;
        }
      }

      const likesCountDelta = mode === 'add' ? 1 : mode === 'remove' ? -1 : 0;
      const likedByMe = mode === 'remove' ? false : true;
      const myReactionType = mode === 'remove' ? null : reactionType;
      
      queryClient.setQueryData<CommentReactionData>(['comment-reactions', commentId], {
        likesCount: (previous?.likesCount || 0) + likesCountDelta,
        likedByMe,
        myReactionType,
        byType: newByType,
      });
      
      return { previous };
    },
    
    // Rollback on error
    onError: (_err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['comment-reactions', variables.commentId], context.previous);
      }
      haptics.warning();
      toast.error('Errore nel like al commento');
    },
    
    // Background sync
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comment-reactions', variables.commentId] });
    }
  });
};

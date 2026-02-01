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
      
      return { 
        likesCount, 
        likedByMe,
        myReactionType: myReaction?.reaction_type as ReactionType | undefined
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
      isLiked, 
      reactionType = 'heart' 
    }: { 
      commentId: string; 
      isLiked: boolean;
      reactionType?: ReactionType;
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      if (isLiked) {
        // Remove reaction
        const { error } = await supabase
          .from('comment_reactions')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        // Add reaction
        const { error } = await supabase
          .from('comment_reactions')
          .insert({
            comment_id: commentId,
            user_id: user.id,
            reaction_type: reactionType
          });
        
        if (error) throw error;
      }
    },
    
    // ===== OPTIMISTIC UI: Instant feedback =====
    onMutate: async ({ commentId, isLiked, reactionType = 'heart' }) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: ['comment-reactions', commentId] });
      
      // Snapshot previous state
      const previous = queryClient.getQueryData<CommentReactionData>(
        ['comment-reactions', commentId]
      );
      
      // Optimistically update cache
      queryClient.setQueryData<CommentReactionData>(['comment-reactions', commentId], {
        likesCount: (previous?.likesCount || 0) + (isLiked ? -1 : 1),
        likedByMe: !isLiked,
        myReactionType: isLiked ? null : reactionType,
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

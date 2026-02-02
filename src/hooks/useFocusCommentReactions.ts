import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';
import type { ReactionType } from '@/components/ui/reaction-picker';

interface FocusCommentReactionData {
  likesCount: number;
  likedByMe: boolean;
  myReactionType?: ReactionType | null;
  byType: Record<ReactionType, number>;
}

export const useFocusCommentReactions = (focusCommentId: string) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['focus-comment-reactions', focusCommentId],
    queryFn: async (): Promise<FocusCommentReactionData> => {
      const { data, error } = await supabase
        .from('focus_comment_reactions')
        .select('*')
        .eq('focus_comment_id', focusCommentId);
      
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
    enabled: !!focusCommentId
  });
};

export const useToggleFocusCommentReaction = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      focusCommentId, 
      mode,
      reactionType = 'heart'
    }: { 
      focusCommentId: string; 
      mode: 'add' | 'remove' | 'update';
      reactionType?: ReactionType;
    }) => {
      if (!user) throw new Error('Not authenticated');

      if (mode === 'remove') {
        // Remove reaction
        const { error } = await supabase
          .from('focus_comment_reactions')
          .delete()
          .eq('focus_comment_id', focusCommentId)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else if (mode === 'add') {
        // Add reaction with specific type
        const { error } = await supabase
          .from('focus_comment_reactions')
          .insert({
            focus_comment_id: focusCommentId,
            user_id: user.id,
            reaction_type: reactionType
          });
        
        if (error) throw error;
      } else {
        // Update reaction type
        const { error } = await supabase
          .from('focus_comment_reactions')
          .update({ reaction_type: reactionType })
          .eq('focus_comment_id', focusCommentId)
          .eq('user_id', user.id);

        if (error) throw error;
      }
    },
    
    // Optimistic UI
    onMutate: async ({ focusCommentId, mode, reactionType = 'heart' }) => {
      await queryClient.cancelQueries({ queryKey: ['focus-comment-reactions', focusCommentId] });
      
      const previous = queryClient.getQueryData<FocusCommentReactionData>(
        ['focus-comment-reactions', focusCommentId]
      );

      const prevType = (previous?.myReactionType || 'heart') as ReactionType;
      
      const newByType = { ...(previous?.byType || {}) } as Record<ReactionType, number>;

      if (mode === 'remove') {
        if (newByType[prevType]) newByType[prevType] = Math.max(0, newByType[prevType] - 1);
      } else if (mode === 'add') {
        newByType[reactionType] = (newByType[reactionType] || 0) + 1;
      } else {
        if (prevType !== reactionType) {
          if (newByType[prevType]) newByType[prevType] = Math.max(0, newByType[prevType] - 1);
          newByType[reactionType] = (newByType[reactionType] || 0) + 1;
        }
      }

      const likesCountDelta = mode === 'add' ? 1 : mode === 'remove' ? -1 : 0;
      const likedByMe = mode === 'remove' ? false : true;
      const myReactionType = mode === 'remove' ? null : reactionType;
      
      queryClient.setQueryData<FocusCommentReactionData>(['focus-comment-reactions', focusCommentId], {
        likesCount: (previous?.likesCount || 0) + likesCountDelta,
        likedByMe,
        myReactionType,
        byType: newByType,
      });
      
      return { previous };
    },
    
    onError: (_err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['focus-comment-reactions', variables.focusCommentId], context.previous);
      }
      haptics.warning();
      toast.error('Errore nel like al commento');
    },
    
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['focus-comment-reactions', variables.focusCommentId] });
    }
  });
};

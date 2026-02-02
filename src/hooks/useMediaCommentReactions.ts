import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';
import type { ReactionType } from '@/components/ui/reaction-picker';

interface MediaCommentReactionData {
  likesCount: number;
  likedByMe: boolean;
  myReactionType?: ReactionType | null;
  byType: Record<ReactionType, number>;
}

export const useMediaCommentReactions = (mediaCommentId: string) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['media-comment-reactions', mediaCommentId],
    queryFn: async (): Promise<MediaCommentReactionData> => {
      const { data, error } = await supabase
        .from('media_comment_reactions')
        .select('*')
        .eq('media_comment_id', mediaCommentId);
      
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
    enabled: !!mediaCommentId
  });
};

export const useToggleMediaCommentReaction = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      mediaCommentId, 
      mode,
      reactionType = 'heart'
    }: { 
      mediaCommentId: string; 
      mode: 'add' | 'remove' | 'update';
      reactionType?: ReactionType;
    }) => {
      if (!user) throw new Error('Not authenticated');

      if (mode === 'remove') {
        const { error } = await supabase
          .from('media_comment_reactions')
          .delete()
          .eq('media_comment_id', mediaCommentId)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else if (mode === 'add') {
        const { error } = await supabase
          .from('media_comment_reactions')
          .insert({
            media_comment_id: mediaCommentId,
            user_id: user.id,
            reaction_type: reactionType
          });
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('media_comment_reactions')
          .update({ reaction_type: reactionType })
          .eq('media_comment_id', mediaCommentId)
          .eq('user_id', user.id);

        if (error) throw error;
      }
    },
    
    // Optimistic UI
    onMutate: async ({ mediaCommentId, mode, reactionType = 'heart' }) => {
      await queryClient.cancelQueries({ queryKey: ['media-comment-reactions', mediaCommentId] });
      
      const previous = queryClient.getQueryData<MediaCommentReactionData>(
        ['media-comment-reactions', mediaCommentId]
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
      
      queryClient.setQueryData<MediaCommentReactionData>(['media-comment-reactions', mediaCommentId], {
        likesCount: (previous?.likesCount || 0) + likesCountDelta,
        likedByMe,
        myReactionType,
        byType: newByType,
      });
      
      return { previous };
    },
    
    onError: (_err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['media-comment-reactions', variables.mediaCommentId], context.previous);
      }
      haptics.warning();
      toast.error('Errore nel like al commento');
    },
    
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['media-comment-reactions', variables.mediaCommentId] });
    }
  });
};

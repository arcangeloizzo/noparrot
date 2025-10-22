import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useCommentReactions = (commentId: string) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['comment-reactions', commentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comment_reactions')
        .select('*')
        .eq('comment_id', commentId);
      
      if (error) throw error;
      
      const likesCount = data?.length || 0;
      const likedByMe = data?.some(r => r.user_id === user?.id) || false;
      
      return { likesCount, likedByMe };
    },
    enabled: !!commentId
  });
};

export const useToggleCommentReaction = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ commentId, isLiked }: { commentId: string; isLiked: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      
      if (isLiked) {
        // Remove like
        const { error } = await supabase
          .from('comment_reactions')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        // Add like
        const { error } = await supabase
          .from('comment_reactions')
          .insert({
            comment_id: commentId,
            user_id: user.id,
            reaction_type: 'heart'
          });
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comment-reactions', variables.commentId] });
    },
    onError: () => {
      toast.error('Errore nel like al commento');
    }
  });
};

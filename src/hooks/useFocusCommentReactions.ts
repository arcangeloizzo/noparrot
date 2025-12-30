import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useFocusCommentReactions = (focusCommentId: string) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['focus-comment-reactions', focusCommentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('focus_comment_reactions')
        .select('*')
        .eq('focus_comment_id', focusCommentId);
      
      if (error) throw error;
      
      const likesCount = data?.length || 0;
      const likedByMe = data?.some(r => r.user_id === user?.id) || false;
      
      return { likesCount, likedByMe };
    },
    enabled: !!focusCommentId
  });
};

export const useToggleFocusCommentReaction = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ focusCommentId, isLiked }: { focusCommentId: string; isLiked: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      
      if (isLiked) {
        // Remove like
        const { error } = await supabase
          .from('focus_comment_reactions')
          .delete()
          .eq('focus_comment_id', focusCommentId)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        // Add like
        const { error } = await supabase
          .from('focus_comment_reactions')
          .insert({
            focus_comment_id: focusCommentId,
            user_id: user.id,
            reaction_type: 'heart'
          });
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['focus-comment-reactions', variables.focusCommentId] });
    },
    onError: () => {
      toast.error('Errore nel like al commento');
    }
  });
};

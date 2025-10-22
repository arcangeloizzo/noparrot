import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useMediaReactions = (mediaId: string) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['media-reactions', mediaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('media_reactions')
        .select('*')
        .eq('media_id', mediaId);
      
      if (error) throw error;
      
      const likesCount = data?.length || 0;
      const likedByMe = data?.some(r => r.user_id === user?.id) || false;
      
      return { likesCount, likedByMe };
    },
    enabled: !!mediaId
  });
};

export const useToggleMediaReaction = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ mediaId, isLiked }: { mediaId: string; isLiked: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      
      if (isLiked) {
        // Remove like
        const { error } = await supabase
          .from('media_reactions')
          .delete()
          .eq('media_id', mediaId)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        // Add like
        const { error } = await supabase
          .from('media_reactions')
          .insert({
            media_id: mediaId,
            user_id: user.id,
            reaction_type: 'heart'
          });
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['media-reactions', variables.mediaId] });
    },
    onError: () => {
      toast.error('Errore nel like al media');
    }
  });
};

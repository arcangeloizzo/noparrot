import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export const useMessageReactions = (messageId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['message-reactions', messageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('id, user_id, reaction_type')
        .eq('message_id', messageId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!messageId
  });

  // Realtime subscription
  useEffect(() => {
    if (!messageId) return;

    const channel = supabase
      .channel(`message-reactions-${messageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter: `message_id=eq.${messageId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['message-reactions', messageId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageId, queryClient]);

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const existingLike = query.data?.find(
        r => r.user_id === user.id && r.reaction_type === 'like'
      );

      if (existingLike) {
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingLike.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            reaction_type: 'like'
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-reactions', messageId] });
    }
  });

  const likes = query.data?.filter(r => r.reaction_type === 'like').length || 0;
  const isLiked = query.data?.some(r => r.user_id === user?.id && r.reaction_type === 'like') || false;

  return {
    likes,
    isLiked,
    toggleLike: toggleLike.mutate,
    isLoading: query.isLoading || toggleLike.isPending
  };
};

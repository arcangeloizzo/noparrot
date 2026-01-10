import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export interface ReactionUser {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

export interface MessageReaction {
  id: string;
  user_id: string;
  reaction_type: string;
  user?: ReactionUser;
}

export const useMessageReactions = (messageId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['message-reactions', messageId],
    queryFn: async () => {
      // First get reactions
      const { data: reactions, error: reactionsError } = await supabase
        .from('message_reactions')
        .select('id, user_id, reaction_type')
        .eq('message_id', messageId);

      if (reactionsError) throw reactionsError;
      if (!reactions || reactions.length === 0) return [];

      // Then get user profiles for those who reacted
      const userIds = [...new Set(reactions.map(r => r.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        console.error('[useMessageReactions] Error fetching profiles:', profilesError);
        // Return reactions without user info
        return reactions.map(r => ({ ...r, user: undefined }));
      }

      // Merge profiles into reactions
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return reactions.map(r => ({
        ...r,
        user: profileMap.get(r.user_id) as ReactionUser | undefined
      }));
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
    },
    onError: (error) => {
      console.error('[useMessageReactions] Toggle like error:', error);
    }
  });

  const reactions = query.data || [];
  const likes = reactions.filter(r => r.reaction_type === 'like').length;
  const isLiked = reactions.some(r => r.user_id === user?.id && r.reaction_type === 'like');
  const likeUsers = reactions
    .filter(r => r.reaction_type === 'like' && r.user)
    .map(r => r.user as ReactionUser);

  return {
    likes,
    isLiked,
    likeUsers,
    toggleLike: toggleLike.mutate,
    isLoading: query.isLoading || toggleLike.isPending
  };
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { toast } from 'sonner';

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

  const queryKey = ['message-reactions', messageId] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      // Reactions are private to thread participants (RLS). Without auth, this will never work.
      if (!user) return [] as MessageReaction[];

      const { data: reactions, error: reactionsError } = await supabase
        .from('message_reactions')
        .select('id, user_id, reaction_type')
        .eq('message_id', messageId);

      if (reactionsError) throw reactionsError;
      if (!reactions || reactions.length === 0) return [] as MessageReaction[];

      const userIds = [...new Set(reactions.map(r => r.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        console.error('[useMessageReactions] profiles error', profilesError);
        return reactions.map(r => ({ ...r, user: undefined }));
      }

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return reactions.map(r => ({
        ...r,
        user: profileMap.get(r.user_id) as ReactionUser | undefined,
      }));
    },
    enabled: !!messageId && !!user,
  });

  // Realtime subscription
  useEffect(() => {
    if (!messageId || !user) return;

    const channel = supabase
      .channel(`message-reactions-${messageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter: `message_id=eq.${messageId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageId, queryClient, user]);

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user) {
        toast.error('Accedi per mettere like ai messaggi');
        return { action: 'noop' as const };
      }

      const existingLike = (queryClient.getQueryData<MessageReaction[]>(queryKey) || []).find(
        r => r.user_id === user.id && r.reaction_type === 'like'
      );

      if (existingLike) {
        const res = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingLike.id)
          .select('id')
          .maybeSingle();

        if (res.error) {
          console.error('[useMessageReactions] delete error', res.error);
          throw res.error;
        }

        return { action: 'removed' as const };
      }

      const res = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          reaction_type: 'like',
        })
        .select('id')
        .maybeSingle();

      if (res.error) {
        console.error('[useMessageReactions] insert error', res.error);
        throw res.error;
      }

      return { action: 'added' as const };
    },
    onMutate: async () => {
      if (!user) return;

      await queryClient.cancelQueries({ queryKey });

      const prev = queryClient.getQueryData<MessageReaction[]>(queryKey) || [];
      const hasLike = prev.some(r => r.user_id === user.id && r.reaction_type === 'like');

      const optimistic: MessageReaction[] = hasLike
        ? prev.filter(r => !(r.user_id === user.id && r.reaction_type === 'like'))
        : [
            ...prev,
            {
              id: `optimistic-${messageId}-${user.id}`,
              user_id: user.id,
              reaction_type: 'like',
              user: undefined,
            },
          ];

      queryClient.setQueryData(queryKey, optimistic);
      return { prev };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      console.error('[useMessageReactions] toggleLike failed', error);
      toast.error('Impossibile salvare il like');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
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
    isMutating: toggleLike.isPending,
    isLoading: query.isLoading,
  };
};


import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';

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

interface ToggleLikeCallbacks {
  onSuccessCallback?: (action: 'added' | 'removed') => void;
  onErrorCallback?: () => void;
}

interface ToggleLikeVariables {
  mode: 'add' | 'remove';
}

// Helper to check if string is valid UUID
const isValidUuid = (str: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
};

export const useMessageReactions = (messageId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const callbacksRef = useRef<ToggleLikeCallbacks | null>(null);

  const queryKey = ['message-reactions', messageId] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) return [] as MessageReaction[];

      const { data: reactions, error: reactionsError } = await supabase
        .from('message_reactions')
        .select('id, user_id, reaction_type')
        .eq('message_id', messageId);

      if (reactionsError) {
        console.error('[useMessageReactions] fetch error', {
          error: reactionsError,
          code: reactionsError.code,
          messageId,
          userId: user.id,
        });
        throw reactionsError;
      }
      if (!reactions || reactions.length === 0) return [] as MessageReaction[];

      const userIds = [...new Set(reactions.map(r => r.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('public_profiles')
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

  const toggleLikeMutation = useMutation({
    mutationFn: async (variables: ToggleLikeVariables) => {
      if (!user) {
        toast.error('Accedi per mettere like ai messaggi');
        return { action: 'noop' as const };
      }

      const { mode } = variables;

      if (mode === 'remove') {
        // Find the real UUID from context (set by onMutate) or query data
        // We need to find the ID BEFORE the optimistic update
        const cachedReactions = queryClient.getQueryData<MessageReaction[]>(queryKey) || [];
        const existingLike = cachedReactions.find(
          r => r.user_id === user.id && r.reaction_type === 'like' && isValidUuid(r.id)
        );

        if (!existingLike) {
          // Already removed or no valid ID - just invalidate
          console.warn('[useMessageReactions] No valid like ID found for removal, invalidating');
          return { action: 'removed' as const };
        }

        const res = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingLike.id)
          .select('id')
          .maybeSingle();

        if (res.error) {
          console.error('[useMessageReactions] delete error', {
            error: res.error,
            code: res.error.code,
            messageId,
            userId: user.id,
            likeId: existingLike.id,
          });
          throw res.error;
        }

        return { action: 'removed' as const };
      }

      // mode === 'add'
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
        console.error('[useMessageReactions] insert error', {
          error: res.error,
          code: res.error.code,
          message: res.error.message,
          messageId,
          userId: user.id,
        });
        throw res.error;
      }

      return { action: 'added' as const, newId: res.data?.id };
    },
    onMutate: async (variables) => {
      if (!user) return;

      await queryClient.cancelQueries({ queryKey });

      // Save previous state BEFORE any mutation
      const prev = queryClient.getQueryData<MessageReaction[]>(queryKey) || [];
      
      // Store the real like ID if we're removing (for mutationFn to use)
      const existingLikeId = variables.mode === 'remove'
        ? prev.find(r => r.user_id === user.id && r.reaction_type === 'like')?.id
        : undefined;

      const optimistic: MessageReaction[] = variables.mode === 'remove'
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
      return { prev, existingLikeId };
    },
    onSuccess: (result, variables) => {
      if (result.action === 'added' && result.newId) {
        // Replace optimistic ID with real ID in cache
        queryClient.setQueryData<MessageReaction[]>(queryKey, (old) => {
          if (!old) return old;
          return old.map(r => 
            r.id.startsWith('optimistic-') && r.user_id === user?.id
              ? { ...r, id: result.newId! }
              : r
          );
        });
        haptics.success();
      }
      
      if (result.action === 'added' || result.action === 'removed') {
        callbacksRef.current?.onSuccessCallback?.(result.action);
      }
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);

      const supaError = error as { code?: string; message?: string };
      console.error('[useMessageReactions] toggleLike failed', {
        error,
        code: supaError?.code,
        message: supaError?.message,
        messageId,
        userId: user?.id,
      });

      const errorMsg = supaError?.message || 'Errore sconosciuto';
      toast.error(`Like non salvato: ${errorMsg.substring(0, 60)}`);

      callbacksRef.current?.onErrorCallback?.();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      callbacksRef.current = null;
    },
  });

  const reactions = query.data || [];
  const likes = reactions.filter(r => r.reaction_type === 'like').length;
  const isLiked = reactions.some(r => r.user_id === user?.id && r.reaction_type === 'like');
  const likeUsers = reactions
    .filter(r => r.reaction_type === 'like' && r.user)
    .map(r => r.user as ReactionUser);

  // Wrapper that accepts mode and callbacks
  const toggleLike = (mode: 'add' | 'remove', callbacks?: ToggleLikeCallbacks) => {
    callbacksRef.current = callbacks || null;
    toggleLikeMutation.mutate({ mode });
  };

  return {
    likes,
    isLiked,
    likeUsers,
    toggleLike,
    isMutating: toggleLikeMutation.isPending,
    isLoading: query.isLoading,
  };
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useMemo, useRef, createContext, useContext } from 'react';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';

/**
 * Batched reactions for an entire message thread.
 * Replaces the previous N+1 pattern where every MessageBubble mounted
 * its own useMessageReactions + realtime channel.
 *
 * Uses ONE query per thread + ONE realtime channel filtered by thread_id.
 */

export interface ReactionUser {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

export interface MessageReactionRow {
  id: string;
  message_id: string;
  user_id: string;
  reaction_type: string;
  user?: ReactionUser;
}

export interface MessageReactionAggregate {
  likes: number;
  isLiked: boolean;
  likeUsers: ReactionUser[];
}

const EMPTY_AGG: MessageReactionAggregate = { likes: 0, isLiked: false, likeUsers: [] };

const isValidUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

export function useThreadReactions(threadId: string | undefined, messageIds: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['thread-reactions', threadId] as const;

  // Keep a stable snapshot of message ids for realtime callbacks
  const idsRef = useRef<string[]>(messageIds);
  idsRef.current = messageIds;

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<MessageReactionRow[]> => {
      if (!user || !threadId || messageIds.length === 0) return [];
      const { data, error } = await supabase
        .from('message_reactions')
        .select('id, message_id, user_id, reaction_type')
        .in('message_id', messageIds);
      if (error) throw error;
      const rows = (data || []) as MessageReactionRow[];
      if (rows.length === 0) return [];

      const userIds = [...new Set(rows.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);
      const map = new Map(profiles?.map(p => [p.id, p as ReactionUser]) || []);
      return rows.map(r => ({ ...r, user: map.get(r.user_id) }));
    },
    enabled: !!user && !!threadId && messageIds.length > 0,
    staleTime: 30_000,
  });

  // ONE realtime channel per thread, filtered by thread_id via message id list.
  useEffect(() => {
    if (!user || !threadId) return;
    const channel = supabase
      .channel(`thread-reactions-${threadId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const row = (payload.new || payload.old) as { message_id?: string };
          if (!row?.message_id) return;
          if (!idsRef.current.includes(row.message_id)) return;
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, user, queryClient]);

  // Build map: messageId -> aggregate
  const map = useMemo(() => {
    const out = new Map<string, MessageReactionAggregate>();
    const rows = query.data || [];
    for (const r of rows) {
      if (r.reaction_type !== 'like') continue;
      const cur = out.get(r.message_id) || { likes: 0, isLiked: false, likeUsers: [] };
      cur.likes += 1;
      if (r.user_id === user?.id) cur.isLiked = true;
      if (r.user) cur.likeUsers.push(r.user);
      out.set(r.message_id, cur);
    }
    return out;
  }, [query.data, user?.id]);

  const toggleLike = useMutation({
    mutationFn: async ({
      messageId,
      mode,
    }: { messageId: string; mode: 'add' | 'remove' }) => {
      if (!user) {
        toast.error('Accedi per mettere like ai messaggi');
        return;
      }
      if (mode === 'remove') {
        const rows = queryClient.getQueryData<MessageReactionRow[]>(queryKey) || [];
        const existing = rows.find(
          r => r.message_id === messageId && r.user_id === user.id
            && r.reaction_type === 'like' && isValidUuid(r.id)
        );
        if (!existing) return;
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, user_id: user.id, reaction_type: 'like' });
      if (error) throw error;
      haptics.success();
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<MessageReactionRow[]>(queryKey) || [];
      const next: MessageReactionRow[] = vars.mode === 'remove'
        ? prev.filter(r => !(r.message_id === vars.messageId && r.user_id === user?.id && r.reaction_type === 'like'))
        : [
            ...prev,
            {
              id: `optimistic-${vars.messageId}-${user?.id}`,
              message_id: vars.messageId,
              user_id: user?.id || '',
              reaction_type: 'like',
            },
          ];
      queryClient.setQueryData(queryKey, next);
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      const e = err as { message?: string };
      toast.error(`Like non salvato: ${(e?.message || '').substring(0, 60)}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { map, toggleLike: toggleLike.mutate, isPending: toggleLike.isPending };
}

// ─────────────────────────────────────────────────────────────
// Context so bubbles read reactions without props drilling.
// ─────────────────────────────────────────────────────────────
export interface ThreadReactionsCtx {
  get: (messageId: string) => MessageReactionAggregate;
  toggle: (messageId: string, mode: 'add' | 'remove', onError?: () => void) => void;
  isPending: boolean;
}

const Ctx = createContext<ThreadReactionsCtx | null>(null);
export const ThreadReactionsProvider = Ctx.Provider;

export function useMessageReactionAggregate(messageId: string): ThreadReactionsCtx {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  // Fallback no-op (e.g. NewMessageSheet)
  return {
    get: () => EMPTY_AGG,
    toggle: () => {},
    isPending: false,
  };
}

export { EMPTY_AGG };
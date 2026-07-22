import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect } from "react";

export interface MessageThread {
  id: string;
  created_at: string;
  updated_at: string;
  participants: {
    id: string;
    user_id: string;
    last_read_at: string | null;
    profile: {
      id: string;
      username: string;
      full_name: string | null;
      avatar_url: string | null;
      last_seen_at: string | null;
    };
  }[];
  last_message?: {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
  };
  unread_count?: number;
}

export function useMessageThreads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Realtime: only apply surgical updates for threads already in cache.
  useEffect(() => {
    if (!user) return;
    const queryKey = ['message-threads', user.id];

    const channel = supabase
      .channel('message-threads-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as {
            id: string;
            thread_id: string;
            content: string;
            created_at: string;
            sender_id: string;
          };

          const cached = queryClient.getQueryData<MessageThread[]>(queryKey);
          if (!cached) return;
          const idx = cached.findIndex((t) => t.id === newMsg.thread_id);
          if (idx < 0) {
            // Unknown thread — do a full refetch just this once.
            queryClient.invalidateQueries({ queryKey });
            return;
          }

          const next = cached.slice();
          const target = { ...next[idx] };
          target.last_message = {
            id: newMsg.id,
            content: newMsg.content,
            created_at: newMsg.created_at,
            sender_id: newMsg.sender_id,
          };
          if (newMsg.sender_id !== user.id) {
            target.unread_count = (target.unread_count || 0) + 1;
          }
          next.splice(idx, 1);
          next.unshift(target);
          queryClient.setQueryData(queryKey, next);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return useQuery({
    queryKey: ['message-threads', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Single-round-trip RPC replaces the previous N+1 waterfall.
      const { data, error } = await supabase.rpc('get_thread_overviews', { p_limit: 20 });
      if (error) throw error;

      const rows = (data || []) as Array<{
        thread_id: string;
        created_at: string;
        updated_at: string;
        participants: MessageThread['participants'] | null;
        last_message: MessageThread['last_message'] | null;
        unread_count: number | null;
      }>;

      return rows.map((r) => ({
        id: r.thread_id,
        created_at: r.created_at,
        updated_at: r.updated_at,
        participants: r.participants || [],
        last_message: r.last_message || undefined,
        unread_count: r.unread_count || 0,
      })) as MessageThread[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minuti
    gcTime: 10 * 60 * 1000, // 10 minuti di cache per evitare flash di caricamento
    refetchInterval: 120 * 1000, // Polling di sicurezza ogni 2 minuti (realtime fa il grosso)
    refetchOnWindowFocus: true, // Ri-fetch quando app torna in focus
    refetchOnReconnect: true, // Ri-fetch quando rete si riconnette
    refetchOnMount: false, // Evita refetch immediato se la cache è valida (previene flickering all'ingresso della pagina)
  });
}

export function useCreateThread() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (participantIds: string[]) => {
      if (!user) throw new Error('User not authenticated');

      const allParticipants = [user.id, ...participantIds];
      
      const { data, error } = await supabase.rpc('create_or_get_thread', {
        participant_ids: allParticipants
      });

      if (error) throw error;
      return { thread_id: data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-threads'] });
    },
    onError: (error) => {
      console.error('[useCreateThread] Error:', error);
      toast.error('Impossibile creare la conversazione');
    }
  });
}

export function useMarkThreadAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (threadId: string) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('thread_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('thread_id', threadId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-threads'] });
    }
  });
}

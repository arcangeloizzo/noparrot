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

  // Setup realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('message-threads-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['message-threads', user.id] });
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

      const { data: threads, error } = await supabase
        .from('message_threads')
        .select(`
          id,
          created_at,
          updated_at,
          participants:thread_participants(
            id,
            user_id,
            last_read_at,
            profile:profiles(id, username, full_name, avatar_url, last_seen_at)
          )
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch ultimo messaggio e unread count in parallelo per tutti i thread
      const enrichedThreads = await Promise.all(
        (threads || []).map(async (thread) => {
          const myParticipant = thread.participants?.find((p: any) => p.user_id === user.id);
          const lastReadAt = myParticipant?.last_read_at;

          // Single query per thread invece di 2
          const [{ data: lastMsg }, { count: unreadCount }] = await Promise.all([
            supabase
              .from('messages')
              .select('id, content, created_at, sender_id')
              .eq('thread_id', thread.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
            lastReadAt
              ? supabase
                  .from('messages')
                  .select('*', { count: 'exact', head: true })
                  .eq('thread_id', thread.id)
                  .gt('created_at', lastReadAt)
                  .neq('sender_id', user.id)
              : Promise.resolve({ count: 0 })
          ]);

          return {
            ...thread,
            last_message: lastMsg || undefined,
            unread_count: unreadCount || 0
          };
        })
      );

      return enrichedThreads as MessageThread[];
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 secondi invece di 5 minuti
    refetchInterval: 60 * 1000, // Polling ogni 60 secondi (fallback per iOS)
    refetchOnWindowFocus: true, // Ri-fetch quando app torna in focus
    refetchOnReconnect: true, // Ri-fetch quando rete si riconnette
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

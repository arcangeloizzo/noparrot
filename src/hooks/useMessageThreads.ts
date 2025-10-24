import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

  return useQuery({
    queryKey: ['message-threads', user?.id],
    queryFn: async () => {
      console.log('[useMessageThreads] User:', user?.id);
      if (!user) {
        console.log('[useMessageThreads] No user, returning empty array');
        return [];
      }

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
            profile:profiles(id, username, full_name, avatar_url)
          )
        `)
        .order('updated_at', { ascending: false });

      console.log('[useMessageThreads] Threads data:', threads);
      console.log('[useMessageThreads] Error:', error);

      if (error) {
        console.error('[useMessageThreads] Query error:', error);
        throw error;
      }

      // Fetch ultimo messaggio per ogni thread
      const threadsWithMessages = await Promise.all(
        (threads || []).map(async (thread) => {
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('id, content, created_at, sender_id')
            .eq('thread_id', thread.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Calcola messaggi non letti
          const myParticipant = thread.participants?.find((p: any) => p.user_id === user.id);
          const lastReadAt = myParticipant?.last_read_at;

          let unreadCount = 0;
          if (lastMsg && lastReadAt) {
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('thread_id', thread.id)
              .gt('created_at', lastReadAt)
              .neq('sender_id', user.id);
            
            unreadCount = count || 0;
          }

          return {
            ...thread,
            last_message: lastMsg || undefined,
            unread_count: unreadCount
          };
        })
      );

      console.log('[useMessageThreads] Enriched threads:', threadsWithMessages);
      return threadsWithMessages as MessageThread[];
    },
    enabled: !!user,
    staleTime: 1000 * 30 // 30 secondi
  });
}

export function useCreateThread() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (participantIds: string[]) => {
      if (!user) throw new Error('User not authenticated');

      // Verifica se esiste già un thread tra questi utenti
      const allParticipants = [user.id, ...participantIds];
      
      const { data: existingThreads, error: fetchError } = await supabase
        .from('thread_participants')
        .select('thread_id')
        .in('user_id', allParticipants);

      if (fetchError) throw fetchError;

      // Trova thread con esattamente questi partecipanti
      const threadCounts = existingThreads?.reduce((acc: any, item: any) => {
        acc[item.thread_id] = (acc[item.thread_id] || 0) + 1;
        return acc;
      }, {});

      const existingThreadId = Object.keys(threadCounts || {}).find(
        threadId => threadCounts[threadId] === allParticipants.length
      );

      if (existingThreadId) {
        return { thread_id: existingThreadId };
      }

      // Crea nuovo thread
      const { data: thread, error: threadError } = await supabase
        .from('message_threads')
        .insert({})
        .select()
        .single();

      if (threadError) throw threadError;

      // Aggiungi partecipanti
      const { error: participantsError } = await supabase
        .from('thread_participants')
        .insert(
          allParticipants.map(userId => ({
            thread_id: thread.id,
            user_id: userId
          }))
        );

      if (participantsError) throw participantsError;

      return { thread_id: thread.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-threads'] });
    },
    onError: (error) => {
      console.error('Create thread error:', error);
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

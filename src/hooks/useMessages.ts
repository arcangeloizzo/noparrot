import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  link_url: string | null;
  created_at: string;
  sender: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  media?: {
    id: string;
    url: string;
    type: string;
    mime: string;
  }[];
}

export function useMessages(threadId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['messages', threadId],
    queryFn: async () => {
      if (!threadId || !user) return [];

      // Fetch messages
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          thread_id,
          sender_id,
          content,
          link_url,
          created_at,
          sender:public_profiles!messages_sender_id_fkey(id, username, full_name, avatar_url)
        `)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch user's deleted messages
      const { data: deletedMessages } = await supabase
        .from('message_deletions')
        .select('message_id')
        .eq('user_id', user.id);

      const deletedMessageIds = new Set(deletedMessages?.map(d => d.message_id) || []);

      // Filter out deleted messages
      const visibleMessages = (data || []).filter(msg => !deletedMessageIds.has(msg.id));

      // Fetch media per ogni messaggio
      const messagesWithMedia = await Promise.all(
        visibleMessages.map(async (msg) => {
          const { data: mediaData } = await supabase
            .from('message_media')
            .select(`
              id,
              media:media(id, url, type, mime)
            `)
            .eq('message_id', msg.id)
            .order('order_idx', { ascending: true });

          return {
            ...msg,
            media: mediaData?.map((m: any) => m.media).filter(Boolean) || []
          };
        })
      );

      return messagesWithMedia as Message[];
    },
    enabled: !!threadId && !!user
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      threadId,
      content,
      linkUrl,
      mediaIds
    }: {
      threadId: string;
      content: string;
      linkUrl?: string;
      mediaIds?: string[];
    }) => {
      if (!user) throw new Error('User not authenticated');

      const { data: message, error } = await supabase
        .from('messages')
        .insert({
          thread_id: threadId,
          sender_id: user.id,
          content,
          link_url: linkUrl || null
        })
        .select()
        .single();

      if (error) throw error;

      // Aggiungi media se presenti
      if (mediaIds && mediaIds.length > 0) {
        const { error: mediaError } = await supabase
          .from('message_media')
          .insert(
            mediaIds.map((mediaId, idx) => ({
              message_id: message.id,
              media_id: mediaId,
              order_idx: idx
            }))
          );

        if (mediaError) throw mediaError;
      }

      return message;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.threadId] });
      queryClient.invalidateQueries({ queryKey: ['message-threads'] });
    },
    onError: (error) => {
      console.error('Send message error:', error);
      toast.error('Impossibile inviare il messaggio');
    }
  });
}

// Hook per eliminare un messaggio dalla propria vista
export function useDeleteMessageForMe() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ messageId, threadId }: { messageId: string; threadId: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('message_deletions')
        .insert({
          message_id: messageId,
          user_id: user.id
        });

      if (error) throw error;
      return { messageId, threadId };
    },
    onSuccess: (variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.threadId] });
      toast.success('Messaggio rimosso dalla tua chat');
    },
    onError: (error) => {
      console.error('Delete message error:', error);
      toast.error('Impossibile eliminare il messaggio');
    }
  });
}
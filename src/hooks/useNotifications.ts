import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { usePushNotifications } from './usePushNotifications';

export interface Notification {
  id: string;
  user_id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'message_like' | 'reshare';
  actor_id: string;
  post_id: string | null;
  comment_id: string | null;
  message_id: string | null;
  read: boolean;
  created_at: string;
  actor: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
  post?: {
    id: string;
    content: string;
  } | null;
  comment?: {
    id: string;
    content: string;
  } | null;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { permission, sendNotification } = usePushNotifications();

  const query = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          user_id,
          type,
          actor_id,
          post_id,
          comment_id,
          message_id,
          read,
          created_at,
          actor:public_profiles!actor_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          post:posts (
            id,
            content
          ),
          comment:comments!comment_id (
            id,
            content
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user
  });

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
          
          // Send browser notification if permission granted
          if (permission === 'granted' && payload.new) {
            const notif = payload.new as any;
            let title = 'NoParrot';
            let body = '';
            
            switch (notif.type) {
              case 'like':
                title = 'Nuovo like ❤️';
                body = 'Il tuo post è piaciuto!';
                break;
              case 'comment':
                title = 'Nuovo commento 💬';
                body = 'Qualcuno ha commentato il tuo post';
                break;
              case 'follow':
                title = 'Nuovo follower 👤';
                body = 'Hai un nuovo follower!';
                break;
              case 'mention':
                title = 'Nuova menzione @';
                body = 'Sei stato menzionato in un post';
                break;
              case 'message_like':
                title = 'Like al messaggio ❤️';
                body = 'Il tuo messaggio è piaciuto!';
                break;
              case 'reshare':
                title = 'Nuovo reshare 🔄';
                body = 'Il tuo post è stato condiviso!';
                break;
            }
            
            sendNotification(title, {
              body,
              tag: notif.type,
              data: { url: notif.post_id ? `/post/${notif.post_id}` : '/notifications' }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, permission, sendNotification]);

  return query;
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onMutate: async (notificationId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications', user?.id] });

      // Snapshot the previous value
      const previousNotifications = queryClient.getQueryData<Notification[]>(['notifications', user?.id]);

      // Optimistically update to the new value
      queryClient.setQueryData<Notification[]>(['notifications', user?.id], (old) =>
        old?.map(n => n.id === notificationId ? { ...n, read: true } : n) ?? []
      );

      return { previousNotifications };
    },
    onError: (_err, _notificationId, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications', user?.id], context.previousNotifications);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    }
  });
};

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    }
  });
};

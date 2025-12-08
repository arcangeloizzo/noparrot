import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useOnlinePresence() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const updateLastSeen = useCallback(async () => {
    if (!user) return;
    try {
      await supabase.rpc('update_last_seen');
    } catch (error) {
      console.error('Error updating last_seen:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('presence:messages', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const online = new Set<string>();
        Object.keys(state).forEach((key) => {
          online.add(key);
        });
        setOnlineUsers(online);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUsers((prev) => new Set([...prev, key]));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
          await updateLastSeen();
        }
      });

    // Heartbeat: update last_seen every 30 seconds
    const heartbeatInterval = setInterval(() => {
      updateLastSeen();
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      supabase.removeChannel(channel);
    };
  }, [user, updateLastSeen]);

  const isOnline = useCallback((userId: string) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  return { onlineUsers, isOnline };
}

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useGlobalRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Global subscription to comments and reactions to ensure feed is always up to date
    const channel = supabase
      .channel('global-activity')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        (payload: any) => {
          // Invalidate global posts query to update comment counts
          queryClient.invalidateQueries({ queryKey: ['posts'] });
          // Invalidate notifications so the bell updates
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          
          const postId = payload.new?.post_id || payload.old?.post_id;
          if (postId) {
            // Update the single post query cache
            queryClient.invalidateQueries({ queryKey: ['post', postId] });
            // Invalidate the comments list for that post
            queryClient.invalidateQueries({ queryKey: ['comments', postId] });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions' },
        (payload: any) => {
          // Invalidate posts to update reaction counts (likes, etc)
          queryClient.invalidateQueries({ queryKey: ['posts'] });
          // Invalidate saved posts in case a bookmark was added/removed
          queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
          
          const postId = payload.new?.post_id || payload.old?.post_id;
          if (postId) {
            // Update the single post query cache
            queryClient.invalidateQueries({ queryKey: ['post', postId] });
            // Invalidate post reactors
            queryClient.invalidateQueries({ queryKey: ['post-reactors', postId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

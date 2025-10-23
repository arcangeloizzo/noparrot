import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  level: number;
  author: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
  media?: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail_url?: string | null;
    width?: number | null;
    height?: number | null;
  }>;
}

export const useComments = (postId: string) => {
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          post_id,
          author_id,
          content,
          created_at,
          parent_id,
          level,
          author:profiles!author_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          comment_media!comment_media_comment_id_fkey (
            order_idx,
            media:media_id (
              id,
              type,
              url,
              thumbnail_url,
              width,
              height
            )
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true }); // Dal più vecchio al più recente

      if (error) throw error;
      
      return (data || []).map((comment: any) => ({
        ...comment,
        media: (comment.comment_media || [])
          .sort((a: any, b: any) => a.order_idx - b.order_idx)
          .map((cm: any) => cm.media)
          .filter(Boolean)
      })) as Comment[];
    },
    enabled: !!postId
  });
};

export const useAddComment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      postId, 
      content, 
      parentId = null,
      level = 0
    }: { 
      postId: string; 
      content: string;
      parentId?: string | null;
      level?: number;
    }) => {
      if (!user) throw new Error('Not authenticated');

      console.log('[useComments] ==========================================');
      console.log('[useComments] Inserting comment into database:');
      console.log('[useComments] - post_id:', postId);
      console.log('[useComments] - author_id:', user.id);
      console.log('[useComments] - parent_id:', parentId);
      console.log('[useComments] - level:', level);
      console.log('[useComments] - content length:', content.length);
      console.log('[useComments] ==========================================');

      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          content,
          parent_id: parentId,
          level
        })
        .select('id')
        .single();

      if (error) {
        console.error('[useAddComment] Error inserting comment:', error);
        throw error;
      }
      
      console.log('[useAddComment] Comment inserted successfully:', data.id);
      return data.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Commento pubblicato!');
    },
    onError: (error) => {
      toast.error('Errore nella pubblicazione del commento');
      console.error(error);
    }
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Commento eliminato');
    },
    onError: (error) => {
      toast.error('Errore nell\'eliminazione del commento');
      console.error(error);
    }
  });
};

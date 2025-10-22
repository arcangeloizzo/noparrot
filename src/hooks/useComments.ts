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
        .order('created_at', { ascending: false }); // Dal più recente al più vecchio

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
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          content
        })
        .select('id')
        .single();

      if (error) throw error;
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

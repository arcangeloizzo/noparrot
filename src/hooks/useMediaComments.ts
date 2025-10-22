import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface MediaComment {
  id: string;
  media_id: string;
  author_id: string;
  content: string;
  parent_id: string | null;
  level: number;
  created_at: string;
  author: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export const useMediaComments = (mediaId: string) => {
  return useQuery({
    queryKey: ['media-comments', mediaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('media_comments')
        .select(`
          id,
          media_id,
          author_id,
          content,
          parent_id,
          level,
          created_at
        `)
        .eq('media_id', mediaId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Fetch authors separately
      const authorIds = [...new Set(data.map(c => c.author_id))];
      const { data: authors } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', authorIds);
      
      const authorsMap = new Map(authors?.map(a => [a.id, a]) || []);
      
      return data.map(comment => ({
        ...comment,
        author: authorsMap.get(comment.author_id) || {
          id: comment.author_id,
          username: 'unknown',
          full_name: 'Unknown User',
          avatar_url: null
        }
      })) as MediaComment[];
    },
    enabled: !!mediaId
  });
};

export const useAddMediaComment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      mediaId, 
      content, 
      parentId = null,
      level = 0
    }: { 
      mediaId: string; 
      content: string;
      parentId?: string | null;
      level?: number;
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('media_comments')
        .insert({
          media_id: mediaId,
          author_id: user.id,
          content,
          parent_id: parentId,
          level
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['media-comments', variables.mediaId] });
      toast.success('Commento pubblicato!');
    },
    onError: () => {
      toast.error('Errore nella pubblicazione del commento');
    }
  });
};

export const useDeleteMediaComment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('media_comments')
        .delete()
        .eq('id', commentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-comments'] });
      toast.success('Commento eliminato');
    },
    onError: () => {
      toast.error("Errore nell'eliminazione del commento");
    }
  });
};

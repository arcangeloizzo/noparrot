import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface FocusComment {
  id: string;
  focus_id: string;
  focus_type: 'daily' | 'interest';
  author_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  level: number;
  is_verified: boolean | null;
  author: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export const useFocusComments = (focusId: string, focusType: 'daily' | 'interest') => {
  return useQuery({
    queryKey: ['focus-comments', focusId, focusType],
    queryFn: async () => {
      const { data: commentsData, error: commentsError } = await supabase
        .from('focus_comments')
        .select(`
          id,
          focus_id,
          focus_type,
          author_id,
          content,
          created_at,
          parent_id,
          level,
          is_verified,
          author:profiles!author_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('focus_id', focusId)
        .eq('focus_type', focusType)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      const comments = (commentsData || []).map((comment: any) => ({
        ...comment,
        author: comment.author
      }));

      const commentsWithReactions = await Promise.all(
        comments.map(async (c: any) => {
          const { data: repliesData } = await supabase
            .from('focus_comments')
            .select('id')
            .eq('parent_id', c.id);
          
          return { 
            ...c, 
            likesCount: 0, // Future implementation
            repliesCount: repliesData?.length || 0
          };
        })
      );

      return commentsWithReactions;
    },
    enabled: !!focusId
  });
};

export const useAddFocusComment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      focusId,
      focusType,
      content, 
      parentId = null,
      level = 0,
      isVerified = false
    }: { 
      focusId: string;
      focusType: 'daily' | 'interest';
      content: string;
      parentId?: string | null;
      level?: number;
      isVerified?: boolean;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('focus_comments')
        .insert({
          focus_id: focusId,
          focus_type: focusType,
          author_id: user.id,
          content,
          parent_id: parentId,
          level,
          is_verified: isVerified
        })
        .select('id')
        .single();

      if (error) throw error;
      
      // Update comment count in focus table
      const tableName = focusType === 'daily' ? 'daily_focus' : 'interest_focus';
      const { data: focusData } = await supabase
        .from(tableName)
        .select('reactions')
        .eq('id', focusId)
        .single();
      
      if (focusData) {
        const reactions = focusData.reactions as any || { likes: 0, comments: 0, shares: 0 };
        await supabase
          .from(tableName)
          .update({ 
            reactions: { 
              ...reactions, 
              comments: (reactions.comments || 0) + 1 
            } 
          })
          .eq('id', focusId);
      }

      return data.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['focus-comments', variables.focusId, variables.focusType] });
      queryClient.invalidateQueries({ queryKey: ['daily-focus'] });
      queryClient.invalidateQueries({ queryKey: ['interest-focus'] });
      toast.success('Commento pubblicato');
    },
    onError: (error) => {
      toast.error('Errore nella pubblicazione del commento');
      console.error(error);
    }
  });
};

export const useDeleteFocusComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, focusId, focusType }: { commentId: string; focusId: string; focusType: 'daily' | 'interest' }) => {
      const { error } = await supabase
        .from('focus_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      
      // Update comment count in focus table
      const tableName = focusType === 'daily' ? 'daily_focus' : 'interest_focus';
      const { data: focusData } = await supabase
        .from(tableName)
        .select('reactions')
        .eq('id', focusId)
        .single();
      
      if (focusData) {
        const reactions = focusData.reactions as any || { likes: 0, comments: 0, shares: 0 };
        await supabase
          .from(tableName)
          .update({ 
            reactions: { 
              ...reactions, 
              comments: Math.max(0, (reactions.comments || 0) - 1)
            } 
          })
          .eq('id', focusId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['focus-comments'] });
      queryClient.invalidateQueries({ queryKey: ['daily-focus'] });
      queryClient.invalidateQueries({ queryKey: ['interest-focus'] });
      toast.success('Commento eliminato');
    },
    onError: (error) => {
      toast.error('Errore nell\'eliminazione del commento');
      console.error(error);
    }
  });
};

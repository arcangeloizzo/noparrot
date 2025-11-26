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
  passed_gate: boolean;
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

export const useComments = (postId: string, sortMode: 'relevance' | 'recent' | 'top' = 'relevance') => {
  return useQuery({
    queryKey: ['comments', postId, sortMode],
    queryFn: async () => {
      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select(`
          id,
          post_id,
          author_id,
          content,
          created_at,
          parent_id,
          level,
          passed_gate,
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
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Map comments with media
      const comments = (commentsData || []).map((comment: any) => ({
        ...comment,
        media: (comment.comment_media || [])
          .sort((a: any, b: any) => a.order_idx - b.order_idx)
          .map((cm: any) => cm.media)
          .filter(Boolean)
      }));

      // Fetch reactions count for each comment
      const commentsWithReactions = await Promise.all(
        comments.map(async (c: any) => {
          const { data: reactionsData } = await supabase
            .from('comment_reactions')
            .select('id')
            .eq('comment_id', c.id)
            .eq('reaction_type', 'heart');
          
          const { data: repliesData } = await supabase
            .from('comments')
            .select('id')
            .eq('parent_id', c.id);
          
          return { 
            ...c, 
            likesCount: reactionsData?.length || 0,
            repliesCount: repliesData?.length || 0
          };
        })
      );

      // Sort comments based on mode
      return sortCommentsByMode(commentsWithReactions, sortMode);
    },
    enabled: !!postId
  });
};

// Helper to calculate relevance score
const calculateRelevance = (comment: any): number => {
  const likesWeight = (comment.likesCount || 0) * 2;
  const repliesWeight = (comment.repliesCount || 0) * 3;
  
  // Boost if created in last 24h
  const hoursSinceCreation = (Date.now() - new Date(comment.created_at).getTime()) / (1000 * 60 * 60);
  const recencyBoost = hoursSinceCreation < 24 ? 5 : 0;
  
  return likesWeight + repliesWeight + recencyBoost;
};

// Sort comments by mode (per-thread, not global)
const sortCommentsByMode = (comments: any[], mode: string): any[] => {
  const topLevel = comments.filter(c => !c.parent_id);
  const repliesMap = new Map<string, any[]>();
  
  // Group replies by parent_id
  comments.filter(c => c.parent_id).forEach(comment => {
    const parentId = comment.parent_id!;
    if (!repliesMap.has(parentId)) {
      repliesMap.set(parentId, []);
    }
    repliesMap.get(parentId)!.push(comment);
  });
  
  // Sort siblings based on mode
  const sortSiblings = (siblings: any[]) => {
    if (mode === 'recent') {
      return siblings.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (mode === 'top') {
      return siblings.sort((a, b) => 
        (b.likesCount || 0) - (a.likesCount || 0)
      );
    } else {
      // relevance
      return siblings.sort((a, b) => 
        calculateRelevance(b) - calculateRelevance(a)
      );
    }
  };
  
  // Sort top level
  const sortedTopLevel = sortSiblings([...topLevel]);
  
  // Sort replies for each parent
  repliesMap.forEach((replies, parentId) => {
    repliesMap.set(parentId, sortSiblings(replies));
  });
  
  return comments;
};

export const useAddComment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      postId, 
      content, 
      parentId = null,
      level = 0,
      passedGate = false
    }: { 
      postId: string; 
      content: string;
      parentId?: string | null;
      level?: number;
      passedGate?: boolean;
    }) => {
      if (!user) throw new Error('Not authenticated');

      console.log('[useComments] ==========================================');
      console.log('[useComments] Inserting comment into database:');
      console.log('[useComments] - post_id:', postId);
      console.log('[useComments] - author_id:', user.id);
      console.log('[useComments] - parent_id:', parentId);
      console.log('[useComments] - level:', level);
      console.log('[useComments] - passed_gate:', passedGate);
      console.log('[useComments] - content length:', content.length);
      console.log('[useComments] ==========================================');

      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          content,
          parent_id: parentId,
          level,
          passed_gate: passedGate
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
      toast.success('Il tuo punto di vista è arrivato.');
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

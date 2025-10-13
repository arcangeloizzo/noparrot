import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Post {
  id: string;
  author: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  content: string;
  topic_tag: string | null;
  shared_title: string | null;
  shared_url: string | null;
  preview_img: string | null;
  full_article: string | null;
  trust_level: 'BASSO' | 'MEDIO' | 'ALTO' | null;
  stance: 'Condiviso' | 'Confutato' | null;
  sources: string[];
  created_at: string;
  quoted_post_id: string | null;
  quoted_post?: {
    id: string;
    content: string;
    created_at: string;
    shared_url?: string | null;
    shared_title?: string | null;
    preview_img?: string | null;
    author: {
      username: string;
      full_name: string | null;
      avatar_url: string | null;
    };
  } | null;
  reactions: {
    hearts: number;
    comments: number;
  };
  user_reactions: {
    has_hearted: boolean;
    has_bookmarked: boolean;
  };
  questions: Array<{
    id: string;
    question_text: string;
    options: string[];
    correct_index: number;
  }>;
}

export const usePosts = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['posts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!author_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          quoted_post:posts!quoted_post_id (
            id,
            content,
            created_at,
            shared_url,
            shared_title,
            preview_img,
            author:profiles!author_id (
              username,
              full_name,
              avatar_url
            )
          ),
          questions (*),
          reactions (
            reaction_type,
            user_id
          ),
          comments(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((post: any) => ({
        id: post.id,
        author: post.author,
        content: post.content,
        topic_tag: post.topic_tag,
        shared_title: post.shared_title,
        shared_url: post.shared_url,
        preview_img: post.preview_img,
        full_article: post.full_article,
        trust_level: post.trust_level,
        stance: post.stance,
        sources: post.sources || [],
        created_at: post.created_at,
        quoted_post_id: post.quoted_post_id,
        quoted_post: post.quoted_post ? {
          id: post.quoted_post.id,
          content: post.quoted_post.content,
          created_at: post.quoted_post.created_at,
          shared_url: post.quoted_post.shared_url,
          shared_title: post.quoted_post.shared_title,
          preview_img: post.quoted_post.preview_img,
          author: post.quoted_post.author
        } : null,
        reactions: {
          hearts: post.reactions?.filter((r: any) => r.reaction_type === 'heart').length || 0,
          comments: post.comments?.[0]?.count || 0
        },
        user_reactions: {
          has_hearted: post.reactions?.some((r: any) => 
            r.reaction_type === 'heart' && r.user_id === user?.id
          ) || false,
          has_bookmarked: post.reactions?.some((r: any) => 
            r.reaction_type === 'bookmark' && r.user_id === user?.id
          ) || false
        },
        questions: (post.questions || [])
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((q: any) => ({
            id: q.id,
            question_text: q.question_text,
            options: q.options as string[],
            correct_index: q.correct_index
          }))
      }));
    },
    enabled: !!user
  });
};

export const useToggleReaction = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      postId, 
      reactionType 
    }: { 
      postId: string; 
      reactionType: 'heart' | 'bookmark' 
    }) => {
      if (!user) return;

      const { data: existing } = await supabase
        .from('reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('reaction_type', reactionType)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('reactions')
          .delete()
          .eq('id', existing.id);
      } else {
        await supabase
          .from('reactions')
          .insert({
            post_id: postId,
            user_id: user.id,
            reaction_type: reactionType
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    }
  });
};

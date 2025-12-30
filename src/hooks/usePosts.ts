import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { updateCognitiveDensityWeighted } from '@/lib/cognitiveDensity';

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
  article_content: string | null;
  trust_level: 'BASSO' | 'MEDIO' | 'ALTO' | null;
  stance: 'Condiviso' | 'Confutato' | null;
  sources: string[];
  created_at: string;
  quoted_post_id: string | null;
  category: string | null;
  _originalSources?: string[];
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
  media?: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail_url?: string | null;
    width?: number | null;
    height?: number | null;
    mime?: string;
    duration_sec?: number | null;
  }>;
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
    staleTime: 0, // Pre-carica sempre dati freschi per welcome screen
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
          questions (*),
          reactions (
            reaction_type,
            user_id
          ),
          comments(count),
          post_media!post_media_post_id_fkey (
            order_idx,
            media:media_id (
              id,
              type,
              url,
              thumbnail_url,
              width,
              height,
              mime,
              duration_sec
            )
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
          )
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
        article_content: post.article_content,
        trust_level: post.trust_level,
        stance: post.stance,
        sources: post.sources || [],
        created_at: post.created_at,
        quoted_post_id: post.quoted_post_id,
        category: post.category || null,
        quoted_post: post.quoted_post || null,
        media: (post.post_media || [])
          .sort((a: any, b: any) => a.order_idx - b.order_idx)
          .map((pm: any) => pm.media)
          .filter(Boolean),
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
    mutationFn: async ({ postId, reactionType }: { postId: string; reactionType: 'heart' | 'bookmark' }) => {
      if (!user) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('reaction_type', reactionType)
        .maybeSingle();

      if (existing) {
        // Rimuovi reazione
        await supabase
          .from('reactions')
          .delete()
          .eq('id', existing.id);
      } else {
        // Aggiungi reazione
        await supabase
          .from('reactions')
          .insert({
            post_id: postId,
            user_id: user.id,
            reaction_type: reactionType,
          });

        // Se è un like (heart), aggiorna cognitive density
        if (reactionType === 'heart') {
          const { data: postData } = await supabase
            .from('posts')
            .select('category')
            .eq('id', postId)
            .single();
          
          if (postData?.category) {
            await updateCognitiveDensityWeighted(user.id, postData.category, 'LIKE');
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
    }
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error('Devi essere loggato');

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('author_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
    }
  });
};

export const useSavedPosts = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['saved-posts', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('reactions')
        .select(`
          created_at,
          posts!inner (
            *,
            author:profiles!author_id (
              id,
              username,
              full_name,
              avatar_url
            ),
            reactions (
              reaction_type,
              user_id
            ),
            comments(count)
          )
        `)
        .eq('user_id', user.id)
        .eq('reaction_type', 'bookmark')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((item: any) => {
        const post = item.posts;
        return {
          id: post.id,
          author: post.author,
          content: post.content,
          shared_url: post.shared_url,
          shared_title: post.shared_title,
          preview_img: post.preview_img,
          full_article: post.full_article,
          article_content: post.article_content,
          trust_level: post.trust_level,
          topic_tag: post.topic_tag,
          stance: post.stance,
          sources: post.sources || [],
          created_at: post.created_at,
          quoted_post_id: post.quoted_post_id,
          category: post.category || null,
          quoted_post: null,
          reactions: {
            hearts: post.reactions?.filter((r: any) => r.reaction_type === 'heart').length || 0,
            comments: post.comments?.[0]?.count || 0,
          },
          user_reactions: {
            has_hearted: post.reactions?.some((r: any) => r.reaction_type === 'heart' && r.user_id === user.id) || false,
            has_bookmarked: true,
          },
          questions: []
        };
      });
    },
    enabled: !!user
  });
};

export const useQuotedPost = (quotedPostId: string | null) => {
  return useQuery({
    queryKey: ['quoted-post', quotedPostId],
    queryFn: async () => {
      if (!quotedPostId) return null;
      
      const { data, error } = await supabase
        .from('posts')
        .select(`
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
        `)
        .eq('id', quotedPostId)
        .single();
      
      if (error) {
        console.error('Error fetching quoted post:', error);
        return null;
      }
      return data;
    },
    enabled: !!quotedPostId
  });
};

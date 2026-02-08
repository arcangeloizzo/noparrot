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
  /** Flag to bypass gate - set when quiz was already passed in Feed Reader */
  _gatePassed?: boolean;
  quoted_post?: {
    id: string;
    content: string;
    created_at: string;
    shared_url?: string | null;
    shared_title?: string | null;
    preview_img?: string | null;
    is_intent?: boolean;
    author: {
      username: string;
      full_name: string | null;
      avatar_url: string | null;
    };
    media?: Array<{
      id: string;
      type: 'image' | 'video';
      url: string;
      extracted_status?: string | null;
      extracted_text?: string | null;
      extracted_kind?: string | null;
    }>;
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
    extracted_status?: string | null;
    extracted_text?: string | null;
    extracted_kind?: string | null;
  }>;
  reactions: {
    hearts: number;
    comments: number;
    byType: Record<string, number>;
  };
  user_reactions: {
    has_hearted: boolean;
    has_bookmarked: boolean;
    myReactionType: 'heart' | 'laugh' | 'wow' | 'sad' | 'fire' | null;
  };
  questions: Array<{
    id: string;
    question_text: string;
    options: string[];
    correct_index: number;
  }>;
  shares_count?: number;
  is_intent?: boolean;
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
          author:public_profiles!author_id (
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
              duration_sec,
              extracted_status,
              extracted_text,
              extracted_kind
            )
          ),
          quoted_post:posts!quoted_post_id (
            id,
            content,
            created_at,
            shared_url,
            shared_title,
            preview_img,
            is_intent,
            author:public_profiles!author_id (
              username,
              full_name,
              avatar_url
            ),
            post_media!post_media_post_id_fkey (
              order_idx,
              media:media_id (
                id,
                type,
                url,
                extracted_status,
                extracted_text,
                extracted_kind
              )
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
        quoted_post: post.quoted_post ? {
          ...post.quoted_post,
          media: (post.quoted_post.post_media || [])
            .sort((a: any, b: any) => a.order_idx - b.order_idx)
            .map((pm: any) => pm.media)
            .filter(Boolean)
        } : null,
        shares_count: post.shares_count ?? 0,
        is_intent: post.is_intent ?? false,
        media: (post.post_media || [])
          .sort((a: any, b: any) => a.order_idx - b.order_idx)
          .map((pm: any) => pm.media)
          .filter(Boolean),
        reactions: {
          // Conta TUTTE le reazioni non-bookmark (heart, laugh, wow, sad, fire)
          hearts: post.reactions?.filter((r: any) => 
            r.reaction_type && r.reaction_type !== 'bookmark'
          ).length || 0,
          comments: post.comments?.[0]?.count || 0,
          byType: (post.reactions || []).reduce((acc: Record<string, number>, r: any) => {
            if (r.reaction_type && r.reaction_type !== 'bookmark') {
              acc[r.reaction_type] = (acc[r.reaction_type] || 0) + 1;
            }
            return acc;
          }, {} as Record<string, number>),
        },
        user_reactions: {
          has_hearted: post.reactions?.some((r: any) => 
            r.reaction_type !== 'bookmark' && r.user_id === user?.id
          ) || false,
          has_bookmarked: post.reactions?.some((r: any) => 
            r.reaction_type === 'bookmark' && r.user_id === user?.id
          ) || false,
          myReactionType: post.reactions?.find((r: any) => 
            r.reaction_type !== 'bookmark' && r.user_id === user?.id
          )?.reaction_type || null
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

export type PostReactionType = 'heart' | 'bookmark' | 'laugh' | 'wow' | 'sad' | 'fire';

export const useToggleReaction = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ postId, reactionType }: { postId: string; reactionType: PostReactionType }) => {
      if (!user) throw new Error('Not authenticated');

      const isBookmark = reactionType === 'bookmark';

      if (isBookmark) {
        // Bookmark logic: toggle on/off
        const { data: existing } = await supabase
          .from('reactions')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .eq('reaction_type', 'bookmark')
          .maybeSingle();

        if (existing) {
          await supabase.from('reactions').delete().eq('id', existing.id);
          return { action: 'removed' as const };
        } else {
          await supabase.from('reactions').insert({
            post_id: postId,
            user_id: user.id,
            reaction_type: 'bookmark',
          });
          return { action: 'added' as const };
        }
      }

      // Non-bookmark reactions: handle toggle & switch between types
      const { data: existing } = await supabase
        .from('reactions')
        .select('id, reaction_type')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .neq('reaction_type', 'bookmark')
        .maybeSingle();

      if (existing) {
        if (existing.reaction_type === reactionType) {
          // Same type -> toggle off
          await supabase.from('reactions').delete().eq('id', existing.id);
          return { action: 'removed' as const, previousType: existing.reaction_type };
        } else {
          // Different type -> switch (update)
          await supabase
            .from('reactions')
            .update({ reaction_type: reactionType })
            .eq('id', existing.id);
          return { action: 'switched' as const, previousType: existing.reaction_type };
        }
      } else {
        // No existing -> add new reaction
        await supabase.from('reactions').insert({
          post_id: postId,
          user_id: user.id,
          reaction_type: reactionType,
        });

        // Cognitive density update for new likes
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
        return { action: 'added' as const };
      }
    },
    
    // ===== OPTIMISTIC UI: Instant feedback, rollback on error =====
    onMutate: async ({ postId, reactionType }) => {
      if (!user) return;
      
      // 1. Cancel in-flight queries to avoid race conditions
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      await queryClient.cancelQueries({ queryKey: ['saved-posts'] });
      await queryClient.cancelQueries({ queryKey: ['post', postId] });
      
      // 2. Snapshot previous state for rollback
      const previousPosts = queryClient.getQueryData(['posts', user.id]);
      const previousSaved = queryClient.getQueryData(['saved-posts', user.id]);
      const previousPost = queryClient.getQueryData(['post', postId]);
      
      // 3. Optimistically update cache immediately
      queryClient.setQueryData(['posts', user.id], (old: Post[] | undefined) => {
        if (!old) return old;
        return old.map(post => {
          if (post.id !== postId) return post;
          
          const isBookmark = reactionType === 'bookmark';
          const currentReaction = post.user_reactions.myReactionType;
          const isSameReaction = currentReaction === reactionType;
          
          if (isBookmark) {
            return {
              ...post,
              user_reactions: {
                ...post.user_reactions,
                has_bookmarked: !post.user_reactions.has_bookmarked
              }
            };
          }
          
          // Calculate new byType counts
          const newByType = { ...post.reactions.byType };
          let newHeartsCount = post.reactions.hearts;
          
          if (isSameReaction) {
            // Toggle off: remove current reaction
            newByType[reactionType] = Math.max(0, (newByType[reactionType] || 0) - 1);
            newHeartsCount = Math.max(0, newHeartsCount - 1);
            
            return {
              ...post,
              reactions: {
                ...post.reactions,
                hearts: newHeartsCount,
                byType: newByType,
              },
              user_reactions: {
                ...post.user_reactions,
                has_hearted: false,
                myReactionType: null
              }
            };
          } else {
            // Add or switch
            // If there was a previous reaction, decrement its count
            if (currentReaction) {
              newByType[currentReaction] = Math.max(0, (newByType[currentReaction] || 0) - 1);
            } else {
              // New reaction, increment total
              newHeartsCount += 1;
            }
            // Increment new reaction count
            newByType[reactionType] = (newByType[reactionType] || 0) + 1;
            
            return {
              ...post,
              reactions: {
                ...post.reactions,
                hearts: newHeartsCount,
                byType: newByType,
              },
              user_reactions: {
                ...post.user_reactions,
                has_hearted: true,
                myReactionType: reactionType as 'heart' | 'laugh' | 'wow' | 'sad' | 'fire'
              }
            };
          }
        });
      });
      
      // Also update saved-posts if it's a bookmark toggle
      if (reactionType === 'bookmark') {
        queryClient.setQueryData(['saved-posts', user.id], (old: Post[] | undefined) => {
          if (!old) return old;
          return old.map(post => {
            if (post.id !== postId) return post;
            return {
              ...post,
              user_reactions: {
                ...post.user_reactions,
                has_bookmarked: !post.user_reactions.has_bookmarked
              }
            };
          });
        });
      }
      
      // Also update single post query (for /post/:id route) - usa stessa logica di ['posts']
      queryClient.setQueryData(['post', postId], (old: Post | undefined) => {
        if (!old) return old;
        
        const isBookmark = reactionType === 'bookmark';
        const currentReaction = old.user_reactions.myReactionType;
        const isSameReaction = currentReaction === reactionType;
        
        if (isBookmark) {
          return {
            ...old,
            user_reactions: {
              ...old.user_reactions,
              has_bookmarked: !old.user_reactions.has_bookmarked
            }
          };
        }
        
        // Calculate new byType counts
        const newByType = { ...old.reactions.byType };
        let newHeartsCount = old.reactions.hearts;
        
        if (isSameReaction) {
          // Toggle off: remove current reaction
          newByType[reactionType] = Math.max(0, (newByType[reactionType] || 0) - 1);
          newHeartsCount = Math.max(0, newHeartsCount - 1);
          
          return {
            ...old,
            reactions: {
              ...old.reactions,
              hearts: newHeartsCount,
              byType: newByType,
            },
            user_reactions: {
              ...old.user_reactions,
              has_hearted: false,
              myReactionType: null
            }
          };
        } else {
          // Add or switch
          if (currentReaction) {
            newByType[currentReaction] = Math.max(0, (newByType[currentReaction] || 0) - 1);
          } else {
            newHeartsCount += 1;
          }
          newByType[reactionType] = (newByType[reactionType] || 0) + 1;
          
          return {
            ...old,
            reactions: {
              ...old.reactions,
              hearts: newHeartsCount,
              byType: newByType,
            },
            user_reactions: {
              ...old.user_reactions,
              has_hearted: true,
              myReactionType: reactionType as 'heart' | 'laugh' | 'wow' | 'sad' | 'fire'
            }
          };
        }
      });
      
      // 4. Return context for rollback
      return { previousPosts, previousSaved, previousPost };
    },
    
    // Rollback on error
    onError: (_err, variables, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(['posts', user?.id], context.previousPosts);
      }
      if (context?.previousSaved) {
        queryClient.setQueryData(['saved-posts', user?.id], context.previousSaved);
      }
      if (context?.previousPost) {
        queryClient.setQueryData(['post', variables.postId], context.previousPost);
      }
    },
    
    // Background sync for consistency (no blocking)
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', variables.postId] });
      // Invalida post-reactors per sincronizzare il drawer delle reazioni
      queryClient.invalidateQueries({ queryKey: ['post-reactors', variables.postId] });
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
            author:public_profiles!author_id (
              id,
              username,
              full_name,
              avatar_url
            ),
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
            )
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
          media: (post.post_media || [])
            .sort((a: any, b: any) => a.order_idx - b.order_idx)
            .map((pm: any) => pm.media)
            .filter(Boolean),
          reactions: {
            hearts: post.reactions?.filter((r: any) => r.reaction_type === 'heart').length || 0,
            comments: post.comments?.[0]?.count || 0,
            byType: (post.reactions || []).reduce((acc: Record<string, number>, r: any) => {
              if (r.reaction_type && r.reaction_type !== 'bookmark') {
                acc[r.reaction_type] = (acc[r.reaction_type] || 0) + 1;
              }
              return acc;
            }, {} as Record<string, number>),
          },
          user_reactions: {
            has_hearted: post.reactions?.some((r: any) => r.reaction_type !== 'bookmark' && r.user_id === user.id) || false,
            has_bookmarked: true,
            myReactionType: (post.reactions?.find((r: any) => r.reaction_type !== 'bookmark' && r.user_id === user.id)?.reaction_type || null) as 'heart' | 'laugh' | 'wow' | 'sad' | 'fire' | null
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
          is_intent,
          author:public_profiles!author_id (
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

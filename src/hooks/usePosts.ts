import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
// Phase 4.4: rimosso import updateCognitiveDensityWeighted (sistema density refactored a vista derivata).

export interface Post {
  id: string;
  author: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    is_ai_institutional?: boolean;
  };
  content: string;
  title?: string;
  topic_tag: string | null;
  shared_title: string | null;
  shared_url: string | null;
  preview_img: string | null;
  preview_img_width?: number | null;
  preview_img_height?: number | null;
  preview_img_ratio?: string | null;
  preview_img_orientation?: string | null;
  preview_img_ambient_url?: string | null;
  trust_level: 'BASSO' | 'MEDIO' | 'ALTO' | null;
  stance: 'Condiviso' | 'Confutato' | null;
  sources: string[];
  created_at: string;
  quoted_post_id: string | null;
  category: string | null;
  post_type?: string;
  voice_post_id?: string | null;
  voice_post?: {
    audio_url: string;
    duration_seconds: number;
    waveform_data: number[];
    transcript?: string;
    transcript_status?: string;
    title?: string;
    body_text?: string;
  } | null;
  _originalSources?: string[];
  /** Flag to bypass gate - set when quiz was already passed in Feed Reader */
  _gatePassed?: boolean;
  quoted_post?: {
    id: string;
    content: string;
    title?: string;
    created_at: string;
    shared_url?: string | null;
    shared_title?: string | null;
    preview_img?: string | null;
    preview_img_width?: number | null;
    preview_img_height?: number | null;
    preview_img_ratio?: string | null;
    preview_img_orientation?: string | null;
    preview_img_ambient_url?: string | null;
    post_type?: string;
    voice_post?: {
      id?: string;
      audio_url: string;
      duration_seconds: number;
      waveform_data: number[];
      transcript?: string;
      transcript_status?: string;
      title?: string;
      body_text?: string;
    } | null;
    challenge?: {
      id: string;
      thesis: string;
      duration_hours: number;
      status: string;
      expires_at: string;
      votes_for: number;
      votes_against: number;
      title?: string;
      body_text?: string;
      voice_post?: {
        id: string;
        audio_url: string;
        duration_seconds: number;
        waveform_data: number[];
        transcript?: string;
        transcript_status?: string;
        title?: string;
        body_text?: string;
      } | null;
    } | null;
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
      ratio?: '9:16' | '3:4' | '1:1' | '16:9';
      orientation?: 'portrait' | 'landscape' | 'square';
      ambient_url?: string | null;
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
    ratio?: '9:16' | '3:4' | '1:1' | '16:9';
    orientation?: 'portrait' | 'landscape' | 'square';
    ambient_url?: string | null;
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
  challenge?: {
    id: string;
    thesis: string;
    duration_hours: number;
    status: string;
    expires_at: string;
    votes_for: number;
    votes_against: number;
    title?: string;
    body_text?: string;
    voice_post?: {
      audio_url: string;
      duration_seconds: number;
      waveform_data: number[];
      transcript?: string;
      transcript_status?: string;
      title?: string;
      body_text?: string;
    } | null;
  } | null;
}

export const usePosts = () => {
  const { user, loading, authReady } = useAuth();

  const query = useInfiniteQuery({
    queryKey: ['posts', user?.id],
    staleTime: 0, // Pre-carica sempre dati freschi per welcome screen
    enabled: authReady && !loading && !!user,
    initialPageParam: undefined as { created_at: string; id: string } | undefined,
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam as { created_at: string; id: string } | undefined;

      let baseQuery = (supabase
        .from('posts') as any)
        .select(`
          id,
          author_id,
          content,
          topic_tag,
          shared_title,
          shared_url,
          preview_img,
          trust_level,
          stance,
          sources,
          created_at,
          quoted_post_id,
          embed_html,
          category,
          shares_count,
          is_intent,
          verified_by,
          hostname,
          preview_fetched_at,
          post_type,
          is_removed,
          removed_reason,
          removed_at,
          removed_by,
          title,
          legacy_category,
          preview_img_width,
          preview_img_height,
          preview_img_ratio,
          preview_img_orientation,
          preview_img_ambient_url,
          author:public_profiles!author_id (
            id,
            username,
            full_name,
            avatar_url,
            is_ai_institutional
          ),
          post_type,
          voice_posts (
            id,
            audio_url,
            duration_seconds,
            waveform_data,
            transcript,
            transcript_status,
            title,
            body_text
          ),
          challenges!challenges_post_id_fkey (
            id,
            thesis,
            duration_hours,
            status,
            expires_at,
            votes_for,
            votes_against,
            title,
            body_text,
            voice_post_id,
            voice_posts!challenges_voice_post_id_fkey (
              id,
              audio_url,
              duration_seconds,
              waveform_data,
              transcript,
              transcript_status,
              title,
              body_text
            )
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
              ratio,
              orientation,
              ambient_url,
              extracted_status,
              extracted_text,
              extracted_kind
            )
          ),
          quoted_post:posts!quoted_post_id (
            id,
            content,
            title,
            created_at,
            shared_url,
            shared_title,
            preview_img,
            preview_img_width,
            preview_img_height,
            preview_img_ratio,
            preview_img_orientation,
            preview_img_ambient_url,
            post_type,
            voice_posts (
              id,
              audio_url,
              duration_seconds,
              waveform_data,
              transcript,
              transcript_status,
              title,
              body_text
            ),
            challenges!challenges_post_id_fkey (
              id,
              thesis,
              duration_hours,
              status,
              expires_at,
              votes_for,
              votes_against,
              title,
              body_text,
              voice_post_id,
              voice_posts!challenges_voice_post_id_fkey (
                id,
                audio_url,
                duration_seconds,
                waveform_data,
                transcript,
                transcript_status,
                title,
                body_text
              )
            ),
            is_intent,
            author:public_profiles!author_id (
              username,
              full_name,
              avatar_url,
              is_ai_institutional
            ),
            post_media!post_media_post_id_fkey (
              order_idx,
              media:media_id (
                id,
                type,
                url,
                ratio,
                orientation,
                ambient_url,
                extracted_status,
                extracted_text,
                extracted_kind
              )
            )
          )
        `) as any;

      baseQuery = baseQuery
        .eq('is_removed', false)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(30);

      if (cursor) {
        baseQuery = baseQuery.or(
          `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
        );
      }

      const { data, error } = await baseQuery;

      if (error) throw error;

      return (data || []).map((post: any) => ({
        id: post.id,
        author: post.author,
        content: post.content,
        title: post.title,
        body_text: post.body_text,
        topic_tag: post.topic_tag,
        shared_title: post.shared_title,
        shared_url: post.shared_url,
        preview_img: post.preview_img,
        preview_img_width: post.preview_img_width,
        preview_img_height: post.preview_img_height,
        preview_img_ratio: post.preview_img_ratio,
        preview_img_orientation: post.preview_img_orientation,
        preview_img_ambient_url: post.preview_img_ambient_url,
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
          title: post.quoted_post.title || undefined,
          voice_post: post.quoted_post.voice_posts?.[0] || null,
          challenge: post.quoted_post.challenges?.[0] ? {
            id: post.quoted_post.challenges[0].id,
            thesis: post.quoted_post.challenges[0].thesis,
            duration_hours: post.quoted_post.challenges[0].duration_hours,
            status: post.quoted_post.challenges[0].status,
            expires_at: post.quoted_post.challenges[0].expires_at,
            votes_for: post.quoted_post.challenges[0].votes_for || 0,
            votes_against: post.quoted_post.challenges[0].votes_against || 0,
            title: post.quoted_post.challenges[0].title,
            body_text: post.quoted_post.challenges[0].body_text,
            voice_post: post.quoted_post.challenges[0].voice_posts?.[0] || null,
          } : null,
          media: (post.quoted_post.post_media || [])
            .sort((a: any, b: any) => a.order_idx - b.order_idx)
            .map((pm: any) => pm.media)
            .filter(Boolean)
        } : null,
        shares_count: post.shares_count ?? 0,
        is_intent: post.is_intent ?? false,
        post_type: post.post_type || 'standard',
        voice_post: post.voice_posts?.[0] || null,
        challenge: post.challenges?.[0] ? {
          id: post.challenges[0].id,
          thesis: post.challenges[0].thesis,
          duration_hours: post.challenges[0].duration_hours,
          status: post.challenges[0].status,
          expires_at: post.challenges[0].expires_at,
          votes_for: post.challenges[0].votes_for || 0,
          votes_against: post.challenges[0].votes_against || 0,
          title: post.challenges[0].title,
          body_text: post.challenges[0].body_text,
          voice_post: post.challenges[0].voice_posts?.[0] || null,
        } : null,
        media: (post.post_media || [])
          .sort((a: any, b: any) => a.order_idx - b.order_idx)
          .map((pm: any) => pm.media)
          .filter(Boolean),
        reactions: {
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
    getNextPageParam: (lastPage) => {
      if (lastPage.length < 30) return undefined;
      const lastPost = lastPage[lastPage.length - 1];
      return { created_at: lastPost.created_at, id: lastPost.id };
    }
  });

  const posts = query.data?.pages.flat() || [];

  return {
    data: posts, // per retrocompatibilità
    posts,
    isLoading: query.isLoading,
    error: query.error,
    isError: query.isError, // destructured in Feed.tsx
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage
  };
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

        // Phase 4.4: cognitive density derivata dalla tabella reactions via vista materializzata.
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
      // Feed posts use useInfiniteQuery → shape is { pages: Post[][], pageParams }.
      const applyReactionToPost = (post: Post): Post => {
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

        const newByType = { ...post.reactions.byType };
        let newHeartsCount = post.reactions.hearts;

        if (isSameReaction) {
          newByType[reactionType] = Math.max(0, (newByType[reactionType] || 0) - 1);
          newHeartsCount = Math.max(0, newHeartsCount - 1);
          return {
            ...post,
            reactions: { ...post.reactions, hearts: newHeartsCount, byType: newByType },
            user_reactions: { ...post.user_reactions, has_hearted: false, myReactionType: null }
          };
        }

        if (currentReaction) {
          newByType[currentReaction] = Math.max(0, (newByType[currentReaction] || 0) - 1);
        } else {
          newHeartsCount += 1;
        }
        newByType[reactionType] = (newByType[reactionType] || 0) + 1;

        return {
          ...post,
          reactions: { ...post.reactions, hearts: newHeartsCount, byType: newByType },
          user_reactions: {
            ...post.user_reactions,
            has_hearted: true,
            myReactionType: reactionType as 'heart' | 'laugh' | 'wow' | 'sad' | 'fire'
          }
        };
      };

      queryClient.setQueryData(['posts', user.id], (old: any) => {
        if (!old) return old;
        if (old && Array.isArray(old.pages)) {
          return {
            ...old,
            pages: old.pages.map((page: any) =>
              Array.isArray(page) ? page.map(applyReactionToPost) : page
            ),
          };
        }
        return Array.isArray(old) ? old.map(applyReactionToPost) : old;
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
            id,
            author_id,
            content,
            topic_tag,
            shared_title,
            shared_url,
            preview_img,
            trust_level,
            stance,
            sources,
            created_at,
            quoted_post_id,
            embed_html,
            category,
            shares_count,
            is_intent,
            verified_by,
            hostname,
            preview_fetched_at,
            post_type,
            is_removed,
            removed_reason,
            removed_at,
            removed_by,
            title,
            legacy_category,
            preview_img_width,
            preview_img_height,
            preview_img_ratio,
            preview_img_orientation,
            preview_img_ambient_url,
            author:public_profiles!author_id (
              id,
              username,
              full_name,
              avatar_url,
              is_ai_institutional
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
                duration_sec,
                ratio,
                orientation,
                ambient_url
              )
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('reaction_type', 'bookmark')
        // @ts-ignore: is_removed will be in types after db migration
        .eq('posts.is_removed', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((item: any) => {
        const post = item.posts;
        return {
          id: post.id,
          author: post.author,
          title: post.title,
          body_text: post.body_text,
          content: post.content,
          shared_url: post.shared_url,
          shared_title: post.shared_title,
          preview_img: post.preview_img,
          preview_img_width: post.preview_img_width,
          preview_img_height: post.preview_img_height,
          preview_img_ratio: post.preview_img_ratio,
          preview_img_orientation: post.preview_img_orientation,
          preview_img_ambient_url: post.preview_img_ambient_url,
          full_article: post.full_article,
          article_content: post.article_content,
          trust_level: post.trust_level,
          topic_tag: post.topic_tag,
          stance: post.stance,
          sources: post.sources || [],
          created_at: post.created_at,
          quoted_post_id: post.quoted_post_id,
          category: post.category || null,
          post_type: post.post_type || 'standard',
          voice_post: post.voice_posts?.[0] || null,
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
          title,
          created_at,
          shared_url,
          shared_title,
          preview_img,
          preview_img_width,
          preview_img_height,
          preview_img_ratio,
          preview_img_orientation,
          preview_img_ambient_url,
          post_type,
          is_intent,
          sources,
          embed_html,
          hostname,
          author:public_profiles!author_id (
            username,
            full_name,
            avatar_url,
            is_ai_institutional
          ),
          post_media!post_media_post_id_fkey (
            order_idx,
            media:media_id (
              id,
              type,
              url,
              thumbnail_url,
              ratio,
              orientation,
              ambient_url
            )
          ),
          voice_posts (
            id,
            audio_url,
            duration_seconds,
            waveform_data,
            transcript,
            transcript_status,
            title,
            body_text
          ),
          challenges!challenges_post_id_fkey (
            id,
            thesis,
            duration_hours,
            status,
            expires_at,
            votes_for,
            votes_against,
            title,
            body_text,
            voice_post_id,
            voice_posts!challenges_voice_post_id_fkey (
              id,
              audio_url,
              duration_seconds,
              waveform_data,
              transcript,
              transcript_status,
              title,
              body_text
            )
          )
        `)
        .eq('id', quotedPostId)
        .single();

      if (error) {
        console.error('Error fetching quoted post:', error);
        return null;
      }

      const post = data as any;
      return {
        ...post,
        sources: Array.isArray(post.sources) ? post.sources : [],
        media: (post.post_media || [])
          .sort((a: any, b: any) => a.order_idx - b.order_idx)
          .map((pm: any) => pm.media)
          .filter(Boolean),
        voice_post: post.voice_posts?.[0] || null,
        challenge: post.challenges?.[0] ? {
          id: post.challenges[0].id,
          thesis: post.challenges[0].thesis,
          duration_hours: post.challenges[0].duration_hours,
          status: post.challenges[0].status,
          expires_at: post.challenges[0].expires_at,
          votes_for: post.challenges[0].votes_for || 0,
          votes_against: post.challenges[0].votes_against || 0,
          title: post.challenges[0].title,
          body_text: post.challenges[0].body_text,
          voice_post: post.challenges[0].voice_posts?.[0] || null,
        } : null,
      };
    },
    enabled: !!quotedPostId
  });
};

export const useEditPost = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ postId, title, content }: { postId: string; title?: string; content: string }) => {
      if (!user) throw new Error('Devi essere loggato');

      const { data, error } = await supabase
        .from('posts')
        .update({ title, content })
        .eq('id', postId)
        .eq('author_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('[useEditPost] update error:', error);
        throw error;
      }
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', variables.postId] });
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
    }
  });
};

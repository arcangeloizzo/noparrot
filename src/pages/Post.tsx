import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Post as PostType } from '@/hooks/usePosts';
import { useAuth } from '@/contexts/AuthContext';
import { ImmersivePostCard } from '@/components/feed/ImmersivePostCard';

export const Post = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch post with same structure as feed
  const { data: post, isLoading, error } = useQuery<PostType>({
    queryKey: ['post', postId],
    queryFn: async () => {
      if (!postId) throw new Error('Post ID is required');

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
          post_media (
            order_idx,
            media:media_id (
              id,
              url,
              type,
              width,
              height,
              thumbnail_url
            )
          )
        `)
        .eq('id', postId)
        .single();

      if (error) throw error;

      const mediaItems = (data.post_media || [])
        .sort((a: any, b: any) => a.order_idx - b.order_idx)
        .map((pm: any) => pm.media)
        .filter(Boolean);

      return {
        id: data.id,
        author: data.author,
        content: data.content,
        topic_tag: data.topic_tag,
        shared_title: data.shared_title,
        shared_url: data.shared_url,
        preview_img: data.preview_img,
        full_article: data.full_article,
        article_content: data.article_content,
        trust_level: data.trust_level as 'BASSO' | 'MEDIO' | 'ALTO' | null,
        stance: data.stance as 'Condiviso' | 'Confutato' | null,
        sources: (Array.isArray(data.sources) ? data.sources : []) as string[],
        created_at: data.created_at,
        quoted_post_id: data.quoted_post_id,
        category: data.category || null,
        quoted_post: null,
        media: mediaItems,
        reactions: {
          hearts: data.reactions?.filter((r: any) => r.reaction_type === 'heart').length || 0,
          comments: data.comments?.[0]?.count || 0
        },
        user_reactions: {
          has_hearted: data.reactions?.some((r: any) => r.reaction_type === 'heart' && r.user_id === user?.id) || false,
          has_bookmarked: data.reactions?.some((r: any) => r.reaction_type === 'bookmark' && r.user_id === user?.id) || false
        },
        questions: (data.questions || [])
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((q: any) => ({
            id: q.id,
            question_text: q.question_text,
            options: q.options as string[],
            correct_index: q.correct_index
          }))
      };
    },
    enabled: !!postId,
  });

  const handleBack = () => {
    if (window.history.length <= 2) {
      navigate('/', { replace: true });
    } else {
      navigate(-1);
    }
  };

  if (isLoading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-[#1F3347]">
        <div className="text-white/60 text-lg">Caricamento...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="h-[100dvh] w-full flex flex-col bg-[#1F3347]">
        <div className="fixed top-4 left-4 z-50 safe-area-inset-top">
          <button
            onClick={handleBack}
            className="p-2.5 bg-black/40 backdrop-blur-md rounded-full"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-white/60">
            <p className="text-xl mb-2">Post non trovato</p>
            <p className="text-sm">Il post potrebbe essere stato rimosso</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full relative overflow-hidden">
      {/* Back Button Overlay - Fixed on top of everything */}
      <div className="fixed top-4 left-4 z-[100] safe-area-inset-top">
        <button
          onClick={handleBack}
          className="p-2.5 bg-black/40 backdrop-blur-md rounded-full shadow-lg"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
      </div>
      
      {/* Same component used in the feed - wrapped without snap scrolling */}
      <div className="h-full w-full [&>div]:!snap-start-none [&>div]:snap-align-none">
        <ImmersivePostCard 
          post={post}
          onQuoteShare={(quotedPost) => {
            navigate('/', { state: { quotePost: quotedPost } });
          }}
        />
      </div>
    </div>
  );
};

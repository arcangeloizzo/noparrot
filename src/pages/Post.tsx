import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Post as PostType } from '@/hooks/usePosts';
import { useComments, useAddComment, useDeleteComment } from '@/hooks/useComments';
import { useToggleCommentReaction } from '@/hooks/useCommentReactions';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { CollapsiblePostHeader } from '@/components/feed/CollapsiblePostHeader';
import { CommentMetricsBar } from '@/components/feed/CommentMetricsBar';
import { CommentList } from '@/components/feed/CommentList';
import { StickyComposer } from '@/components/feed/StickyComposer';
import { PostExpandedOverlay } from '@/components/feed/PostExpandedOverlay';
import { Comment } from '@/hooks/useComments';
import { toast } from 'sonner';

export const Post = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const focusCommentId = searchParams.get('focus');
  const [sortMode, setSortMode] = useState<'relevance' | 'recent' | 'top'>('relevance');
  const [replyToComment, setReplyToComment] = useState<Comment | null>(null);
  const [showPostOverlay, setShowPostOverlay] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [newCommentsCount, setNewCommentsCount] = useState(0);
  
  const previousCountRef = useRef(0);

  // Fetch post
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
          comments(count)
        `)
        .eq('id', postId)
        .single();

      if (error) throw error;

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
        quoted_post: null,
        media: [],
        reactions: {
          hearts: data.reactions?.filter((r: any) => r.reaction_type === 'heart').length || 0,
          comments: data.comments?.[0]?.count || 0
        },
        user_reactions: {
          has_hearted: data.reactions?.some((r: any) => r.reaction_type === 'heart') || false,
          has_bookmarked: data.reactions?.some((r: any) => r.reaction_type === 'bookmark') || false
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

  // Fetch comments with sorting
  const { data: comments = [] } = useComments(postId || '', sortMode);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const toggleReaction = useToggleCommentReaction();

  // Scroll detection for collapsible header
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll position restore
  const scrollPositionKey = `post-${postId}-scroll`;
  
  useEffect(() => {
    const saved = sessionStorage.getItem(scrollPositionKey);
    if (saved) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(saved));
        sessionStorage.removeItem(scrollPositionKey);
      }, 100);
    }

    return () => {
      sessionStorage.setItem(scrollPositionKey, window.scrollY.toString());
    };
  }, [postId, scrollPositionKey]);

  // New comments notification
  useEffect(() => {
    if (!comments) return;

    const newCount = comments.length;
    const hadNew = newCount > previousCountRef.current;

    if (hadNew && window.scrollY > 300 && previousCountRef.current > 0) {
      const diff = newCount - previousCountRef.current;
      setNewCommentsCount(diff);
      toast.info(`${diff} nuov${diff === 1 ? 'o commento' : 'i commenti'}`, {
        action: {
          label: 'Vedi',
          onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      });
    }

    previousCountRef.current = newCount;
  }, [comments?.length]);

  const handleSubmitComment = async (content: string) => {
    if (!postId || !user) return;

    await addComment.mutateAsync({
      postId,
      content,
      parentId: replyToComment?.id || null,
      level: replyToComment ? replyToComment.level + 1 : 0
    });
  };

  const handleLike = (commentId: string, isLiked: boolean) => {
    toggleReaction.mutate({
      commentId,
      isLiked
    });
  };

  const handleDelete = (commentId: string) => {
    deleteComment.mutate(commentId);
  };

  const isCollapsed = scrollY > 24;
  const focusComment = focusCommentId ? comments.find(c => c.id === focusCommentId) : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mobile-container">
          <div className="p-4 border-b border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Indietro
            </Button>
          </div>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-3">
              <h2 className="text-lg font-semibold">Post non trovato</h2>
              <p className="text-muted-foreground text-sm">
                Il post che stai cercando non esiste o è stato rimosso
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Back button header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-40 border-b border-border/50">
        <div className="px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Indietro
          </Button>
        </div>
      </div>

      {/* Collapsible Post Header */}
      <CollapsiblePostHeader
        post={post}
        isCollapsed={isCollapsed}
        onExpand={() => setShowPostOverlay(true)}
        focusComment={focusComment}
        onBackToPost={focusComment ? () => {
          setSearchParams({});
        } : undefined}
      />

      {/* Metrics & Filters */}
      <CommentMetricsBar
        commentsCount={comments.length}
        likesCount={post.reactions.hearts}
        activeFilter={sortMode}
        onFilterChange={setSortMode}
      />

      {/* Comments List */}
      <CommentList
        comments={comments}
        currentUserId={user?.id}
        onReply={setReplyToComment}
        onLike={handleLike}
        onDelete={handleDelete}
        focusCommentId={focusCommentId}
        sortMode={sortMode}
      />

      {/* Sticky Composer */}
      <StickyComposer
        postId={postId || ''}
        replyToComment={replyToComment}
        onClearReplyTo={() => setReplyToComment(null)}
        onSubmit={handleSubmitComment}
      />

      {/* Post Expanded Overlay */}
      {showPostOverlay && (
        <PostExpandedOverlay
          post={post}
          onClose={() => setShowPostOverlay(false)}
        />
      )}
    </div>
  );
};

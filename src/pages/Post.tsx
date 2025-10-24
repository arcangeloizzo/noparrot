import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn, getDisplayUsername } from '@/lib/utils';
import { Post as PostType } from '@/hooks/usePosts';
import { useComments, useAddComment, useDeleteComment } from '@/hooks/useComments';
import { useToggleCommentReaction } from '@/hooks/useCommentReactions';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { CommentMetricsBar } from '@/components/feed/CommentMetricsBar';
import { CommentList } from '@/components/feed/CommentList';
import { StickyComposer } from '@/components/feed/StickyComposer';
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
    <div className="min-h-screen bg-background pb-32">
      {/* Header dinamico: back button quando expanded, collapsible quando scrolled */}
      <div className={cn(
        "sticky top-0 bg-background/95 backdrop-blur-sm z-40 border-b border-border/50 transition-all duration-200",
        isCollapsed ? "" : ""
      )}>
        {!isCollapsed ? (
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-muted rounded-full transition-colors -ml-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="font-bold text-lg">Post</div>
            </div>
          </div>
        ) : (
          <div 
            className="px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(-1);
              }}
              className="p-1.5 hover:bg-muted rounded-full transition-colors -ml-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-shrink-0">
              {post.author.avatar_url ? (
                <img
                  src={post.author.avatar_url}
                  alt={post.author.full_name || post.author.username}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
                  {(post.author.full_name || post.author.username).slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">
                {post.author.full_name || getDisplayUsername(post.author.username)}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {post.content}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Post completo (quando non collapsed) */}
      {!isCollapsed && (
        <div className="border-b border-border">
          <div className="px-4 py-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                {post.author.avatar_url ? (
                  <img
                    src={post.author.avatar_url}
                    alt={post.author.full_name || post.author.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                    {(post.author.full_name || post.author.username).slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-base">
                    {post.author.full_name || getDisplayUsername(post.author.username)}
                  </span>
                </div>
                <div className="text-muted-foreground text-sm mb-3">
                  @{getDisplayUsername(post.author.username)}
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="text-base leading-relaxed mb-3 whitespace-pre-wrap">
              {post.content}
            </div>

            {/* Timestamp */}
            <div className="text-muted-foreground text-sm border-b border-border pb-3 mb-3">
              {new Date(post.created_at).toLocaleString('it-IT', {
                hour: '2-digit',
                minute: '2-digit',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-4 text-sm border-b border-border pb-3 mb-3">
              <div>
                <span className="font-bold">{post.reactions.hearts}</span>
                <span className="text-muted-foreground ml-1">Mi piace</span>
              </div>
              <div>
                <span className="font-bold">{comments.length}</span>
                <span className="text-muted-foreground ml-1">Comment{comments.length !== 1 ? 'i' : 'o'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
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
    </div>
  );
};

import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getDisplayUsername } from '@/lib/utils';
import { Post as PostType } from '@/hooks/usePosts';
import { useComments, useAddComment, useDeleteComment } from '@/hooks/useComments';
import { useToggleCommentReaction } from '@/hooks/useCommentReactions';
import { useAuth } from '@/contexts/AuthContext';
import { CommentList } from '@/components/feed/CommentList';
import { StickyComposer } from '@/components/feed/StickyComposer';
import { Comment } from '@/hooks/useComments';

export const Post = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const focusCommentId = searchParams.get('focus');
  const [sortMode, setSortMode] = useState<'relevance' | 'recent' | 'top'>('relevance');
  const [replyToComment, setReplyToComment] = useState<Comment | null>(null);

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
        category: data.category || null,
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

  const postHasSource = !!post?.shared_url;
  console.log('[Post.tsx] Debug info:', {
    postId: post?.id,
    hasSharedUrl: !!post?.shared_url,
    sharedUrl: post?.shared_url,
    postHasSource
  });

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
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-40 border-b border-border/50">
          <div className="flex items-center gap-4 px-4 h-14">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-muted rounded-full transition-colors -ml-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Post</h1>
        </div>
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
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header fisso - stile X */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-40 border-b border-border/50">
        <div className="flex items-center gap-4 px-4 h-14">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-muted rounded-full transition-colors -ml-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Post</h1>
        </div>
      </div>

      {/* Post completo */}
      <div className="border-b border-border">
        <div className="px-4 py-3">
          {/* Author info */}
          <div className="flex gap-3 mb-3">
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
            <div>
              <div className="font-bold text-base">
                {post.author.full_name || getDisplayUsername(post.author.username)}
              </div>
              <div className="text-muted-foreground text-sm">
                @{getDisplayUsername(post.author.username)}
              </div>
            </div>
          </div>
          
          {/* Content */}
          {post.content && (
            <div className="text-[15px] leading-relaxed mb-4 whitespace-pre-wrap">
              {post.content}
            </div>
          )}

          {/* Shared Article Preview */}
          {post.shared_url && post.shared_title && (
            <div className="mb-4 border border-border rounded-xl overflow-hidden hover:bg-muted/30 transition-colors">
              {post.preview_img && (
                <img
                  src={post.preview_img}
                  alt={post.shared_title}
                  className="w-full aspect-video object-cover"
                />
              )}
              <div className="p-3">
                <div className="text-sm font-medium line-clamp-2 mb-1">
                  {post.shared_title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new URL(post.shared_url).hostname}
                </div>
              </div>
            </div>
          )}

          {/* Media */}
          {post.media && post.media.length > 0 && (
            <div className={`mb-4 rounded-xl overflow-hidden ${
              post.media.length === 1 ? 'max-h-[500px]' : 'grid grid-cols-2 gap-1'
            }`}>
              {post.media.map((media, idx) => (
                <img
                  key={idx}
                  src={media.url}
                  alt={`Media ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              ))}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-muted-foreground text-[15px] pb-4 border-b border-border">
            {new Date(post.created_at).toLocaleString('it-IT', {
              hour: '2-digit',
              minute: '2-digit',
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </div>

          {/* Metrics */}
          <div className="flex items-center gap-5 py-4 border-b border-border">
            <button className="hover:underline">
              <span className="font-bold text-sm">{comments.length}</span>
              <span className="text-muted-foreground text-sm ml-1">
                Comment{comments.length !== 1 ? 'i' : 'o'}
              </span>
            </button>
            <button className="hover:underline">
              <span className="font-bold text-sm">{post.reactions.hearts}</span>
              <span className="text-muted-foreground text-sm ml-1">Mi piace</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-border">
        <div className="flex">
          <button
            onClick={() => setSortMode('relevance')}
            className={`flex-1 py-4 text-[15px] font-semibold transition-colors relative ${
              sortMode === 'relevance'
                ? 'text-foreground'
                : 'text-muted-foreground hover:bg-muted/30'
            }`}
          >
            Rilevanti
            {sortMode === 'relevance' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => setSortMode('recent')}
            className={`flex-1 py-4 text-[15px] font-semibold transition-colors relative ${
              sortMode === 'recent'
                ? 'text-foreground'
                : 'text-muted-foreground hover:bg-muted/30'
            }`}
          >
            Recenti
            {sortMode === 'recent' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => setSortMode('top')}
            className={`flex-1 py-4 text-[15px] font-semibold transition-colors relative ${
              sortMode === 'top'
                ? 'text-foreground'
                : 'text-muted-foreground hover:bg-muted/30'
            }`}
          >
            Top
            {sortMode === 'top' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Comments List */}
      <CommentList
        comments={comments}
        currentUserId={user?.id}
        onReply={setReplyToComment}
        onLike={handleLike}
        onDelete={handleDelete}
        focusCommentId={focusCommentId}
        sortMode={sortMode}
        postHasSource={postHasSource}
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

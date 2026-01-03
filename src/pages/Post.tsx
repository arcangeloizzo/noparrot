import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Heart, MessageCircle, Bookmark, ExternalLink, Play, Maximize2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Post as PostType } from '@/hooks/usePosts';
import { useComments, useAddComment, useDeleteComment } from '@/hooks/useComments';
import { useToggleCommentReaction } from '@/hooks/useCommentReactions';
import { useAuth } from '@/contexts/AuthContext';
import { CommentList } from '@/components/feed/CommentList';
import { StickyComposer } from '@/components/feed/StickyComposer';
import { Comment } from '@/hooks/useComments';
import { TrustBadge } from '@/components/ui/trust-badge';
import { usePalette } from 'react-palette';

export const Post = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const focusCommentId = searchParams.get('focus');
  const [sortMode, setSortMode] = useState<'relevance' | 'recent' | 'top'>('relevance');
  const [replyToComment, setReplyToComment] = useState<Comment | null>(null);
  const [showComments, setShowComments] = useState(false);

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

  // Get dominant colors from media or preview
  const imageForPalette = post?.media?.[0]?.url || post?.preview_img || '';
  const { data: palette } = usePalette(imageForPalette);

  // Fetch comments
  const { data: comments = [] } = useComments(postId || '', sortMode);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const toggleReaction = useToggleCommentReaction();

  const handleBack = () => {
    if (window.history.length <= 2) {
      navigate('/', { replace: true });
    } else {
      navigate(-1);
    }
  };

  const handleSubmitComment = async (content: string) => {
    if (!postId || !user) return;

    await addComment.mutateAsync({
      postId,
      content,
      parentId: replyToComment?.id || null,
      level: replyToComment ? replyToComment.level + 1 : 0
    });
    setReplyToComment(null);
  };

  const handleLike = (commentId: string, isLiked: boolean) => {
    toggleReaction.mutate({ commentId, isLiked });
  };

  const handleDelete = (commentId: string) => {
    deleteComment.mutate(commentId);
  };

  // Determine background style
  const hasMedia = post?.media && post.media.length > 0;
  const hasLink = post?.shared_url && post?.preview_img;
  const hasVisualContent = hasMedia || hasLink;

  const getBackgroundStyle = () => {
    if (hasVisualContent && palette?.darkMuted) {
      return {
        background: `linear-gradient(135deg, ${palette.darkMuted} 0%, ${palette.darkVibrant || '#0E141A'} 50%, #0E141A 100%)`
      };
    }
    return {
      background: 'linear-gradient(135deg, #1F3347 0%, #162636 50%, #0E141A 100%)'
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={getBackgroundStyle()}>
        <div className="text-white/60 text-lg">Caricamento...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-[100dvh] flex flex-col" style={getBackgroundStyle()}>
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 p-4">
          <button
            onClick={handleBack}
            className="p-2 bg-black/30 backdrop-blur-sm rounded-full"
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

  // Show comments view
  if (showComments) {
    return (
      <div className="min-h-[100dvh] bg-background pb-32">
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-40 border-b border-border/50">
          <div className="flex items-center gap-4 px-4 h-14">
            <button
              onClick={() => setShowComments(false)}
              className="p-2 hover:bg-muted rounded-full transition-colors -ml-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">Commenti</h1>
          </div>
        </div>

        {/* Filters */}
        <div className="border-b border-border">
          <div className="flex">
            {(['relevance', 'recent', 'top'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={`flex-1 py-4 text-[15px] font-semibold transition-colors relative ${
                  sortMode === mode
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:bg-muted/30'
                }`}
              >
                {mode === 'relevance' ? 'Rilevanti' : mode === 'recent' ? 'Recenti' : 'Top'}
                {sortMode === mode && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        <CommentList
          comments={comments}
          currentUserId={user?.id}
          onReply={setReplyToComment}
          onLike={handleLike}
          onDelete={handleDelete}
          focusCommentId={focusCommentId}
          sortMode={sortMode}
          postHasSource={!!post?.shared_url}
        />

        <StickyComposer
          postId={postId || ''}
          replyToComment={replyToComment}
          onClearReplyTo={() => setReplyToComment(null)}
          onSubmit={handleSubmitComment}
        />
      </div>
    );
  }

  // Main immersive post view
  return (
    <div className="min-h-[100dvh] flex flex-col relative" style={getBackgroundStyle()}>
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      {/* Back button - fixed */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 safe-area-inset-top">
        <button
          onClick={handleBack}
          className="p-2.5 bg-black/40 backdrop-blur-md rounded-full"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        
        {post.trust_level && (
          <TrustBadge band={post.trust_level} size="sm" />
        )}
      </div>

      {/* Content - vertically centered */}
      <div className="flex-1 flex flex-col justify-center px-5 pt-20 pb-32 relative z-10">
        {/* Author */}
        <div className="flex items-center gap-3 mb-6">
          {post.author.avatar_url ? (
            <img
              src={post.author.avatar_url}
              alt={post.author.full_name || post.author.username}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-white/20"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-lg">
              {(post.author.full_name || post.author.username).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-bold text-white text-lg">
              {post.author.full_name || post.author.username}
            </div>
            <div className="text-white/60 text-sm">
              @{post.author.username}
            </div>
          </div>
        </div>

        {/* Text content */}
        {post.content && (
          <p className="text-white text-xl leading-relaxed mb-6 font-medium">
            {post.content}
          </p>
        )}

        {/* Link preview */}
        {post.shared_url && post.shared_title && (
          <a
            href={post.shared_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-6 rounded-2xl overflow-hidden bg-black/30 backdrop-blur-sm border border-white/10"
          >
            {post.preview_img && (
              <div className="relative aspect-video">
                <img
                  src={post.preview_img}
                  alt={post.shared_title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute top-3 right-3 p-2 bg-black/40 backdrop-blur-sm rounded-full">
                  <ExternalLink className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
            <div className="p-4">
              <p className="text-white font-medium line-clamp-2 mb-1">
                {post.shared_title}
              </p>
              <p className="text-white/50 text-sm">
                {new URL(post.shared_url).hostname}
              </p>
            </div>
          </a>
        )}

        {/* Media */}
        {hasMedia && (
          <div className="mb-6 rounded-2xl overflow-hidden relative">
            {post.media![0].type === 'video' ? (
              <div className="relative aspect-video bg-black">
                <video
                  src={post.media![0].url}
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                />
              </div>
            ) : (
              <div className="relative">
                <img
                  src={post.media![0].url}
                  alt="Post media"
                  className="w-full max-h-[60vh] object-cover"
                />
                <div className="absolute top-3 right-3 p-2 bg-black/40 backdrop-blur-sm rounded-full">
                  <Maximize2 className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <p className="text-white/40 text-sm">
          {new Date(post.created_at).toLocaleString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })}
        </p>
      </div>

      {/* Bottom actions - fixed */}
      <div className="fixed bottom-0 left-0 right-0 z-40 safe-area-inset-bottom">
        <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8 pb-6 px-5">
          <div className="flex items-center justify-around max-w-md mx-auto">
            <button className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
              <Heart className={`w-6 h-6 ${post.user_reactions?.has_hearted ? 'fill-red-500 text-red-500' : ''}`} />
              <span className="text-sm font-medium">{post.reactions.hearts}</span>
            </button>
            
            <button 
              onClick={() => setShowComments(true)}
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            >
              <MessageCircle className="w-6 h-6" />
              <span className="text-sm font-medium">{post.reactions.comments}</span>
            </button>
            
            <button className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
              <Bookmark className={`w-6 h-6 ${post.user_reactions?.has_bookmarked ? 'fill-white' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
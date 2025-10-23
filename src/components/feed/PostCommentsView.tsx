import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Heart, MessageCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useComments, useDeleteComment } from '@/hooks/useComments';
import { useCommentReactions, useToggleCommentReaction } from '@/hooks/useCommentReactions';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Post } from '@/hooks/usePosts';
import { TrustBadge } from '@/components/ui/trust-badge';
import { MentionText } from './MentionText';
import { cn, getDisplayUsername } from '@/lib/utils';
import { MediaGallery } from '@/components/media/MediaGallery';
import { CommentReplySheet } from './CommentReplySheet';

interface PostCommentsViewProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
}

export const PostCommentsView = ({ post, isOpen, onClose }: PostCommentsViewProps) => {
  const { user } = useAuth();
  const { data: comments = [], isLoading } = useComments(post.id);
  const deleteComment = useDeleteComment();
  const [replyingToComment, setReplyingToComment] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserAvatar = (avatarUrl: string | null | undefined, name: string | undefined, username?: string) => {
    const displayName = name || username || 'U';
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-10 h-10 rounded-full object-cover"
        />
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
        {getInitials(displayName)}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between z-20">
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold">Post</span>
          <div className="w-10" />
        </div>

        {/* Contenuto scrollabile */}
        <div className="flex-1 overflow-y-auto">
          {/* Post originale */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                {getUserAvatar(post.author.avatar_url, post.author.full_name || post.author.username)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{post.author.full_name || getDisplayUsername(post.author.username)}</span>
                  <span className="text-muted-foreground text-xs">@{getDisplayUsername(post.author.username)}</span>
                </div>
                <div className="text-sm mb-3">
                  <MentionText content={post.content} />
                </div>
                
                {post.preview_img && (
                  <img
                    src={post.preview_img}
                    alt=""
                    className="rounded-2xl w-full mb-3"
                  />
                )}
                
                {post.trust_level && (
                  <div className="mb-3">
                    <TrustBadge 
                      band={post.trust_level}
                      score={post.trust_level === 'ALTO' ? 85 : post.trust_level === 'MEDIO' ? 60 : 35}
                      size="sm"
                    />
                  </div>
                )}
                
                <div className="text-muted-foreground text-xs">
                  {formatDistanceToNow(new Date(post.created_at), {
                    addSuffix: true,
                    locale: it
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Lista commenti */}
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Caricamento commenti...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 px-4">
              <p className="text-sm">Nessun commento ancora.</p>
              <p className="text-xs mt-1">Sii il primo a rispondere!</p>
            </div>
          ) : (
            <div>
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={user?.id}
                  onReply={() => setReplyingToComment(comment)}
                  onDelete={() => deleteComment.mutate(comment.id)}
                  getUserAvatar={getUserAvatar}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {replyingToComment && (
        <CommentReplySheet
          post={post}
          parentComment={replyingToComment}
          isOpen={true}
          onClose={() => setReplyingToComment(null)}
        />
      )}
    </>
  );
};

interface CommentItemProps {
  comment: any;
  currentUserId?: string;
  onReply: () => void;
  onDelete: () => void;
  getUserAvatar: (avatarUrl: string | null | undefined, name: string | undefined, username?: string) => JSX.Element;
}

const CommentItem = ({ comment, currentUserId, onReply, onDelete, getUserAvatar }: CommentItemProps) => {
  const { data: reactions } = useCommentReactions(comment.id);
  const toggleReaction = useToggleCommentReaction();

  const handleLike = () => {
    toggleReaction.mutate({
      commentId: comment.id,
      isLiked: reactions?.likedByMe || false
    });
  };

  const indentLevel = comment.level || 0;
  const indentAmount = indentLevel > 0 ? indentLevel * 32 : 0;

  return (
    <div 
      className="py-3 border-b border-border hover:bg-muted/30 transition-colors relative"
      style={{ 
        paddingLeft: `${16 + indentAmount}px`,
        paddingRight: '16px'
      }}
    >
      {/* Linea verticale di indentazione */}
      {indentLevel > 0 && (
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground/20"
          style={{ left: `${(indentLevel - 1) * 32 + 16}px` }}
        />
      )}
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {getUserAvatar(comment.author.avatar_url, comment.author.full_name, comment.author.username)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">
              {comment.author.full_name || getDisplayUsername(comment.author.username)}
            </span>
            <span className="text-muted-foreground text-xs">
              @{getDisplayUsername(comment.author.username)}
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-muted-foreground text-xs">
              {formatDistanceToNow(new Date(comment.created_at), {
                addSuffix: true,
                locale: it
              })}
            </span>
          </div>
          
          <div className="text-sm mb-2">
            <MentionText content={comment.content} />
          </div>
          
          {comment.media && comment.media.length > 0 && (
            <div className="mb-2">
              <MediaGallery 
                media={comment.media}
              />
            </div>
          )}
          
          <div className="flex items-center gap-4 text-muted-foreground">
            <button
              onClick={handleLike}
              className={cn(
                "flex items-center gap-1 hover:text-destructive transition-colors",
                reactions?.likedByMe && "text-destructive"
              )}
            >
              <Heart className={cn("w-4 h-4", reactions?.likedByMe && "fill-current")} />
              {reactions?.likesCount && reactions.likesCount > 0 && (
                <span className="text-xs">{reactions.likesCount}</span>
              )}
            </button>
            
            <button
              onClick={onReply}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            
            {currentUserId === comment.author.id && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1 hover:text-destructive transition-colors ml-auto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

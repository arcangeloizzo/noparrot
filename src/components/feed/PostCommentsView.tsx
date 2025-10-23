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
import { Comment } from '@/hooks/useComments';

interface PostCommentsViewProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
}

export const PostCommentsView = ({ post, isOpen, onClose }: PostCommentsViewProps) => {
  const { user } = useAuth();
  const { data: allComments = [], isLoading } = useComments(post.id);
  const deleteComment = useDeleteComment();
  const [replyingToComment, setReplyingToComment] = useState<any>(null);

  // Build nested comment tree
  const buildCommentTree = (comments: Comment[]): (Comment & { replies?: Comment[] })[] => {
    const topLevel = comments.filter(c => !c.parent_id);
    const repliesMap = new Map<string, Comment[]>();
    
    // Group replies by parent_id
    comments.filter(c => c.parent_id).forEach(comment => {
      const parentId = comment.parent_id!;
      if (!repliesMap.has(parentId)) {
        repliesMap.set(parentId, []);
      }
      repliesMap.get(parentId)!.push(comment);
    });
    
    // Sort replies by created_at for each parent
    repliesMap.forEach((replies) => {
      replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    
    // Recursively add replies
    const addReplies = (comment: Comment): Comment & { replies?: Comment[] } => {
      const children = repliesMap.get(comment.id) || [];
      if (children.length === 0) {
        return comment;
      }
      return {
        ...comment,
        replies: children.map(addReplies).sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      };
    };
    
    // Sort top-level by created_at
    return topLevel
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(addReplies);
  };

  const comments = buildCommentTree(allComments);

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
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">
                    {post.author.full_name || getDisplayUsername(post.author.username)}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    @{getDisplayUsername(post.author.username)}
                  </span>
                </div>
                <div className="text-sm mb-2">
                  <MentionText content={post.content} />
                </div>
                {post.media && post.media.length > 0 && (
                  <MediaGallery media={post.media} />
                )}
              </div>
            </div>
          </div>

          {/* Commenti */}
          <div className="border-b-8 border-muted">
            <div className="px-4 py-3 bg-muted/30">
              <h3 className="font-semibold text-sm">
                Commenti
              </h3>
            </div>

          {!comments || comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Nessun commento ancora.</p>
              <p className="text-xs mt-1">Sii il primo a rispondere!</p>
            </div>
          ) : (
            <div>
              {comments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  currentUserId={user?.id}
                  onReply={(comment) => {
                    // Reset prima per forzare un re-render pulito
                    setReplyingToComment(null);
                    // Usa setTimeout per garantire che il reset sia completato
                    setTimeout(() => {
                      setReplyingToComment(comment);
                    }, 0);
                  }}
                  onDelete={(id) => deleteComment.mutate(id)}
                  getUserAvatar={getUserAvatar}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {replyingToComment && (
        <CommentReplySheet
          key={replyingToComment.id}
          post={post}
          parentComment={replyingToComment}
          isOpen={true}
          onClose={() => setReplyingToComment(null)}
        />
      )}
    </div>
    </>
  );
};

// CommentThread renders a comment and all its nested replies
interface CommentThreadProps {
  comment: Comment & { replies?: (Comment & { replies?: Comment[] })[] };
  currentUserId?: string;
  onReply: (comment: Comment) => void;
  onDelete: (id: string) => void;
  getUserAvatar: (avatarUrl: string | null, fullName: string | null, username: string) => React.ReactNode;
  depth?: number;
}

const CommentThread = ({ comment, currentUserId, onReply, onDelete, getUserAvatar, depth = 0 }: CommentThreadProps) => {
  return (
    <>
      <CommentItem
        comment={comment}
        currentUserId={currentUserId}
        onReply={() => {
          console.log('[PostCommentsView] Setting replyingToComment:', {
            id: comment.id,
            content: comment.content?.substring(0, 30),
            level: comment.level,
            parent_id: comment.parent_id
          });
          onReply(comment);
        }}
        onDelete={() => onDelete(comment.id)}
        getUserAvatar={getUserAvatar}
        depth={depth}
      />
      {comment.replies && comment.replies.length > 0 && (
        <>
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onDelete={onDelete}
              getUserAvatar={getUserAvatar}
              depth={depth + 1}
            />
          ))}
        </>
      )}
    </>
  );
};

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onReply: () => void;
  onDelete: () => void;
  getUserAvatar: (avatarUrl: string | null, fullName: string | null, username: string) => React.ReactNode;
  depth: number;
}

const CommentItem = ({ comment, currentUserId, onReply, onDelete, getUserAvatar, depth }: CommentItemProps) => {
  const { data: reactions } = useCommentReactions(comment.id);
  const toggleReaction = useToggleCommentReaction();

  const handleLike = () => {
    toggleReaction.mutate({
      commentId: comment.id,
      isLiked: reactions?.likedByMe || false
    });
  };

  const indentAmount = depth > 0 ? depth * 40 : 0;

  return (
    <div 
      className="py-3 border-b border-border hover:bg-muted/30 transition-colors relative"
      style={{ 
        paddingLeft: `${16 + indentAmount}px`,
        paddingRight: '16px'
      }}
    >
      {/* Linea verticale di indentazione */}
      {depth > 0 && (
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-border"
          style={{ 
            left: `${16 + (depth - 1) * 40 + 20}px`,
            zIndex: 1
          }}
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
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <button
              onClick={handleLike}
              className={cn(
                "flex items-center gap-1.5 py-1.5 px-2 -ml-2 rounded hover:bg-muted hover:text-destructive transition-colors",
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
              className="flex items-center gap-1.5 py-1.5 px-2 rounded hover:bg-muted hover:text-foreground transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs">Rispondi</span>
            </button>
            
            {currentUserId === comment.author.id && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 py-1.5 px-2 rounded hover:bg-muted hover:text-destructive transition-colors ml-auto"
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

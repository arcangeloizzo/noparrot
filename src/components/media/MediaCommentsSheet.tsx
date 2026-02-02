import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Trash2, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMediaComments, useAddMediaComment, useDeleteMediaComment } from '@/hooks/useMediaComments';
import { useCommentReactions, useToggleCommentReaction } from '@/hooks/useCommentReactions';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn, getDisplayUsername } from '@/lib/utils';
import { useLongPress } from '@/hooks/useLongPress';
import { ReactionPicker, type ReactionType, reactionToEmoji } from '@/components/ui/reaction-picker';
import { ReactionSummary, getReactionCounts } from '@/components/feed/ReactionSummary';
import { haptics } from '@/lib/haptics';

interface Media {
  id: string;
  type: 'image' | 'video';
  url: string;
}

interface MediaCommentsSheetProps {
  media: Media;
  isOpen: boolean;
  onClose: () => void;
}

export const MediaCommentsSheet = ({ media, isOpen, onClose }: MediaCommentsSheetProps) => {
  const { user } = useAuth();
  const { data: comments = [], isLoading } = useMediaComments(media.id);
  const addComment = useAddMediaComment();
  const deleteComment = useDeleteMediaComment();
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    if (!newComment.trim() || addComment.isPending) return;

    const parentComment = replyingTo ? comments.find(c => c.id === replyingTo) : null;
    
    await addComment.mutateAsync({
      mediaId: media.id,
      content: newComment.trim(),
      parentId: replyingTo,
      level: parentComment ? parentComment.level + 1 : 0
    });

    setNewComment('');
    setReplyingTo(null);
  };

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
    <div className="fixed inset-0 bg-background z-[60] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between z-20">
        <button
          onClick={onClose}
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold">Commenti</span>
        <div className="w-10" />
      </div>

      {/* Comments Area */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Caricamento commenti...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 px-4">
              <p className="text-sm">Nessun commento ancora.</p>
              <p className="text-xs mt-1">Sii il primo a commentare!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={user?.id}
                onReply={() => {
                  setReplyingTo(comment.id);
                  textareaRef.current?.focus();
                }}
                onDelete={() => deleteComment.mutate(comment.id)}
                getUserAvatar={getUserAvatar}
              />
            ))
          )}
        </div>
      </div>

      {/* Reply Form */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-30">
        {replyingTo && (
          <div className="mb-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>Rispondi a {comments.find(c => c.id === replyingTo)?.author.full_name}</span>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-destructive hover:underline"
            >
              Annulla
            </button>
          </div>
        )}
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Scrivi un commento..."
            className="flex-1 bg-transparent border-none focus:outline-none resize-none text-sm min-h-[40px] max-h-[120px]"
            maxLength={500}
            rows={2}
          />
          <Button
            onClick={handleSubmit}
            disabled={!newComment.trim() || addComment.isPending}
            size="sm"
            className="rounded-full px-4 font-bold"
          >
            {addComment.isPending ? 'Invio...' : 'Invia'}
          </Button>
        </div>
      </div>
    </div>
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
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const handleLike = (reactionType: ReactionType = 'heart') => {
    haptics.light();
    const liked = reactions?.likedByMe || false;
    const prevType = (reactions?.myReactionType ?? 'heart') as ReactionType;
    const mode: 'add' | 'remove' | 'update' = !liked ? 'add' : prevType === reactionType ? 'remove' : 'update';
    toggleReaction.mutate({
      commentId: comment.id,
      mode,
      reactionType
    });
  };

  const likeHandlers = useLongPress({
    onLongPress: () => setShowReactionPicker(true),
    onTap: () => handleLike('heart'),
  });

  return (
    <div 
      className="px-4 py-3"
      style={{ paddingLeft: `${16 + comment.level * 16}px` }}
    >
      {comment.level > 0 && (
        <div 
          className="absolute left-4 top-0 bottom-0 w-0.5 bg-border"
          style={{ marginLeft: `${comment.level * 16 - 16}px` }}
        />
      )}
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {getUserAvatar(comment.author.avatar_url, comment.author.full_name || comment.author.username)}
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
          <p className="text-sm whitespace-pre-wrap break-words mb-1">{comment.content}</p>

          {/* Reaction Summary for multiple reaction types */}
          {reactions && reactions.likesCount > 0 && 
           Object.keys(reactions.byType || {}).length > 1 && (
            <div className="mb-2">
              <ReactionSummary
                reactions={getReactionCounts(reactions.byType)}
                totalCount={reactions.likesCount}
                showCount={false}
                className="text-xs"
              />
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center gap-4 mt-2">
            <div className="relative">
              <button
                {...likeHandlers}
                className="flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors active:scale-90"
              >
                {reactions?.myReactionType && reactions.myReactionType !== 'heart' ? (
                  <span className="text-base">{reactionToEmoji(reactions.myReactionType)}</span>
                ) : (
                  <Heart 
                    className={cn(
                      "w-4 h-4",
                      reactions?.likedByMe && "fill-destructive text-destructive"
                    )} 
                  />
                )}
                {reactions?.likesCount ? (
                  <span className="text-xs">{reactions.likesCount}</span>
                ) : null}
              </button>
              <ReactionPicker
                isOpen={showReactionPicker}
                onClose={() => setShowReactionPicker(false)}
                onSelect={(type) => {
                  handleLike(type);
                  setShowReactionPicker(false);
                }}
                currentReaction={reactions?.myReactionType}
              />
            </div>
            
            <button
              onClick={onReply}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Rispondi
            </button>
            
            {currentUserId === comment.author_id && (
              <button
                onClick={onDelete}
                className="text-xs text-destructive hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Elimina
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

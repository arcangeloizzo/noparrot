import { useState, useRef } from 'react';
import { Heart, MessageCircle, Trash2, Link2, Flag } from 'lucide-react';
import { Comment } from '@/hooks/useComments';
import { useCommentReactions } from '@/hooks/useCommentReactions';
import { cn, getDisplayUsername } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { MentionText } from './MentionText';
import { MediaGallery } from '@/components/media/MediaGallery';
import { haptics } from '@/lib/haptics';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import ParrotReadIcon from '@/assets/parrot-comment-read.png';
import ParrotUnreadIcon from '@/assets/parrot-comment-unread.png';

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onReply: () => void;
  onLike: (commentId: string, isLiked: boolean) => void;
  onDelete: () => void;
  isHighlighted?: boolean;
  postHasSource?: boolean;
}

export const CommentItem = ({
  comment,
  currentUserId,
  onReply,
  onLike,
  onDelete,
  isHighlighted,
  postHasSource = false
}: CommentItemProps) => {
  const navigate = useNavigate();
  const { data: reactions } = useCommentReactions(comment.id);
  const [isLiking, setIsLiking] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout>();

  const handleLike = () => {
    setIsLiking(true);
    haptics.light();
    onLike(comment.id, reactions?.likedByMe || false);
    setTimeout(() => setIsLiking(false), 250);
  };

  const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      haptics.medium();
      setShowMenu(true);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/post/${comment.post_id}?focus=${comment.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiato!');
    setShowMenu(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatar = () => {
    const name = comment.author.full_name || comment.author.username;
    if (comment.author.avatar_url) {
      return (
        <img
          src={comment.author.avatar_url}
          alt={name}
          className="w-10 h-10 rounded-full object-cover"
        />
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
        {getInitials(name)}
      </div>
    );
  };

  const indentAmount = comment.level > 0 ? comment.level * 32 : 0;

  return (
    <div
      className={cn(
        "relative border-b border-white/[0.07] py-3 transition-all duration-150 comment-item",
        isHighlighted && "bg-primary/5",
        "hover:bg-muted/20"
      )}
      style={{
        paddingLeft: `${16 + indentAmount}px`,
        paddingRight: '16px'
      }}
      onTouchStart={handleLongPressStart}
      onTouchEnd={handleLongPressEnd}
      onMouseDown={handleLongPressStart}
      onMouseUp={handleLongPressEnd}
      onMouseLeave={handleLongPressEnd}
    >
      {/* Thread line */}
      {comment.level > 0 && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-border/50"
          style={{
            left: `${16 + (comment.level - 1) * 32 + 20}px`
          }}
        />
      )}

      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {getAvatar()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="font-semibold text-base">
              {comment.author.full_name || getDisplayUsername(comment.author.username)}
            </span>
            
            {postHasSource && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger>
                    <img
                      src={comment.passed_gate ? ParrotReadIcon : ParrotUnreadIcon}
                      alt={comment.passed_gate ? 'Lettore consapevole' : 'Commento spontaneo'}
                      className="w-4 h-4"
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">
                      {comment.passed_gate
                        ? 'Ha letto la fonte prima di commentare'
                        : 'Non ha letto la fonte'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            <span className="text-muted-foreground text-sm">
              @{getDisplayUsername(comment.author.username)}
            </span>
            <span className="text-muted-foreground text-sm">·</span>
            <span className="text-muted-foreground text-xs">
              {formatDistanceToNow(new Date(comment.created_at), {
                addSuffix: true,
                locale: it
              })}
            </span>
          </div>

          <div className="text-[15px] leading-relaxed mb-2">
            <MentionText content={comment.content} />
          </div>

          {comment.media && comment.media.length > 0 && (
            <div className="mb-2">
              <MediaGallery media={comment.media} />
            </div>
          )}

          <div className="flex items-center gap-2 text-muted-foreground">
            <button
              onClick={onReply}
              className="flex items-center gap-1.5 py-1.5 px-2 -ml-2 rounded hover:bg-primary/10 hover:text-primary transition-colors"
              aria-label="Rispondi a questo commento"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs">Rispondi</span>
            </button>

            <button
              onClick={handleLike}
              className={cn(
                "flex items-center gap-1.5 py-1.5 px-2 rounded hover:bg-red-500/10 transition-all duration-200",
                reactions?.likedByMe && "text-red-500",
                isLiking && "scale-like"
              )}
              aria-label={reactions?.likedByMe ? "Rimuovi mi piace" : "Metti mi piace"}
            >
              <Heart className={cn("w-4 h-4", reactions?.likedByMe && "fill-current")} />
              {reactions?.likesCount && reactions.likesCount > 0 && (
                <span className="text-xs">{reactions.likesCount}</span>
              )}
            </button>

            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 py-1.5 px-2 rounded hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Condividi"
            >
              <Link2 className="w-4 h-4" />
            </button>

            {currentUserId === comment.author.id && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 py-1.5 px-2 rounded hover:bg-red-500/10 hover:text-red-500 transition-colors ml-auto"
                aria-label="Elimina commento"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Context Menu (long press) */}
      {showMenu && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end animate-fade-in"
          onClick={() => setShowMenu(false)}
        >
          <div className="bg-background w-full rounded-t-2xl p-4 space-y-2 animate-slide-up">
            <button
              onClick={copyLink}
              className="w-full flex items-center gap-3 p-3 hover:bg-muted rounded-lg transition-colors"
            >
              <Link2 className="w-5 h-5" />
              <span>Copia link</span>
            </button>
            <button
              onClick={() => {
                toast.info('Segnalazione inviata');
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-3 p-3 hover:bg-muted rounded-lg transition-colors"
            >
              <Flag className="w-5 h-5" />
              <span>Segnala</span>
            </button>
            {currentUserId === comment.author.id && (
              <button
                onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                <span>Elimina</span>
              </button>
            )}
            <button
              onClick={() => setShowMenu(false)}
              className="w-full p-3 bg-muted rounded-lg font-medium"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

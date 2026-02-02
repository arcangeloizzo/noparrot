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
import { LOGO_BASE, EDITORIAL } from '@/config/brand';
import { ReactionPicker, type ReactionType, reactionToEmoji } from '@/components/ui/reaction-picker';
import { useLongPress } from '@/hooks/useLongPress';
import { ReactionSummary, getReactionCounts } from '@/components/feed/ReactionSummary';

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onReply: () => void;
  onLike: (commentId: string, isLiked: boolean) => void;
  onDelete: () => void;
  isHighlighted?: boolean;
  postHasSource?: boolean;
  onMediaClick?: (media: any[], index: number) => void;
  getUserAvatar?: (avatarUrl: string | null | undefined, name: string | undefined, username?: string) => React.ReactNode;
}

export const CommentItem = ({
  comment,
  currentUserId,
  onReply,
  onLike,
  onDelete,
  isHighlighted,
  postHasSource = false,
  onMediaClick,
  getUserAvatar: externalGetUserAvatar
}: CommentItemProps) => {
  const navigate = useNavigate();
  const { data: reactions } = useCommentReactions(comment.id);
  const [isLiking, setIsLiking] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout>();

  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const handleLike = (reactionType: ReactionType = 'heart') => {
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

  // Long press handlers for like button
  const likeButtonHandlers = useLongPress({
    onLongPress: () => setShowReactionPicker(true),
    onTap: () => handleLike('heart'),
  });

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
    // Check if this is IL PUNTO editorial account
    if (comment.author_id === EDITORIAL.SYSTEM_ID || 
        comment.author.username?.toLowerCase() === 'ilpunto' ||
        comment.author.username?.toLowerCase() === 'il punto') {
      return (
        <img
          src={EDITORIAL.AVATAR_IMAGE}
          alt={EDITORIAL.NAME}
          className="w-8 h-8 rounded-full object-cover"
        />
      );
    }
    
    const name = comment.author.full_name || comment.author.username;
    if (comment.author.avatar_url) {
      return (
        <img
          src={comment.author.avatar_url}
          alt={name}
          className="w-8 h-8 rounded-full object-cover"
        />
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-primary/60 flex items-center justify-center text-xs font-semibold text-primary-foreground">
        {getInitials(name)}
      </div>
    );
  };

  // Visual nesting with thread line
  const indentAmount = comment.level > 0 ? Math.min(comment.level, 3) * 20 : 0;
  const isNested = comment.level > 0;

  return (
    <div
      id={`comment-${comment.id}`}
      className={cn(
        "relative transition-all duration-300",
        isHighlighted && "bg-primary/10 ring-1 ring-primary/30 rounded-2xl"
      )}
      style={{
        marginLeft: `${indentAmount}px`,
      }}
      onTouchStart={handleLongPressStart}
      onTouchEnd={handleLongPressEnd}
      onMouseDown={handleLongPressStart}
      onMouseUp={handleLongPressEnd}
      onMouseLeave={handleLongPressEnd}
    >
      {/* Compact comment card */}
      <div className={cn(
        "relative py-2.5 px-3 rounded-xl mb-1 transition-all duration-200",
        "bg-white/[0.02]",
        "border border-white/[0.04]",
        "hover:bg-white/[0.04]",
        isNested && "ml-2"
      )}>
        {/* Thread connector line for nested comments */}
        {isNested && (
          <div
            className="absolute -left-3 top-5 w-3 h-0.5 bg-gradient-to-r from-primary/40 to-transparent"
          />
        )}
        
        {/* Vertical thread line */}
        {isNested && (
          <div
            className="absolute -left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/30 via-primary/20 to-transparent rounded-full"
          />
        )}

        {/* Header: Avatar + Name + Timestamp */}
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            {getAvatar()}
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Name row - compact */}
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-bold text-sm text-foreground">
                {comment.author.full_name || getDisplayUsername(comment.author.username)}
              </span>
              
              {/* Aware badge */}
              {postHasSource && comment.passed_gate && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger>
                      <img
                        src={LOGO_BASE}
                        alt="Lettore consapevole"
                        className="w-4 h-4"
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-[#1a2227] border-white/10">
                      <p className="text-xs">
                        Ha letto la fonte prima di commentare
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              <span className="text-muted-foreground/50 text-xs">
                · {formatDistanceToNow(new Date(comment.created_at), {
                  addSuffix: false,
                  locale: it
                })}
              </span>
            </div>

            {/* Body: Comment text */}
            <div className="text-sm leading-relaxed text-foreground/90 mb-1">
              <MentionText content={comment.content} />
            </div>

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

            {/* Media */}
            {comment.media && comment.media.length > 0 && (
              <div className="mb-3 rounded-xl overflow-hidden">
                <MediaGallery 
                  media={comment.media} 
                  onClick={onMediaClick ? (media, index) => onMediaClick(comment.media || [], index) : undefined}
                />
              </div>
            )}

            {/* Footer: Actions - select-none prevents text selection on long-press */}
            <div className="flex items-center gap-1 action-bar-zone">
              {/* Like button with long press for reaction picker */}
              <div className="relative">
                <button
                  {...likeButtonHandlers}
                  className={cn(
                    "flex items-center gap-1.5 py-1.5 px-2.5 rounded-full transition-all duration-200 select-none",
                    "hover:bg-destructive/10",
                    reactions?.likedByMe && "text-destructive",
                    isLiking && "scale-110"
                  )}
                  aria-label={reactions?.likedByMe ? "Rimuovi mi piace" : "Metti mi piace"}
                >
                  {reactions?.myReactionType && reactions.myReactionType !== 'heart' ? (
                    <span className="text-base select-none">{reactionToEmoji(reactions.myReactionType)}</span>
                  ) : (
                    <Heart className={cn(
                      "w-4 h-4 transition-all",
                      reactions?.likedByMe && "fill-destructive text-destructive"
                    )} />
                  )}
                  {reactions?.likesCount && reactions.likesCount > 0 && (
                    <span className="text-xs font-medium select-none">{reactions.likesCount}</span>
                  )}
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

              {/* Reply button */}
              <button
                onClick={onReply}
                className={cn(
                  "flex items-center gap-1.5 py-1.5 px-2.5 rounded-full transition-all duration-200 select-none",
                  "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                aria-label="Rispondi a questo commento"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-xs font-medium select-none">Rispondi</span>
              </button>

              {/* Share/Copy link */}
              <button
                onClick={copyLink}
                className={cn(
                  "flex items-center gap-1.5 py-1.5 px-2 rounded-full transition-all duration-200",
                  "text-muted-foreground/60 hover:text-foreground hover:bg-white/5"
                )}
                aria-label="Condividi"
              >
                <Link2 className="w-3.5 h-3.5" />
              </button>

              {/* Delete (owner only) */}
              {currentUserId === comment.author.id && (
                <button
                  onClick={onDelete}
                  className={cn(
                    "flex items-center gap-1.5 py-1.5 px-2 rounded-full transition-all duration-200 ml-auto",
                    "text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10"
                  )}
                  aria-label="Elimina commento"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu (long press) */}
      {showMenu && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end animate-fade-in"
          onClick={() => setShowMenu(false)}
        >
          <div className="bg-[#0E1419] w-full rounded-t-3xl p-4 space-y-2 animate-slide-up border-t border-white/10">
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            
            <button
              onClick={copyLink}
              className="w-full flex items-center gap-4 p-4 hover:bg-white/5 rounded-xl transition-colors"
            >
              <div className="p-2 rounded-full bg-white/5">
                <Link2 className="w-5 h-5" />
              </div>
              <span className="font-medium">Copia link</span>
            </button>
            
            <button
              onClick={() => {
                toast.info('Segnalazione inviata');
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-4 p-4 hover:bg-white/5 rounded-xl transition-colors"
            >
              <div className="p-2 rounded-full bg-white/5">
                <Flag className="w-5 h-5" />
              </div>
              <span className="font-medium">Segnala</span>
            </button>
            
            {currentUserId === comment.author.id && (
              <button
                onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-4 p-4 hover:bg-red-500/10 rounded-xl transition-colors text-red-400"
              >
                <div className="p-2 rounded-full bg-red-500/10">
                  <Trash2 className="w-5 h-5" />
                </div>
                <span className="font-medium">Elimina</span>
              </button>
            )}
            
            <button
              onClick={() => setShowMenu(false)}
              className="w-full p-4 bg-white/5 rounded-xl font-medium mt-2 hover:bg-white/10 transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

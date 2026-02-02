import { useState, useRef } from 'react';
import { Heart, MessageCircle, Trash2, Link2 } from 'lucide-react';
import { Comment } from '@/hooks/useComments';
import { useCommentReactions, useToggleCommentReaction } from '@/hooks/useCommentReactions';
import { useFocusCommentReactions, useToggleFocusCommentReaction } from '@/hooks/useFocusCommentReactions';
import { useMediaCommentReactions, useToggleMediaCommentReaction } from '@/hooks/useMediaCommentReactions';
import { cn, getDisplayUsername } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { MentionText } from './MentionText';
import { MediaGallery } from '@/components/media/MediaGallery';
import { haptics } from '@/lib/haptics';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
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
  onDelete: () => void;
  isHighlighted?: boolean;
  postHasSource?: boolean;
  onMediaClick?: (media: any[], index: number) => void;
  getUserAvatar?: (avatarUrl: string | null | undefined, name: string | undefined, username?: string) => React.ReactNode;
  /** Determines which reaction table to use: 'post' for comment_reactions, 'focus' for focus_comment_reactions, 'media' for media_comment_reactions */
  commentKind?: 'post' | 'focus' | 'media';
}

export const CommentItem = ({
  comment,
  currentUserId,
  onReply,
  onDelete,
  isHighlighted,
  postHasSource = false,
  onMediaClick,
  getUserAvatar: externalGetUserAvatar,
  commentKind = 'post'
}: CommentItemProps) => {
  const { user } = useAuth();
  
  // Use correct hooks based on commentKind
  const postReactionsQuery = useCommentReactions(commentKind === 'post' ? comment.id : '');
  const focusReactionsQuery = useFocusCommentReactions(commentKind === 'focus' ? comment.id : '');
  const mediaReactionsQuery = useMediaCommentReactions(commentKind === 'media' ? comment.id : '');
  
  const reactions = commentKind === 'media' 
    ? mediaReactionsQuery.data 
    : commentKind === 'focus' 
      ? focusReactionsQuery.data 
      : postReactionsQuery.data;
  
  const togglePostReaction = useToggleCommentReaction();
  const toggleFocusReaction = useToggleFocusCommentReaction();
  const toggleMediaReaction = useToggleMediaCommentReaction();
  
  const [isLiking, setIsLiking] = useState(false);

  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const likeButtonRef = useRef<HTMLButtonElement>(null);
  
  const handleLike = (reactionType: ReactionType = 'heart') => {
    if (!user) {
      toast.error('Devi effettuare il login');
      return;
    }
    
    setIsLiking(true);
    haptics.light();
    
    // Calculate correct mode
    const liked = reactions?.likedByMe || false;
    const prevType = (reactions?.myReactionType ?? 'heart') as ReactionType;
    const mode: 'add' | 'remove' | 'update' = !liked ? 'add' : prevType === reactionType ? 'remove' : 'update';
    
    // Use correct mutation based on commentKind
    if (commentKind === 'media') {
      toggleMediaReaction.mutate({ mediaCommentId: comment.id, mode, reactionType });
    } else if (commentKind === 'focus') {
      toggleFocusReaction.mutate({ focusCommentId: comment.id, mode, reactionType });
    } else {
      togglePostReaction.mutate({ commentId: comment.id, mode, reactionType });
    }
    
    setTimeout(() => setIsLiking(false), 250);
  };

  // Long press handlers for like button
  const likeButtonHandlers = useLongPress({
    onLongPress: () => setShowReactionPicker(true),
    onTap: () => handleLike('heart'),
  });

  const copyLink = () => {
    // Only show copy link for post comments (focus comments don't have post_id)
    if (commentKind === 'focus' || !comment.post_id) {
      toast.info('Link non disponibile');
      return;
    }
    const url = `${window.location.origin}/post/${comment.post_id}?focus=${comment.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiato!');
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
            <div 
              className="flex items-center gap-1 action-bar-zone"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {/* Like button with long press for reaction picker */}
              <div className="relative">
                <button
                  ref={likeButtonRef}
                  {...likeButtonHandlers}
                  className={cn(
                    "flex items-center gap-1.5 py-1.5 px-2.5 rounded-full transition-all duration-200 select-none",
                    "hover:bg-destructive/10",
                    reactions?.likedByMe && "text-destructive",
                    isLiking && "scale-110"
                  )}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
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
                  triggerRef={likeButtonRef}
                />
              </div>

              {/* Reply button */}
              <button
                onClick={onReply}
                className={cn(
                  "flex items-center gap-1.5 py-1.5 px-2.5 rounded-full transition-all duration-200 select-none",
                  "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                aria-label="Rispondi a questo commento"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-xs font-medium select-none">Rispondi</span>
              </button>

              {/* Share/Copy link - only for post comments */}
              {commentKind === 'post' && comment.post_id && (
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
              )}

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
    </div>
  );
};

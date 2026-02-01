import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Message, useDeleteMessageForMe } from "@/hooks/useMessages";
import { useDeleteMessage } from "@/hooks/useDeleteMessage";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ExternalLink, Heart, Trash2, EyeOff } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { fetchArticlePreview } from "@/lib/ai-helpers";
import { useMessageReactions } from "@/hooks/useMessageReactions";
import { useDoubleTap } from "@/hooks/useDoubleTap";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const getHostnameFromUrl = (url: string): string => {
  try {
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    return new URL(urlWithProtocol).hostname;
  } catch {
    return 'Link';
  }
};

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble = memo(({ message }: MessageBubbleProps) => {
  const { user } = useAuth();
  const isSent = message.sender_id === user?.id;
  const [articlePreview, setArticlePreview] = useState<any>(null);
  const [showActions, setShowActions] = useState(false);

  const bubbleRef = useRef<HTMLDivElement>(null);

  const {
    likes,
    isLiked,
    likeUsers,
    toggleLike,
    isMutating: isLikeMutating,
  } = useMessageReactions(message.id);

  const deleteMessageForMe = useDeleteMessageForMe();
  const deleteMessage = useDeleteMessage();

  const handleDeleteForMe = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(false);
    deleteMessageForMe.mutate({ messageId: message.id, threadId: message.thread_id });
  };

  const handleDeleteForEveryone = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(false);
    deleteMessage.mutate(message.id);
  };

  // Fetch article preview for link_url
  useEffect(() => {
    const loadPreview = async () => {
      if (!message.link_url) {
        setArticlePreview(null);
        return;
      }

      try {
        const preview = await fetchArticlePreview(message.link_url);
        if (preview) {
          setArticlePreview(preview);
        }
      } catch (error) {
        console.error('Error fetching message link preview:', error);
      }
    };

    loadPreview();
  }, [message.link_url]);

  // Shake animation for error feedback
  const shakeAnimation = () => {
    if (bubbleRef.current) {
      bubbleRef.current.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(4px)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 250, easing: 'ease-in-out' }
      );
    }
  };

  // Determine mode BEFORE any optimistic update
  const handleLike = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) {
      // useMessageReactions will toast
      toggleLike('add');
      return;
    }
    if (isLikeMutating) return;

    // Mode is determined by current isLiked state BEFORE mutation
    const mode = isLiked ? 'remove' : 'add';
    toggleLike(mode, {
      onErrorCallback: shakeAnimation,
    });
  };

  const [showHeartAnimation, setShowHeartAnimation] = useState(false);

  // Double tap toggles like (add or remove)
  const { handleTap } = useDoubleTap({
    onDoubleTap: () => {
      if (!user) return;
      if (isLikeMutating) return;

      const mode = isLiked ? 'remove' : 'add';
      
      // Show heart animation only when adding
      if (mode === 'add') {
        setShowHeartAnimation(true);
        setTimeout(() => setShowHeartAnimation(false), 800);
      }
      
      toggleLike(mode, {
        onErrorCallback: shakeAnimation,
      });
    },
  });

  const handleDoubleTap = () => {
    handleTap();
  };

  return (
    <div id={`message-${message.id}`} className={cn('flex gap-2 mb-4 rounded-lg', isSent ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar solo per messaggi ricevuti */}
      {!isSent && (
        <Avatar className="h-7 w-7 flex-shrink-0 mt-1">
          <AvatarImage src={message.sender.avatar_url || undefined} />
          <AvatarFallback className="text-xs bg-muted">
            {message.sender.username?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('flex flex-col max-w-[75%] group', isSent ? 'items-end' : 'items-start')}>
        <div className="flex items-center gap-1.5">
          {/* Action popover - posizionato a sinistra per i miei messaggi, a destra per gli altri */}
          {isSent && (
            <Popover open={showActions} onOpenChange={setShowActions}>
              <PopoverTrigger asChild>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-accent rounded-full transition-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                    <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                    <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="left"
                align="center"
                className="w-auto p-1.5 bg-popover/95 backdrop-blur-xl border-border"
              >
                <div className="flex gap-1">
                  <button
                    onClick={(e) => handleLike(e)}
                    className={cn(
                      'p-2 hover:bg-accent rounded-lg transition-colors',
                      isLiked && 'text-destructive'
                    )}
                  >
                    <Heart className={cn('w-4 h-4', isLiked && 'fill-current')} />
                  </button>
                  <button
                    onClick={handleDeleteForMe}
                    className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground"
                    title="Nascondi per me"
                  >
                    <EyeOff className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDeleteForEveryone}
                    className="p-2 hover:bg-destructive/20 rounded-lg transition-colors text-destructive"
                    title="Elimina per tutti"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <div className="relative">
            <div
              ref={bubbleRef}
              onPointerUp={(e) => {
                e.preventDefault();
                handleDoubleTap();
              }}
              className={cn(
                'rounded-2xl px-4 py-2.5 cursor-pointer select-none touch-manipulation',
                isSent
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-secondary text-secondary-foreground rounded-bl-sm'
              )}
            >
              {/* Heart animation on double tap */}
              {showHeartAnimation && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <Heart className="w-12 h-12 text-destructive fill-destructive animate-scale-in" />
                </div>
              )}

              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>

              {message.link_url && articlePreview && (
                <div
                  className={cn(
                    'mt-2 rounded-xl overflow-hidden cursor-pointer group/link',
                    isSent ? 'bg-primary-foreground/10' : 'bg-muted border border-border/30'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(message.link_url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  {/* Image preview */}
                  {(articlePreview.image || articlePreview.previewImg) && (
                    <div className="aspect-video w-full overflow-hidden bg-muted">
                      <img
                        src={articlePreview.image || articlePreview.previewImg}
                        alt={articlePreview.title || ''}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover/link:scale-105 transition-transform duration-200"
                      />
                    </div>
                  )}

                  <div className="p-2.5">
                    {/* Twitter author info */}
                    {articlePreview.platform === 'twitter' && articlePreview.author_username && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-semibold text-primary">
                            {articlePreview.author_username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">
                            {articlePreview.author_name || articlePreview.author_username}
                          </span>
                          <span className="text-[10px] text-muted-foreground">@{articlePreview.author_username}</span>
                        </div>
                      </div>
                    )}

                    <div
                      className={cn(
                        'flex items-center gap-1.5 text-[10px] mb-1',
                        isSent ? 'text-primary-foreground/60' : 'text-muted-foreground'
                      )}
                    >
                      <span>{getHostnameFromUrl(message.link_url)}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                    </div>

                    {/* Show full tweet content or article title */}
                    {articlePreview.content && articlePreview.platform === 'twitter' ? (
                      <p
                        className={cn(
                          'text-xs whitespace-pre-wrap leading-relaxed',
                          isSent ? 'text-primary-foreground/80' : 'text-foreground/80'
                        )}
                      >
                        {articlePreview.content}
                      </p>
                    ) : (
                      <div
                        className={cn(
                          'font-medium text-xs line-clamp-2',
                          isSent ? 'text-primary-foreground/90' : 'text-foreground/90'
                        )}
                      >
                        {articlePreview.title || 'Articolo condiviso'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {message.link_url && !articlePreview && (
                <a
                  href={message.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex items-center gap-1 mt-2 text-xs underline',
                    isSent
                      ? 'text-primary-foreground/80 hover:text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <ExternalLink className="h-3 w-3" />
                  Link
                </a>
              )}

              {message.media && message.media.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.media.map((media) => (
                    <div key={media.id} className="rounded-lg overflow-hidden">
                      {media.type === 'image' ? (
                        <img
                          src={media.url}
                          alt=""
                          loading="lazy"
                          className="max-w-full h-auto rounded-lg"
                        />
                      ) : (
                        <video
                          src={media.url}
                          controls
                          preload="metadata"
                          className="max-w-full h-auto rounded-lg"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Instagram-style like indicator - pill below bubble corner */}
            {/* Rendering basato su likes > 0, non su likeUsers.length */}
            {likes > 0 && (
              <div
                className={cn(
                  'absolute -bottom-3 flex items-center',
                  'bg-secondary/95 rounded-full shadow-xl',
                  'px-2 py-1 min-w-[28px] justify-center',
                  isSent ? 'right-2' : 'left-2'
                )}
              >
                <Heart className="w-4 h-4 text-destructive fill-destructive" />
                {likeUsers && likeUsers.length > 0 ? (
                  <>
                    <div className="flex -space-x-1.5 ml-1">
                      {likeUsers.slice(0, 2).map((likeUser) => (
                        <Avatar key={likeUser.id} className="w-5 h-5 border-2 border-secondary">
                          <AvatarImage src={likeUser.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px] bg-muted text-muted-foreground">
                            {likeUser.username?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    {likes > 2 && <span className="text-[10px] text-muted-foreground ml-1">+{likes - 2}</span>}
                  </>
                ) : (
                  // Fallback: mostra solo count quando likeUsers non disponibili
                  likes > 1 && <span className="text-[10px] text-muted-foreground ml-1">{likes}</span>
                )}
              </div>
            )}
          </div>

          {/* Action popover for received messages */}
          {!isSent && (
            <Popover open={showActions} onOpenChange={setShowActions}>
              <PopoverTrigger asChild>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-accent rounded-full transition-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                    <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                    <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="center"
                className="w-auto p-1.5 bg-popover/95 backdrop-blur-xl border-border"
              >
                <div className="flex gap-1">
                  <button
                    onClick={(e) => handleLike(e)}
                    className={cn(
                      'p-2 hover:bg-accent rounded-lg transition-colors',
                      isLiked && 'text-destructive'
                    )}
                  >
                    <Heart className={cn('w-4 h-4', isLiked && 'fill-current')} />
                  </button>
                  {/* Solo "Nascondi per me" per messaggi ricevuti - NO elimina per tutti */}
                  <button
                    onClick={handleDeleteForMe}
                    className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground"
                    title="Nascondi per me"
                  >
                    <EyeOff className="w-4 h-4" />
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Timestamp row - with extra margin when likes present */}
        <div
          className={cn(
            'flex items-center gap-2 px-1',
            isSent ? 'flex-row-reverse' : 'flex-row',
            likes > 0 ? 'mt-3' : 'mt-1'
          )}
        >
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(message.created_at), 'HH:mm', { locale: it })}
          </span>
        </div>
      </div>
    </div>
  );
});

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Message, useDeleteMessageForMe } from "@/hooks/useMessages";
import { useDeleteMessage } from "@/hooks/useDeleteMessage";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ExternalLink, Heart, Trash2, EyeOff } from "lucide-react";
import { memo, useRef, useState } from "react";
import { useArticlePreview } from "@/hooks/useArticlePreview";
import { useMessageReactionAggregate } from "@/hooks/useThreadReactions";
import { useDoubleTap } from "@/hooks/useDoubleTap";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLongPress } from "@/hooks/useLongPress";
import { ReactionPicker } from "@/components/ui/reaction-picker";
import { InternalPostPreview } from "./InternalPostPreview";
import { ProgressiveImage } from "@/components/feed/ProgressiveImage";

const getHostnameFromUrl = (url: string): string => {
  try {
    const withProto = url.startsWith("http") ? url : `https://${url}`;
    return new URL(withProto).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
};

interface MessageBubbleProps {
  message: Message;
  /** Received: show avatar only on the tail of a group. */
  showAvatar?: boolean;
  /** Show timestamp only on the tail of a group. */
  showTime?: boolean;
  /** Whether this bubble is the tail (last of its author group). */
  isTail?: boolean;
}

export const MessageBubble = memo(({
  message,
  showAvatar = true,
  showTime = true,
  isTail = true,
}: MessageBubbleProps) => {
  const { user } = useAuth();
  const isSent = message.sender_id === user?.id;

  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);

  const bubbleRef = useRef<HTMLDivElement>(null);

  const reactionsCtx = useMessageReactionAggregate(message.id);
  const { likes, isLiked, likeUsers } = reactionsCtx.get(message.id);
  const isLikeMutating = reactionsCtx.isPending;

  const deleteMessageForMe = useDeleteMessageForMe();
  const deleteMessage = useDeleteMessage();

  // Cached article preview (React Query, staleTime lungo)
  const isExternalUrl = !!message.link_url && !message.link_url.includes("/post/");
  const { data: articlePreview } = useArticlePreview(
    isExternalUrl ? message.link_url : undefined
  );

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

  const getInternalPostId = (url: string | undefined | null): string | null => {
    if (!url) return null;
    const match = url.match(/\/post\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  };
  const internalPostId = getInternalPostId(message.link_url);

  const shakeAnimation = () => {
    if (bubbleRef.current) {
      bubbleRef.current.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(4px)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 250, easing: "ease-in-out" }
      );
    }
  };

  const handleLike = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) {
      reactionsCtx.toggle(message.id, "add");
      return;
    }
    if (isLikeMutating) return;
    const mode = isLiked ? "remove" : "add";
    reactionsCtx.toggle(message.id, mode, shakeAnimation);
  };

  const messageLongPressHandlers = useLongPress({
    onLongPress: () => setShowReactionPicker(true),
    onTap: () => {},
    disableHaptic: true,
  });

  const { handleTap } = useDoubleTap({
    onDoubleTap: () => {
      if (!user || isLikeMutating) return;
      const mode = isLiked ? "remove" : "add";
      if (mode === "add") {
        setShowHeartAnimation(true);
        setTimeout(() => setShowHeartAnimation(false), 800);
      }
      reactionsCtx.toggle(message.id, mode, shakeAnimation);
    },
  });

  const hasText = !!message.content?.trim();
  const hasMedia = !!(message.media && message.media.length > 0);
  const mediaOnly = !hasText && hasMedia && !message.link_url;

  // Group tail dictates coda + margin bottom
  const bubbleRadius = isSent
    ? isTail
      ? "20px 20px 6px 20px"
      : "20px 20px 20px 20px"
    : isTail
      ? "20px 20px 20px 6px"
      : "20px 20px 20px 20px";

  const groupSpacing = isTail ? 14 : 3;

  return (
    <div
      id={`message-${message.id}`}
      className={cn("flex gap-2", isSent ? "flex-row-reverse" : "flex-row")}
      style={{ marginBottom: groupSpacing }}
    >
      {/* Avatar reserved space — visible only on TAIL for received */}
      {!isSent && (
        <div style={{ width: 28, flexShrink: 0 }}>
          {showAvatar && (
            <Avatar className="h-7 w-7 mt-1">
              <AvatarImage src={message.sender.avatar_url || undefined} />
              <AvatarFallback className="text-xs bg-muted">
                {message.sender.username?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      )}

      <div className={cn("flex flex-col max-w-[75%] group", isSent ? "items-end" : "items-start")}>
        <div className="flex items-center gap-1.5">
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
              <PopoverContent side="left" align="center" className="w-auto p-1.5 bg-popover/95 backdrop-blur-xl border-border">
                <div className="flex gap-1">
                  <button
                    onClick={(e) => handleLike(e)}
                    className={cn("p-2 hover:bg-accent rounded-lg transition-colors", isLiked && "text-destructive")}
                  >
                    <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
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
              {...messageLongPressHandlers}
              onPointerUp={() => handleTap()}
              className={cn(
                "cursor-pointer select-none touch-manipulation overflow-hidden relative",
                mediaOnly ? "p-0" : "px-4 py-2.5"
              )}
              style={{
                borderRadius: mediaOnly ? 18 : bubbleRadius,
                background: isSent ? "#0A7AFF" : "rgba(255,255,255,0.06)",
                color: isSent ? "#FFFFFF" : "var(--txt)",
                border: isSent ? "1px solid rgba(10,122,255,0.5)" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <ReactionPicker
                isOpen={showReactionPicker}
                onClose={() => setShowReactionPicker(false)}
                onSelect={() => {
                  reactionsCtx.toggle(message.id, "add");
                  setShowReactionPicker(false);
                }}
                className="left-1/2 bottom-full mb-2"
              />

              {showHeartAnimation && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <Heart className="w-12 h-12 text-destructive fill-destructive animate-scale-in" />
                </div>
              )}

              {hasText && (
                <p
                  style={{
                    fontSize: 15,
                    lineHeight: 1.45,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {message.content}
                </p>
              )}

              {internalPostId && (
                <div className="mt-2 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                  <InternalPostPreview postId={internalPostId} />
                </div>
              )}

              {message.link_url && articlePreview && !internalPostId && (
                <div
                  className={cn(
                    "mt-2 rounded-xl overflow-hidden cursor-pointer group/link",
                    isSent ? "bg-white/10" : "bg-white/5 border border-white/10"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(message.link_url!, "_blank", "noopener,noreferrer");
                  }}
                >
                  {articlePreview.image && (
                    <div className="aspect-video w-full overflow-hidden">
                      <ProgressiveImage
                        src={articlePreview.image}
                        alt={articlePreview.title || ""}
                        sizePx={280}
                        shouldLoad
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-2.5">
                    <div
                      className="flex items-center gap-1.5 mb-1"
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 9.5,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: isSent ? "rgba(255,255,255,0.72)" : "var(--txt-3)",
                      }}
                    >
                      <span>{getHostnameFromUrl(message.link_url)}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                    </div>
                    <div
                      className="font-medium line-clamp-2"
                      style={{ fontSize: 13, color: isSent ? "#FFFFFF" : "var(--txt)" }}
                    >
                      {articlePreview.title || "Articolo condiviso"}
                    </div>
                  </div>
                </div>
              )}

              {message.link_url && !articlePreview && !internalPostId && (
                <a
                  href={message.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 mt-2 text-xs underline"
                  style={{ color: isSent ? "rgba(255,255,255,0.85)" : "var(--txt-2)" }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Link
                </a>
              )}

              {hasMedia && (
                <div className={cn(mediaOnly ? "" : "mt-2", "space-y-2 relative")}>
                  {message.media!.map((media) => (
                    <div
                      key={media.id}
                      style={{
                        borderRadius: mediaOnly ? 18 : 12,
                        overflow: "hidden",
                        aspectRatio: "4 / 5",
                        background: "rgba(0,0,0,0.2)",
                      }}
                    >
                      {media.type === "image" ? (
                        <ProgressiveImage
                          src={media.thumbnail_url || media.url}
                          alt=""
                          sizePx={280}
                          shouldLoad
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={media.url}
                          poster={media.thumbnail_url || undefined}
                          controls
                          preload="none"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                  {mediaOnly && showTime && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 8,
                        right: 8,
                        background: "rgba(0,0,0,0.55)",
                        color: "#FFFFFF",
                        borderRadius: 10,
                        padding: "3px 8px",
                        fontFamily: "var(--mono)",
                        fontSize: 9.5,
                        letterSpacing: "0.05em",
                      }}
                    >
                      {format(new Date(message.created_at), "HH:mm", { locale: it })}
                    </span>
                  )}
                </div>
              )}
            </div>

            {likes > 0 && (
              <div
                className={cn(
                  "absolute -bottom-3 flex items-center rounded-full shadow-xl px-2 py-1 min-w-[28px] justify-center",
                  isSent ? "right-2" : "left-2"
                )}
                style={{ background: "rgba(14,21,34,0.9)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <Heart className="w-4 h-4 text-destructive fill-destructive" />
                {likeUsers && likeUsers.length > 0 ? (
                  <>
                    <div className="flex -space-x-1.5 ml-1">
                      {likeUsers.slice(0, 2).map((likeUser) => (
                        <Avatar key={likeUser.id} className="w-5 h-5 border-2" style={{ borderColor: "rgba(14,21,34,0.9)" }}>
                          <AvatarImage src={likeUser.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px] bg-muted text-muted-foreground">
                            {likeUser.username?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    {likes > 2 && <span className="text-[10px] text-muted-foreground ml-1">+{likes - 2}</span>}
                  </>
                ) : (
                  likes > 1 && <span className="text-[10px] text-muted-foreground ml-1">{likes}</span>
                )}
              </div>
            )}
          </div>

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
              <PopoverContent side="right" align="center" className="w-auto p-1.5 bg-popover/95 backdrop-blur-xl border-border">
                <div className="flex gap-1">
                  <button
                    onClick={(e) => handleLike(e)}
                    className={cn("p-2 hover:bg-accent rounded-lg transition-colors", isLiked && "text-destructive")}
                  >
                    <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
                  </button>
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

        {showTime && !mediaOnly && (
          <div
            className={cn(
              "flex items-center gap-2 px-1",
              isSent ? "flex-row-reverse" : "flex-row",
              likes > 0 ? "mt-3" : "mt-1"
            )}
          >
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9.5,
                letterSpacing: "0.05em",
                color: "var(--txt-4)",
                textTransform: "uppercase",
              }}
            >
              {format(new Date(message.created_at), "HH:mm", { locale: it })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = "MessageBubble";
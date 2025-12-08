import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Message } from "@/hooks/useMessages";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ExternalLink, Heart } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { fetchArticlePreview } from "@/lib/ai-helpers";
import { useMessageReactions } from "@/hooks/useMessageReactions";
import { useDoubleTap } from "@/hooks/useDoubleTap";

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
  const { likes, isLiked, toggleLike, isLoading: isLikeLoading } = useMessageReactions(message.id);

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

  const handleLike = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isLikeLoading) {
      toggleLike();
    }
  };

  // Double tap to like
  const { handleTap } = useDoubleTap({
    onDoubleTap: () => {
      if (!isLiked) {
        handleLike();
      }
    }
  });

  const [showHeartAnimation, setShowHeartAnimation] = useState(false);

  const handleDoubleTap = () => {
    handleTap();
    if (!isLiked) {
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 800);
    }
  };

  return (
    <div className={cn("flex gap-2 mb-3", isSent ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar solo per messaggi ricevuti */}
      {!isSent && (
        <Avatar className="h-7 w-7 flex-shrink-0 mt-1">
          <AvatarImage src={message.sender.avatar_url || undefined} />
          <AvatarFallback className="text-xs bg-muted">
            {message.sender.username?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn("flex flex-col max-w-[75%]", isSent ? "items-end" : "items-start")}>
        <div
          onClick={handleDoubleTap}
          className={cn(
            "rounded-2xl px-4 py-2.5 relative cursor-pointer select-none",
            isSent
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-background text-foreground rounded-bl-md shadow-sm border border-border/50"
          )}
        >
          {/* Heart animation on double tap */}
          {showHeartAnimation && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <Heart className="w-12 h-12 text-brand-pink fill-brand-pink animate-scale-in" />
            </div>
          )}
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>

          {message.link_url && articlePreview && (
            <div 
              className={cn(
                "mt-2 rounded-xl overflow-hidden cursor-pointer group",
                isSent ? "bg-primary-foreground/10" : "bg-muted border border-border/30"
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
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
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
                      <span className="text-[10px] text-muted-foreground">
                        @{articlePreview.author_username}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className={cn(
                  "flex items-center gap-1.5 text-[10px] mb-1",
                  isSent ? "text-primary-foreground/60" : "text-muted-foreground"
                )}>
                  <span>{getHostnameFromUrl(message.link_url)}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                {/* Show full tweet content or article title */}
                {articlePreview.content && articlePreview.platform === 'twitter' ? (
                  <p className={cn(
                    "text-xs whitespace-pre-wrap leading-relaxed",
                    isSent ? "text-primary-foreground/80" : "text-foreground/80"
                  )}>
                    {articlePreview.content}
                  </p>
                ) : (
                  <div className={cn(
                    "font-medium text-xs line-clamp-2",
                    isSent ? "text-primary-foreground/90" : "text-foreground/90"
                  )}>
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
                "flex items-center gap-1 mt-2 text-xs underline",
                isSent ? "text-primary-foreground/80 hover:text-primary-foreground" : "text-muted-foreground hover:text-foreground"
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

        {/* Like button and timestamp row */}
        <div className={cn(
          "flex items-center gap-2 mt-1 px-1",
          isSent ? "flex-row-reverse" : "flex-row"
        )}>
          {/* Like button */}
          <button
            onClick={handleLike}
            disabled={isLikeLoading}
            className={cn(
              "flex items-center gap-1 text-xs transition-all duration-200 hover:scale-110 active:scale-95",
              isLiked ? "text-brand-pink" : "text-muted-foreground hover:text-brand-pink/70"
            )}
          >
            <Heart 
              className={cn(
                "w-3.5 h-3.5 transition-all",
                isLiked && "fill-brand-pink animate-scale-in"
              )} 
            />
            {likes > 0 && <span className="text-[10px]">{likes}</span>}
          </button>

          {/* Timestamp */}
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(message.created_at), 'HH:mm', { locale: it })}
          </span>
        </div>
      </div>
    </div>
  );
});

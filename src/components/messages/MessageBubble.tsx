import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Message } from "@/hooks/useMessages";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { fetchArticlePreview } from "@/lib/ai-helpers";

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

  return (
    <div className={cn("flex gap-2 mb-4", isSent ? "flex-row-reverse" : "flex-row")}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={message.sender.avatar_url || undefined} />
        <AvatarFallback>
          {message.sender.username?.[0]?.toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex flex-col max-w-[70%]", isSent ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2",
            isSent
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          )}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

          {message.link_url && articlePreview && (
            <div 
              className="mt-2 border border-border/50 rounded-xl overflow-hidden hover:border-accent/50 transition-all cursor-pointer group"
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
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary">
                        {articlePreview.author_username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold">
                        {articlePreview.author_name || articlePreview.author_username}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{articlePreview.author_username}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-1.5 text-xs opacity-70 mb-1">
                  <span>{getHostnameFromUrl(message.link_url)}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                {/* Show full tweet content or article title */}
                {articlePreview.content && articlePreview.platform === 'twitter' ? (
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">
                    {articlePreview.content}
                  </p>
                ) : (
                  <div className="font-semibold text-xs line-clamp-2 group-hover:text-accent transition-colors">
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

        <span className="text-xs text-muted-foreground mt-1 px-1">
          {formatDistanceToNow(new Date(message.created_at), {
            addSuffix: true,
            locale: it
          })}
        </span>
      </div>
    </div>
  );
});

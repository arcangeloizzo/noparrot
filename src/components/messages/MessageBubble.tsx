import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Message } from "@/hooks/useMessages";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  const { user } = useAuth();
  const isSent = message.sender_id === user?.id;

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

          {message.link_url && (
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
                      className="max-w-full h-auto rounded-lg"
                    />
                  ) : (
                    <video
                      src={media.url}
                      controls
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
};

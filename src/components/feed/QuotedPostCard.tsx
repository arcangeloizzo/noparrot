import { ExternalLink } from "lucide-react";
import { cn, getDisplayUsername } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface QuotedPost {
  id: string;
  content: string;
  created_at: string;
  shared_url?: string | null;
  shared_title?: string | null;
  preview_img?: string | null;
  author: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface QuotedPostCardProps {
  quotedPost: QuotedPost;
}

const getHostnameFromUrl = (url: string | undefined): string => {
  if (!url) return 'Fonte';
  try {
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    return new URL(urlWithProtocol).hostname;
  } catch {
    return 'Fonte';
  }
};

export const QuotedPostCard = ({ quotedPost }: QuotedPostCardProps) => {
  const getAvatarContent = () => {
    if (quotedPost.author.avatar_url) {
      return (
        <img 
          src={quotedPost.author.avatar_url}
          alt={quotedPost.author.full_name || quotedPost.author.username}
          className="w-full h-full object-cover"
        />
      );
    }
    
    const initial = (quotedPost.author.full_name || quotedPost.author.username).charAt(0).toUpperCase();
    const bgColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500'];
    const colorIndex = quotedPost.author.username.charCodeAt(0) % bgColors.length;
    
    return (
      <div className={`${bgColors[colorIndex]} w-full h-full flex items-center justify-center text-white font-bold text-sm`}>
        {initial}
      </div>
    );
  };

  const timeAgo = formatDistanceToNow(new Date(quotedPost.created_at), {
    addSuffix: true,
    locale: it 
  });

  // Truncate content to 280 characters
  const truncatedContent = quotedPost.content.length > 280 
    ? quotedPost.content.substring(0, 280) + '...' 
    : quotedPost.content;

  return (
    <div className="border border-border rounded-xl p-3 mt-3 bg-muted/30">
      <div className="flex gap-2">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-6 h-6 rounded-full overflow-hidden bg-muted">
            {getAvatarContent()}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1 mb-1">
            <span className="font-semibold text-foreground text-xs">
              {quotedPost.author.full_name || getDisplayUsername(quotedPost.author.username)}
            </span>
            <span className="text-muted-foreground text-xs">
              @{getDisplayUsername(quotedPost.author.username)}
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-muted-foreground text-xs">
              {timeAgo}
            </span>
          </div>

          {/* Truncated Comment */}
          <div className="mb-2 text-foreground text-xs leading-normal whitespace-pre-wrap break-words">
            {truncatedContent}
          </div>

          {/* Article Preview (if exists) */}
          {quotedPost.shared_url && (
            <div 
              className="border border-border rounded-lg overflow-hidden bg-background/50 cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation();
                window.open(quotedPost.shared_url!, '_blank', 'noopener,noreferrer');
              }}
            >
              {quotedPost.preview_img && (
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  <img 
                    src={quotedPost.preview_img}
                    alt={quotedPost.shared_title || ''}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                  <span>{getHostnameFromUrl(quotedPost.shared_url)}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </div>
                <div className="font-medium text-xs text-foreground line-clamp-1">
                  {quotedPost.shared_title}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

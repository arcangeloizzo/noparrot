import { ExternalLink } from "lucide-react";
import { cn, getDisplayUsername } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { normalizeUrl } from "@/lib/url";

interface QuotedPost {
  id: string;
  content: string;
  created_at: string;
  shared_url?: string | null;
  shared_title?: string | null;
  preview_img?: string | null;
  sources?: string[];
  is_intent?: boolean;
  author: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface QuotedPostCardProps {
  quotedPost: QuotedPost;
  parentSources?: string[];
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

export const QuotedPostCard = ({ quotedPost, parentSources = [] }: QuotedPostCardProps) => {
  // Deduplicare tutte le fonti del quoted post contro quelle del post principale
  const quotedSources = quotedPost.shared_url 
    ? [quotedPost.shared_url, ...(quotedPost.sources || [])]
    : (quotedPost.sources || []);
  
  const uniqueQuotedSources = quotedSources.filter(src => 
    !parentSources.some(ps => normalizeUrl(ps) === normalizeUrl(src))
  );
  
  const shouldShowSource = quotedPost.shared_url && uniqueQuotedSources.includes(quotedPost.shared_url);
  
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

  const timeAgo = quotedPost.created_at 
    ? formatDistanceToNow(new Date(quotedPost.created_at), {
        addSuffix: true,
        locale: it 
      })
    : 'poco fa';

  // Truncate content for standard posts
  const truncatedContent = quotedPost.content.length > 280 
    ? quotedPost.content.substring(0, 280) + '...' 
    : quotedPost.content;

  // INTENT POST LAYOUT: Testo protagonista, link secondario - NoParrot blue with urban texture
  if (quotedPost.is_intent) {
    return (
      <div className="relative border border-white/10 rounded-xl p-3 mt-3 overflow-hidden">
        {/* NoParrot blue gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1F3347] via-[#172635] to-[#0E1A24]" />
        
        {/* Urban texture overlay */}
        <div 
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
        
        {/* Content layer */}
        <div className="relative z-10">
          {/* Header Autore */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex-shrink-0">
              {getAvatarContent()}
            </div>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-white text-sm">
                {quotedPost.author.full_name || getDisplayUsername(quotedPost.author.username)}
              </span>
              <span className="text-white/50 text-xs">·</span>
              <span className="text-white/50 text-xs">{timeAgo}</span>
            </div>
          </div>

          {/* PROTAGONISTA: Testo utente con Quote Block style */}
          <div className="border-l-4 border-primary/60 bg-white/5 pl-3 py-2 rounded-r-lg mb-3">
            <p className="text-white text-sm leading-relaxed line-clamp-4 whitespace-pre-wrap">
              {quotedPost.content}
            </p>
          </div>

          {/* SECONDARIO: Link card compatta (se presente) */}
          {quotedPost.shared_url && (
            <div 
              className="flex items-center gap-2 p-2 bg-white/10 rounded-lg cursor-pointer hover:bg-white/15 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                window.open(quotedPost.shared_url!, '_blank', 'noopener,noreferrer');
              }}
            >
              <ExternalLink className="w-4 h-4 text-white/60 flex-shrink-0" />
              <span className="text-xs text-white/60 truncate">
                {getHostnameFromUrl(quotedPost.shared_url)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STANDARD POST LAYOUT (unchanged)
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
          {shouldShowSource && (
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

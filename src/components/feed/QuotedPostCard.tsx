import { memo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { getDisplayUsername } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { normalizeUrl } from "@/lib/url";
import { MediaGallery } from "@/components/media/MediaGallery";
import { FullTextModal } from "./FullTextModal";

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
  // Media carousel support
  media?: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail_url?: string | null;
  }>;
}

interface QuotedPostCardProps {
  quotedPost: QuotedPost;
  parentSources?: string[];
  onNavigate?: () => void;
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

// Media in quoted posts should look identical to original posts.
// We reuse the main MediaGallery carousel (full-width, swipe, counter, dots)
// but provide a noop onClick to prevent navigation when interacting with media.
const QuotedMediaCarousel = ({
  media,
  variant,
}: {
  media?: QuotedPost["media"];
  variant: "intent" | "standard";
}) => {
  if (!media || media.length === 0) return null;

  // Ensure compatibility with MediaGallery prop types (thumbnail_url: string | undefined)
  const normalizedMedia = media.map((m) => ({
    ...m,
    thumbnail_url: m.thumbnail_url ?? undefined,
  }));

  return (
    <div className={variant === "standard" ? "mt-2" : "mt-2"}>
      <MediaGallery media={normalizedMedia} onClick={() => {}} />
    </div>
  );
};

const QuotedPostCardInner = ({ quotedPost, parentSources = [], onNavigate }: QuotedPostCardProps) => {
  const [showFullText, setShowFullText] = useState(false);
  
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

  // Check if content needs truncation
  const needsTruncation = quotedPost.content.length > 280;
  const truncatedContent = needsTruncation 
    ? quotedPost.content.substring(0, 280) + '...' 
    : quotedPost.content;

  // Full text modal component (shared between both layouts)
  const fullTextModal = (
    <FullTextModal
      isOpen={showFullText}
      onClose={() => setShowFullText(false)}
      content={quotedPost.content}
      author={{
        name: quotedPost.author.full_name || quotedPost.author.username,
        username: quotedPost.author.username,
        avatar: quotedPost.author.avatar_url,
      }}
      variant="quoted"
    />
  );

  // INTENT POST LAYOUT: Testo protagonista, link secondario - NoParrot blue with urban texture
  if (quotedPost.is_intent) {
    return (
      <>
        <div 
          className="relative border border-white/10 rounded-xl p-3 mt-3 overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate?.();
          }}
        >
          {/* NoParrot blue gradient background */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#1F3347] via-[#172635] to-[#0E1A24]" />
          
          {/* Urban texture overlay - GPU optimized */}
          <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none urban-noise-overlay" />
          
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
              {quotedPost.content.length > 200 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                  className="mt-2 text-xs text-primary font-semibold hover:underline"
                >
                  Mostra tutto
                </button>
              )}
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

            {/* Media Carousel - Full-width like original post */}
            <QuotedMediaCarousel media={quotedPost.media} variant="intent" />
          </div>
        </div>
        {fullTextModal}
      </>
    );
  }

  // STANDARD POST LAYOUT
  return (
    <>
      <div 
        className="border border-border rounded-xl p-3 mt-3 bg-muted/30 cursor-pointer active:scale-[0.98] transition-transform"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate?.();
        }}
      >
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
            <div className="mb-2">
              <div className="text-foreground text-xs leading-normal whitespace-pre-wrap break-words">
                {truncatedContent}
              </div>
              {needsTruncation && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                  className="mt-1 text-xs text-primary font-semibold hover:underline"
                >
                  Mostra tutto
                </button>
              )}
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
                  <div className="max-h-[30vh] w-full overflow-hidden bg-muted">
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

            {/* Media Carousel - Full-width like original post */}
            <QuotedMediaCarousel media={quotedPost.media} variant="standard" />
          </div>
        </div>
      </div>
      {fullTextModal}
    </>
  );
};

// Memoize to avoid unnecessary rerenders in feed list
export const QuotedPostCard = memo(QuotedPostCardInner);
QuotedPostCard.displayName = 'QuotedPostCard';

import { memo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn, getDisplayUsername } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { normalizeUrl } from "@/lib/url";
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
  className?: string; // Allow custom styling/constraints from parent
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

const QuotedPostCardInner = ({ quotedPost, parentSources = [], onNavigate, className }: QuotedPostCardProps) => {
  const [showFullText, setShowFullText] = useState(false);

  // Check if quotedPost exists
  if (!quotedPost) return null;

  // Safe author fallback
  // Safe author fallback with debug
  const safeAuthor = quotedPost.author || (() => {
    console.warn("QuotedPostCard: Missing author for post", quotedPost.id, quotedPost);
    return {
      username: "unknown",
      full_name: "Utente sconosciuto",
      avatar_url: null
    };
  })();

  // Deduplicare tutte le fonti del quoted post contro quelle del post principale
  const quotedSources = quotedPost.shared_url
    ? [quotedPost.shared_url, ...(quotedPost.sources || [])]
    : (quotedPost.sources || []);

  const uniqueQuotedSources = quotedSources.filter(src =>
    !parentSources.some(ps => normalizeUrl(ps) === normalizeUrl(src))
  );

  const shouldShowSource = quotedPost.shared_url && uniqueQuotedSources.includes(quotedPost.shared_url);

  const getAvatarContent = () => {
    if (safeAuthor.avatar_url) {
      return (
        <img
          src={safeAuthor.avatar_url}
          alt={safeAuthor.full_name || safeAuthor.username}
          className="w-full h-full object-cover"
        />
      );
    }

    const initial = (safeAuthor.full_name || safeAuthor.username).charAt(0).toUpperCase();

    return (
      <div className={`w-full h-full flex items-center justify-center text-white font-bold text-sm bg-primary/20`}>
        <span className="text-primary">{initial}</span>
      </div>
    );
  };

  const timeAgo = quotedPost.created_at && !isNaN(new Date(quotedPost.created_at).getTime())
    ? formatDistanceToNow(new Date(quotedPost.created_at), {
      addSuffix: true,
      locale: it
    })
    : 'poco fa';

  // Check if content needs truncation
  const content = quotedPost.content || "";
  const needsTruncation = content.length > 280;
  const truncatedContent = needsTruncation
    ? content.substring(0, 280) + '...'
    : content;

  // Full text modal component (shared between both layouts)
  const fullTextModal = (
    <FullTextModal
      isOpen={showFullText}
      onClose={() => setShowFullText(false)}
      content={quotedPost.content}
      author={{
        name: safeAuthor.full_name || safeAuthor.username,
        username: safeAuthor.username,
        avatar: safeAuthor.avatar_url,
      }}
      variant="quoted"
    />
  );

  // INTENT POST OR EDITORIAL (Il Punto) LAYOUT
  // Force "Il Punto" to use this layout if it's not already caught
  const isIlPunto = safeAuthor.username === 'ilpunto' || safeAuthor.username === 'npe_ilpunto';

  if (quotedPost.is_intent || isIlPunto) {
    return (
      <>
        <div
          className={cn(
            "relative border border-white/10 rounded-xl p-3 mt-3 overflow-hidden cursor-pointer active:scale-[0.98] transition-transform",
            className
          )}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate?.();
          }}
        >
          {/* NoParrot blue gradient - Dark Mode */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#1F3347] via-[#172635] to-[#0E1A24] hidden dark:block" />

          {/* Light Mode: White/Slate Clean Look */}
          <div className="absolute inset-0 bg-slate-50 border border-slate-200 dark:hidden" />

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
                <span className="font-semibold text-slate-900 dark:text-white text-sm">
                  {safeAuthor.full_name || getDisplayUsername(safeAuthor.username)}
                </span>
                <span className="text-slate-500 dark:text-white/50 text-xs">·</span>
                <span className="text-slate-500 dark:text-white/50 text-xs">{timeAgo}</span>
              </div>
            </div>

            {/* PROTAGONISTA: Testo utente con Quote Block style */}
            <div className="border-l-4 border-primary/60 bg-white dark:bg-white/5 pl-3 py-2 rounded-r-lg mb-3 shadow-sm dark:shadow-none border-y border-r border-slate-200 dark:border-transparent">
              <p className="text-slate-900 dark:text-white text-sm leading-relaxed line-clamp-3 sm:line-clamp-4 whitespace-pre-wrap font-medium">
                {content}
              </p>
              {content.length > 200 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                  className="mt-2 text-xs text-primary font-semibold hover:underline"
                >
                  Mostra tutto
                </button>
              )}
            </div>

            {/* SECONDARIO: Link card compatta (se presente) */}
            {/* SECONDARIO: Link card ricca ma senza immagine (stile Intent) */}
            {quotedPost.shared_url && (
              <div
                className="mt-3 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden cursor-pointer hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm dark:shadow-none"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(quotedPost.shared_url!, '_blank', 'noopener,noreferrer');
                }}
              >
                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/50 font-bold">
                      {getHostnameFromUrl(quotedPost.shared_url)}
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400 dark:text-white/40" />
                  </div>
                  <h3 className="text-slate-900 dark:text-white font-medium text-sm leading-snug line-clamp-2">
                    {quotedPost.shared_title || quotedPost.shared_url}
                  </h3>
                </div>
              </div>
            )}

            {/* Media Gallery (Intent layout) */}
            {quotedPost.media && quotedPost.media.length > 0 && (
              <div className="mt-2 rounded-lg overflow-hidden">
                {quotedPost.media.length === 1 ? (
                  quotedPost.media[0].type === 'video' ? (
                    <video
                      src={quotedPost.media[0].url}
                      poster={quotedPost.media[0].thumbnail_url || undefined}
                      className="w-full max-h-32 object-cover rounded-lg"
                    />
                  ) : (
                    <img
                      src={quotedPost.media[0].url}
                      alt=""
                      className="w-full max-h-32 object-cover rounded-lg"
                    />
                  )
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    {quotedPost.media.slice(0, 4).map((m, idx) => (
                      <div key={m.id} className="relative aspect-square rounded-lg overflow-hidden bg-white/10">
                        {m.type === 'video' ? (
                          <video
                            src={m.url}
                            poster={m.thumbnail_url || undefined}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={m.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                        {idx === 3 && quotedPost.media!.length > 4 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">
                              +{quotedPost.media!.length - 4}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
        className={cn(
          "border border-slate-200 dark:border-border/60 rounded-xl p-3 mt-3 bg-white dark:bg-muted/30 cursor-pointer active:scale-[0.98] transition-all hover:bg-slate-50 dark:hover:bg-muted/50 shadow-sm dark:shadow-none",
          className
        )}
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
              <span className="font-semibold text-slate-900 dark:text-white text-xs">
                {safeAuthor.full_name || getDisplayUsername(safeAuthor.username)}
              </span>
              <span className="text-slate-500 dark:text-gray-400 text-xs">
                @{getDisplayUsername(safeAuthor.username)}
              </span>
              <span className="text-slate-400 dark:text-gray-400 text-xs">·</span>
              <span className="text-slate-500 dark:text-gray-400 text-xs">
                {timeAgo}
              </span>
            </div>

            {/* Truncated Comment */}
            <div className="mb-2">
              <div className="text-slate-900 dark:text-white/90 text-xs leading-normal whitespace-pre-wrap line-clamp-3 sm:line-clamp-4 break-words font-medium">
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
                  <div className="aspect-video w-full overflow-hidden bg-slate-100 dark:bg-muted">
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

            {/* Media Gallery (Standard layout) */}
            {quotedPost.media && quotedPost.media.length > 0 && (
              <div className="mt-2 rounded-lg overflow-hidden">
                {quotedPost.media.length === 1 ? (
                  quotedPost.media[0].type === 'video' ? (
                    <video
                      src={quotedPost.media[0].url}
                      poster={quotedPost.media[0].thumbnail_url || undefined}
                      className="w-full max-h-32 object-cover rounded-lg"
                    />
                  ) : (
                    <img
                      src={quotedPost.media[0].url}
                      alt=""
                      className="w-full max-h-32 object-cover rounded-lg"
                    />
                  )
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    {quotedPost.media.slice(0, 4).map((m, idx) => (
                      <div key={m.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-muted">
                        {m.type === 'video' ? (
                          <video
                            src={m.url}
                            poster={m.thumbnail_url || undefined}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={m.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                        {idx === 3 && quotedPost.media!.length > 4 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">
                              +{quotedPost.media!.length - 4}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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

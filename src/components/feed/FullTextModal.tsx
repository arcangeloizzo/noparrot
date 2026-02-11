import { memo } from "react";
import { Heart, MessageCircle, Bookmark, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Logo } from "@/components/ui/logo";
import { MentionText } from "./MentionText";

export interface FullTextModalAuthor {
  name: string;
  username?: string;
  avatar?: string | null;
}

export interface FullTextModalSource {
  hostname?: string;
  url?: string;
}

interface FullTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  author?: FullTextModalAuthor;
  source?: FullTextModalSource;
  variant?: 'post' | 'caption' | 'editorial' | 'quoted';
  /** Post data for action bar */
  post?: {
    id: string;
    reactions?: { hearts?: number; comments?: number };
    user_reactions?: { has_hearted?: boolean; has_bookmarked?: boolean };
    shares_count?: number;
  };
  /** Action handlers */
  actions?: {
    onHeart?: (e: React.MouseEvent) => void;
    onComment?: () => void;
    onBookmark?: (e: React.MouseEvent) => void;
    onShare?: () => void;
  };
}

const FullTextModalInner = ({
  isOpen,
  onClose,
  content,
  author,
  source,
  variant = 'post',
  post,
  actions,
}: FullTextModalProps) => {
  const isCaption = variant === 'caption';
  const isEditorial = variant === 'editorial';

  // Render header based on variant
  const renderHeader = () => {
    if (isCaption && source) {
      return (
        <div className="relative z-10 px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500/40 via-purple-500/40 to-orange-500/40 flex items-center justify-center border border-white/20 dark:border-white/20">
              <ExternalLink className="w-4 h-4 text-white/80" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-foreground text-sm">
                {source.hostname || 'Fonte esterna'}
              </span>
              <span className="text-xs text-muted-foreground">
                Contenuto esterno
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (author) {
      return (
        <div className="relative z-10 px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            {author.avatar ? (
              <img
                src={author.avatar}
                alt=""
                className="w-10 h-10 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center border border-border">
                <span className="text-primary-foreground font-semibold text-sm">
                  {author.name?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-foreground text-sm">
                {author.name}
              </span>
              {author.username && (
                <span className="text-xs text-muted-foreground">
                  @{author.username}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // Render content with paragraph breaks
  const renderContent = () => {
    const paragraphs = (content || "").split(/\n\n+/);
    return paragraphs.map((paragraph, idx) => (
      <div key={idx} className={cn(idx > 0 && "mt-5")}>
        <p className="text-[16px] sm:text-[17px] font-normal text-foreground leading-[1.7] tracking-[0.01em] whitespace-pre-wrap">
          <MentionText content={paragraph} />
        </p>
        {idx < paragraphs.length - 1 && (
          <div className="mt-5 h-px bg-border" />
        )}
      </div>
    ));
  };

  // Render action bar if post and actions are provided
  const renderActionBar = () => {
    if (!post || !actions) return null;

    return (
      <div className="mt-8 pt-6 border-t border-white/[0.08]">
        <div className="flex items-center justify-between gap-3">
          {/* Primary Share Button */}
          {actions.onShare && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                actions.onShare?.();
              }}
              className="h-10 px-4 bg-blue-50 hover:bg-blue-100 dark:bg-white dark:hover:bg-gray-200 text-blue-600 dark:text-[#1F3347] font-bold rounded-2xl shadow-sm dark:shadow-md border border-blue-100 dark:border-transparent flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Logo variant="icon" size="sm" className="h-4 w-4" />
              <span className="text-sm font-semibold leading-none">Condividi</span>
              {(post.shares_count ?? 0) > 0 && (
                <span className="text-xs opacity-70">({post.shares_count})</span>
              )}
            </button>
          )}

          {/* Reactions */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-black/20 h-10 px-3 rounded-2xl border border-slate-200 dark:border-white/5">
            {actions.onHeart && (
              <button
                className="flex items-center justify-center gap-1.5 h-full px-2"
                onClick={(e) => { e.stopPropagation(); actions.onHeart?.(e); }}
              >
                <Heart
                  className={cn("w-5 h-5 transition-transform active:scale-90", post.user_reactions?.has_hearted ? "text-red-500 fill-red-500" : "text-slate-500 dark:text-white")}
                  fill={post.user_reactions?.has_hearted ? "currentColor" : "none"}
                />
                <span className="text-xs font-bold text-slate-700 dark:text-white">{post.reactions?.hearts || 0}</span>
              </button>
            )}

            {actions.onComment && (
              <button
                className="flex items-center justify-center gap-1.5 h-full px-2"
                onClick={(e) => { e.stopPropagation(); onClose(); setTimeout(() => actions.onComment?.(), 100); }}
              >
                <MessageCircle className="w-5 h-5 text-slate-500 dark:text-white transition-transform active:scale-90" />
                <span className="text-xs font-bold text-slate-700 dark:text-white">{post.reactions?.comments || 0}</span>
              </button>
            )}

            {actions.onBookmark && (
              <button
                className="flex items-center justify-center h-full px-2"
                onClick={(e) => { e.stopPropagation(); actions.onBookmark?.(e); }}
              >
                <Bookmark
                  className={cn("w-5 h-5 transition-transform active:scale-90", post.user_reactions?.has_bookmarked ? "text-blue-400 fill-blue-400" : "text-slate-500 dark:text-white")}
                  fill={post.user_reactions?.has_bookmarked ? "currentColor" : "none"}
                />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // External link button for caption variant
  const renderExternalLink = () => {
    if (!isCaption || !source?.url) return null;

    return (
      <div className="mt-6 pt-4 border-t border-white/[0.08]">
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.open(source.url, '_blank', 'noopener,noreferrer');
          }}
          className="w-full py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 text-white/90 font-medium text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Apri su {source.hostname || 'sito esterno'}
        </button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] max-w-lg p-0 border-0 shadow-none overflow-hidden bg-background dark:bg-gradient-to-br dark:from-[#1F3347] dark:to-[#0f1a24] rounded-3xl border border-border dark:border-white/10 shadow-2xl dark:shadow-[0_20px_60px_rgba(0,0,0,0.7),_0_0_40px_rgba(31,51,71,0.4)] [&>button]:z-20 [&>button]:text-foreground dark:[&>button]:text-white [&>button]:opacity-90 [&>button]:hover:opacity-100 [&>button]:bg-muted dark:[&>button]:bg-white/15 [&>button]:rounded-full [&>button]:p-1.5 [&>button]:w-8 [&>button]:h-8">
        {/* Urban texture overlay - GPU optimized */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay urban-noise-overlay rounded-3xl" />

        {/* Header */}
        {renderHeader()}

        {/* Scrollable content area */}
        <div className="relative px-6 py-5 max-h-[55vh] overflow-y-auto no-scrollbar">
          {renderContent()}

          {/* External link for caption variant */}
          {renderExternalLink()}

          {/* Action bar */}
          {renderActionBar()}

          {/* Footer CTA */}
          <div className="mt-6">
            <button
              onClick={() => onClose()}
              className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.12] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white/90 font-medium text-sm transition-all active:scale-[0.98]"
            >
              Torna al feed
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const FullTextModal = memo(FullTextModalInner);
FullTextModal.displayName = 'FullTextModal';

import { memo, useRef, useState, useCallback, useEffect } from "react";
import { Heart, MessageCircle, Bookmark, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
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
  title?: string;
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
  title,
  author,
  source,
  variant = 'post',
  post,
  actions,
}: FullTextModalProps) => {
  const isCaption = variant === 'caption';
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const touchStartY = useRef(0);
  const scrollTopAtStart = useRef(0);
  const isDraggingRef = useRef(false);
  const dragYRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setDragY(0);
      setIsClosing(false);
      isDraggingRef.current = false;
      dragYRef.current = 0;
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setDragY(0);
      isDraggingRef.current = false;
      dragYRef.current = 0;
    }, 250);
  }, [onClose]);

  // Use native event listeners with { passive: false } so e.preventDefault() works
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !isOpen) return;

    const scrollArea = el.querySelector('.sheet-scroll-area') as HTMLElement;

    const onTouchStart = (e: TouchEvent) => {
      scrollTopAtStart.current = scrollArea?.scrollTop || 0;
      touchStartY.current = e.touches[0].clientY;
      isDraggingRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      const deltaY = e.touches[0].clientY - touchStartY.current;
      const isAtTop = !scrollArea || scrollArea.scrollTop <= 0;

      if (deltaY > 0 && isAtTop && scrollTopAtStart.current <= 0) {
        e.preventDefault();
        isDraggingRef.current = true;
        setIsDragging(true);
        const dampened = deltaY > 50 ? 50 + (deltaY - 50) * 0.4 : deltaY;
        dragYRef.current = dampened;
        setDragY(dampened);
      } else if (isDraggingRef.current && deltaY > 0) {
        e.preventDefault();
        const dampened = deltaY > 50 ? 50 + (deltaY - 50) * 0.4 : deltaY;
        dragYRef.current = dampened;
        setDragY(dampened);
      }
    };

    const onTouchEnd = () => {
      if (!isDraggingRef.current) return;
      
      if (dragYRef.current > 100) {
        handleClose();
      } else {
        setDragY(0);
        dragYRef.current = 0;
      }
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [isOpen, handleClose]);

  if (!isOpen && !isClosing) return null;

  // Render header based on variant
  const renderHeader = () => {
    if (isCaption && source) {
      return (
        <div className="flex items-center justify-between mb-4 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500/40 via-purple-500/40 to-orange-500/40 flex items-center justify-center border border-white/20">
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
          <button 
            onClick={handleClose}
            className="w-[28px] h-[28px] flex items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>
      );
    }

    if (author) {
      return (
        <div className="flex items-center justify-between mb-4 mt-2">
          <div className="flex items-center gap-2">
            {author.avatar ? (
              <img
                src={author.avatar}
                alt=""
                className="w-[26px] h-[26px] rounded-full object-cover border border-border"
              />
            ) : (
              <div className="w-[26px] h-[26px] rounded-full bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center border border-border">
                <span className="text-primary-foreground font-semibold text-[10px]">
                  {author.name?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
            <div className="flex items-baseline gap-1" style={{ fontFamily: 'Inter, sans-serif' }}>
              <span className="text-[12px] font-bold text-white">
                {author.name}
              </span>
              {author.username && (
                <span className="text-[11px] text-white/50">
                  @{author.username}
                </span>
              )}
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="w-[28px] h-[28px] flex items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex justify-end mb-2 mt-2">
        <button 
          onClick={handleClose}
          className="w-[28px] h-[28px] flex items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          <X className="w-4 h-4 text-white/70" />
        </button>
      </div>
    );
  };

  // Render content with paragraph breaks — COMPLETE, no truncation
  const renderContent = () => {
    const paragraphs = (content || "").split(/\n\n+/);
    return (
      <div className="flex flex-col gap-2">
        {title && title.trim().length > 0 && (
          <h2 
            className="uppercase mb-4"
            style={{
              fontFamily: 'Impact, sans-serif',
              fontSize: '18px',
              lineHeight: 1.2,
              color: '#FFFFFF',
              margin: '0 0 16px 0',
            }}
          >
            {title}
          </h2>
        )}
        <div className="flex flex-col">
          {paragraphs.map((paragraph, idx) => (
            <div key={idx} className={cn(idx > 0 && "mt-5")}>
              <p
                className="font-normal leading-[1.55] tracking-[0.01em] whitespace-pre-wrap"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '15px',
                  color: 'rgba(255, 255, 255, 0.8)',
                }}
              >
                <MentionText content={paragraph} />
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render action bar
  const renderActionBar = () => {
    if (!post || !actions) return null;

    return (
      <div className="mt-8 pt-6 border-t border-white/[0.08]">
        <div className="flex items-center justify-between gap-3">
          {actions.onShare && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
                setTimeout(() => actions.onShare?.(), 300);
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
                onClick={(e) => { e.stopPropagation(); handleClose(); setTimeout(() => actions.onComment?.(), 300); }}
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

  const sheetTransform = isClosing 
    ? 'translateY(100%)' 
    : isDragging 
      ? `translateY(${dragY}px)` 
      : 'translateY(0)';
  
  const sheetTransition = isDragging ? 'none' : 'transform 250ms ease-out';

  return (
    <>
      {/* Overlay backdrop */}
      <div 
        className="fixed inset-0 z-50" 
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          opacity: isClosing ? 0 : isDragging ? Math.max(0.3, 1 - dragY / 300) : 1,
          transition: isDragging ? 'none' : 'opacity 250ms ease-out',
        }} 
        onClick={handleClose} 
      />

      {/* Bottom sheet */}
      <div 
        ref={sheetRef}
        className="fixed left-0 right-0 bottom-0 z-[51] flex flex-col"
        style={{
          backgroundColor: '#111d2e',
          borderRadius: '16px 16px 0 0',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          maxHeight: '85vh',
          transform: sheetTransform,
          transition: sheetTransition,
          willChange: 'transform',
        }}
      >
        <div className="sheet-scroll-area flex-1 overflow-y-auto px-5 pb-6">
          {/* 1. Handle */}
          <div 
            style={{
              width: '36px', height: '4px', backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: '2px', margin: '10px auto 8px',
              cursor: 'grab',
            }}
          />

          {/* 2. Header */}
          {renderHeader()}

          {/* Content */}
          {renderContent()}

          {/* External link for caption variant */}
          {renderExternalLink()}

          {/* Action bar */}
          {renderActionBar()}

          {/* Padding bottom for safe area */}
          <div style={{ height: 'calc(24px + env(safe-area-inset-bottom, 0px))' }} />
        </div>
      </div>
    </>
  );
};

export const FullTextModal = memo(FullTextModalInner);
FullTextModal.displayName = 'FullTextModal';

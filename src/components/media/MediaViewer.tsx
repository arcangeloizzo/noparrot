import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Heart, MessageCircle, Bookmark } from 'lucide-react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { useMediaReactions, useToggleMediaReaction } from '@/hooks/useMediaReactions';
import { MediaCommentsSheet } from './MediaCommentsSheet';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { Logo } from '@/components/ui/logo';

interface Media {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

interface PostActions {
  onShare?: () => void;
  onHeart?: () => void;
  onComment?: () => void;
  onBookmark?: () => void;
  hasHearted?: boolean;
  hasBookmarked?: boolean;
  heartsCount?: number;
  commentsCount?: number;
  sharesCount?: number;
}

interface MediaViewerProps {
  media: Media[];
  initialIndex?: number;
  onClose: (finalIndex?: number) => void;
  postActions?: PostActions;
}

export const MediaViewer = ({ media, initialIndex = 0, onClose, postActions }: MediaViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showComments, setShowComments] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  
  // Restore scroll on close
  useEffect(() => {
    const scrollY = window.scrollY;
    sessionStorage.setItem('feed-scroll', scrollY.toString());
    return () => {
      const savedScroll = sessionStorage.getItem('feed-scroll');
      if (savedScroll) {
        setTimeout(() => window.scrollTo(0, parseInt(savedScroll)), 50);
        sessionStorage.removeItem('feed-scroll');
      }
    };
  }, []);

  // Lock body scroll when viewer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Scroll to initial index on mount
  useEffect(() => {
    if (scrollRef.current && media.length > 1) {
      const slideWidth = scrollRef.current.offsetWidth;
      scrollRef.current.scrollTo({
        left: initialIndex * slideWidth,
        behavior: 'auto'
      });
    }
  }, []);
  
  const currentMedia = media[currentIndex];
  const { data: reactions } = useMediaReactions(currentMedia.id);
  const toggleReaction = useToggleMediaReaction();
  const isMultiple = media.length > 1;

  const scrollToIndex = useCallback((index: number) => {
    if (!scrollRef.current) return;
    isScrolling.current = true;
    const slideWidth = scrollRef.current.offsetWidth;
    scrollRef.current.scrollTo({
      left: index * slideWidth,
      behavior: 'smooth'
    });
    setTimeout(() => {
      isScrolling.current = false;
    }, 300);
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !isMultiple || isScrolling.current) return;
    
    const slideWidth = scrollRef.current.offsetWidth;
    const scrollLeft = scrollRef.current.scrollLeft;
    const newIndex = Math.round(scrollLeft / slideWidth);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < media.length) {
      setCurrentIndex(newIndex);
      setIsZoomed(false);
      transformRef.current?.resetTransform();
    }
  }, [currentIndex, isMultiple, media.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only track for swipe-down-to-close when not zoomed
    if (e.touches.length === 1 && !isZoomed) {
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || isZoomed) return;
    
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const deltaY = touchEnd.y - touchStart.y;
    const deltaX = touchEnd.x - touchStart.x;
    
    // Swipe down to close (only when not zoomed and not horizontal swipe)
    if (deltaY > 100 && Math.abs(deltaX) < 50) {
      haptics.light();
      onClose(currentIndex);
    }
    
    setTouchStart(null);
  };

  const handleTransformChange = (ref: ReactZoomPanPinchRef) => {
    setIsZoomed(ref.state.scale > 1.05);
  };

  // Legacy media-level like (used when no postActions provided)
  const handleMediaLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.light();
    toggleReaction.mutate({
      mediaId: currentMedia.id,
      isLiked: reactions?.likedByMe || false
    });
  };

  const handleCommentsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (postActions?.onComment) {
      postActions.onComment();
    } else {
      setShowComments(true);
    }
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.light();
    postActions?.onShare?.();
  };

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.light();
    if (postActions?.onHeart) {
      postActions.onHeart();
    } else {
      handleMediaLike(e);
    }
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.light();
    postActions?.onBookmark?.();
  };

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
    scrollToIndex(index);
  };

  // Determine display values based on mode
  const usePostActions = !!postActions;
  const hasHearted = usePostActions ? postActions.hasHearted : reactions?.likedByMe;
  const heartsCount = usePostActions ? (postActions.heartsCount ?? 0) : (reactions?.likesCount ?? 0);
  const commentsCount = usePostActions ? (postActions.commentsCount ?? 0) : 0;
  const hasBookmarked = postActions?.hasBookmarked ?? false;
  const sharesCount = postActions?.sharesCount ?? 0;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black z-50 flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20 safe-area-inset-top">
          <button
            onClick={() => onClose(currentIndex)}
            className="p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          {isMultiple && (
            <span className="text-white text-sm bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
              {currentIndex + 1} / {media.length}
            </span>
          )}
        </div>

        {/* Media Content - Horizontal Carousel */}
        {isMultiple ? (
          <div className="flex-1 flex flex-col justify-center">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none h-[70vh]"
              style={{ 
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              {media.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex-shrink-0 w-full h-full snap-center flex items-center justify-center px-4"
                >
                  {item.type === 'image' ? (
                    <img
                      src={item.url}
                      alt=""
                      className="max-w-full max-h-full object-contain rounded-lg select-none"
                      draggable={false}
                      loading={idx <= currentIndex + 1 ? 'eager' : 'lazy'}
                    />
                  ) : (
                    <video
                      src={item.url}
                      poster={item.thumbnail_url}
                      controls
                      playsInline
                      autoPlay={idx === currentIndex}
                      className="max-w-full max-h-full rounded-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Il tuo browser non supporta il tag video.
                    </video>
                  )}
                </div>
              ))}
            </div>

            {/* Dots indicator */}
            <div className="flex justify-center gap-2 py-4">
              {media.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDotClick(idx)}
                  className={cn(
                    "rounded-full transition-all duration-200",
                    idx === currentIndex 
                      ? "bg-white w-6 h-2" 
                      : "bg-white/40 w-2 h-2 hover:bg-white/60"
                  )}
                  aria-label={`Vai a media ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        ) : (
          /* Single media: zoom support */
          <div className="flex-1 flex items-center justify-center relative">
            {currentMedia.type === 'image' ? (
              <TransformWrapper
                ref={transformRef}
                initialScale={1}
                minScale={1}
                maxScale={8}
                centerOnInit
                wheel={{ step: 0.2 }}
                doubleClick={{ mode: "toggle", step: 2.5 }}
                panning={{ velocityDisabled: true }}
                onTransformed={handleTransformChange}
              >
                <TransformComponent 
                  wrapperClass="w-full h-full" 
                  contentClass="w-full h-full flex items-center justify-center"
                >
                  <img
                    src={currentMedia.url}
                    alt=""
                    className="max-w-full max-h-full object-contain select-none"
                    draggable={false}
                  />
                </TransformComponent>
              </TransformWrapper>
            ) : (
              <video
                src={currentMedia.url}
                poster={currentMedia.thumbnail_url}
                controls
                playsInline
                autoPlay
                className="max-w-full max-h-full"
                onClick={(e) => e.stopPropagation()}
              >
                Il tuo browser non supporta il tag video.
              </video>
            )}

            {/* Zoom hint for single image */}
            {currentMedia.type === 'image' && (
              <div className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none z-10">
                <span className="text-white/40 text-xs bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full">
                  {isZoomed ? 'Doppio tap per resettare' : 'Pizzica o doppio tap per zoomare'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Swipe hint when not zoomed */}
        {!isZoomed && (
          <div className="absolute top-20 left-0 right-0 flex justify-center pointer-events-none z-10">
            <span className="text-white/30 text-xs">Scorri verso il basso per chiudere</span>
          </div>
        )}

        {/* Actions Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-10 safe-area-inset-bottom">
          <div className="flex items-center justify-between gap-6">
            
            {/* Primary Share Button - Pill shape (only show when postActions provided) */}
            {usePostActions && postActions.onShare && (
              <button 
                onClick={handleShareClick}
                className="h-11 px-5 bg-white hover:bg-gray-50 text-[#1F3347] font-bold rounded-full shadow-[0_0_30px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Logo variant="icon" size="sm" className="h-5 w-5" />
                <span className="text-sm font-semibold leading-none">Condividi</span>
                {sharesCount > 0 && (
                  <span className="text-xs opacity-70">({sharesCount})</span>
                )}
              </button>
            )}

            {/* Action Icons - Uniform w-6 h-6 */}
            <div 
              className={cn(
                "flex items-center gap-4 h-11",
                !usePostActions && "w-full justify-center"
              )}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              
              {/* Like */}
              <button 
                className="flex items-center justify-center gap-1.5 h-full select-none"
                onClick={handleHeartClick}
              >
                <Heart 
                  className={cn(
                    "w-6 h-6 transition-transform active:scale-90",
                    hasHearted ? "text-red-500 fill-red-500" : "text-white"
                  )}
                  fill={hasHearted ? "currentColor" : "none"}
                />
                {heartsCount > 0 && (
                  <span className="text-sm font-bold text-white select-none">{heartsCount}</span>
                )}
              </button>

              {/* Comments */}
              <button 
                className="flex items-center justify-center gap-1.5 h-full select-none"
                onClick={handleCommentsClick}
              >
                <MessageCircle className="w-6 h-6 text-white transition-transform active:scale-90" />
                {(usePostActions && commentsCount > 0) && (
                  <span className="text-sm font-bold text-white select-none">{commentsCount}</span>
                )}
                {!usePostActions && (
                  <span className="text-sm font-medium text-white">Commenta</span>
                )}
              </button>

              {/* Bookmark (only show when postActions provided) */}
              {usePostActions && postActions.onBookmark && (
                <button 
                  className="flex items-center justify-center h-full"
                  onClick={handleBookmarkClick}
                >
                  <Bookmark 
                    className={cn(
                      "w-6 h-6 transition-transform active:scale-90", 
                      hasBookmarked ? "text-blue-400 fill-blue-400" : "text-white"
                    )}
                    fill={hasBookmarked ? "currentColor" : "none"}
                  />
                </button>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Media Comments Sheet (only used in legacy mode) */}
      {showComments && !usePostActions && (
        <MediaCommentsSheet
          media={currentMedia}
          isOpen={showComments}
          onClose={() => setShowComments(false)}
        />
      )}
    </>
  );
};

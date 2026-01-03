import { useState, useEffect, useRef } from 'react';
import { X, Heart, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { useMediaReactions, useToggleMediaReaction } from '@/hooks/useMediaReactions';
import { MediaCommentsSheet } from './MediaCommentsSheet';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

interface Media {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

interface MediaViewerProps {
  media: Media[];
  initialIndex?: number;
  onClose: () => void;
}

export const MediaViewer = ({ media, initialIndex = 0, onClose }: MediaViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showComments, setShowComments] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  
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
  
  const currentMedia = media[currentIndex];
  const { data: reactions } = useMediaReactions(currentMedia.id);
  const toggleReaction = useToggleMediaReaction();

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsZoomed(false);
      transformRef.current?.resetTransform();
    }
  };

  const handleNext = () => {
    if (currentIndex < media.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsZoomed(false);
      transformRef.current?.resetTransform();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only track for swipe-down-to-close when not zoomed
    if (e.touches.length === 1 && !isZoomed) {
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || isZoomed) return;
    
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;
    
    // Swipe down to close (only when not zoomed)
    if (deltaY > 100 && Math.abs(deltaX) < 50) {
      haptics.light();
      onClose();
    }
    // Swipe left/right to navigate
    else if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 50) {
      if (deltaX > 0) {
        handlePrevious();
      } else {
        handleNext();
      }
    }
    
    setTouchStart(null);
  };

  const handleTransformChange = (ref: ReactZoomPanPinchRef) => {
    setIsZoomed(ref.state.scale > 1.05);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.light();
    toggleReaction.mutate({
      mediaId: currentMedia.id,
      isLiked: reactions?.likedByMe || false
    });
  };

  const handleCommentsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(true);
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black z-50 flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          {media.length > 1 && (
            <span className="text-white text-sm bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
              {currentIndex + 1} / {media.length}
            </span>
          )}
        </div>

        {/* Media Content */}
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

          {/* Navigation Arrows */}
          {media.length > 1 && !isZoomed && (
            <>
              {currentIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevious();
                  }}
                  className="absolute left-4 p-3 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors z-10"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              {currentIndex < media.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                  className="absolute right-4 p-3 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors z-10"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Zoom hint */}
        {currentMedia.type === 'image' && (
          <div className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none z-10">
            <span className="text-white/40 text-xs bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full">
              {isZoomed ? 'Doppio tap per resettare' : 'Pizzica o doppio tap per zoomare'}
            </span>
          </div>
        )}

        {/* Actions Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-6 bg-gradient-to-t from-black/80 to-transparent z-10">
          <button
            onClick={handleLike}
            className="flex items-center gap-2 text-white hover:scale-110 transition-transform"
          >
            <Heart 
              className={cn(
                "w-6 h-6",
                reactions?.likedByMe && "fill-red-500 text-red-500"
              )} 
            />
            {reactions?.likesCount ? (
              <span className="text-sm font-medium">{reactions.likesCount}</span>
            ) : null}
          </button>
          
          <button
            onClick={handleCommentsClick}
            className="flex items-center gap-2 text-white hover:scale-110 transition-transform"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="text-sm font-medium">Commenta</span>
          </button>
        </div>

        {/* Swipe hint when not zoomed */}
        {!isZoomed && (
          <div className="absolute top-20 left-0 right-0 flex justify-center pointer-events-none z-10">
            <span className="text-white/30 text-xs">Scorri verso il basso per chiudere</span>
          </div>
        )}
      </div>

      {/* Media Comments Sheet */}
      {showComments && (
        <MediaCommentsSheet
          media={currentMedia}
          isOpen={showComments}
          onClose={() => setShowComments(false)}
        />
      )}
    </>
  );
};

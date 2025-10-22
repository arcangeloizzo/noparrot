import { useState } from 'react';
import { X, Heart, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMediaReactions, useToggleMediaReaction } from '@/hooks/useMediaReactions';
import { MediaCommentsSheet } from './MediaCommentsSheet';
import { cn } from '@/lib/utils';

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
  const [scale, setScale] = useState(1);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  
  const currentMedia = media[currentIndex];
  const { data: reactions } = useMediaReactions(currentMedia.id);
  const toggleReaction = useToggleMediaReaction();

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setScale(1);
    }
  };

  const handleNext = () => {
    if (currentIndex < media.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setScale(1);
    }
  };

  const handleDoubleClick = () => {
    setScale(scale === 1 ? 2 : 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;
    
    // Swipe down to close
    if (deltaY > 100 && Math.abs(deltaX) < 50) {
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

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
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
        className="fixed inset-0 bg-black/95 z-50 flex flex-col"
        onClick={onClose}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          {media.length > 1 && (
            <span className="text-white text-sm bg-black/50 px-3 py-1 rounded-full">
              {currentIndex + 1} / {media.length}
            </span>
          )}
        </div>

        {/* Media Content */}
        <div 
          className="flex-1 flex items-center justify-center relative"
          onClick={(e) => e.stopPropagation()}
        >
          {currentMedia.type === 'image' ? (
            <img
              src={currentMedia.url}
              alt=""
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${scale})` }}
              onDoubleClick={handleDoubleClick}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <video
              src={currentMedia.url}
              poster={currentMedia.thumbnail_url}
              controls
              playsInline
              className="max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              Il tuo browser non supporta il tag video.
            </video>
          )}

          {/* Navigation Arrows */}
          {media.length > 1 && (
            <>
              {currentIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevious();
                  }}
                  className="absolute left-4 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
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
                  className="absolute right-4 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Actions Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-6 bg-gradient-to-t from-black/80 to-transparent">
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

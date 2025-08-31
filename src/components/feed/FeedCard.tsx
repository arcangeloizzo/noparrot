import { useState } from "react";
import { HeartIcon, MessageCircleIcon, BookmarkIcon, InfoIcon } from "@/components/ui/icons";
import { reactions } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { TRUST_SCORE_COLORS, TOOLTIPS } from "@/config/brand";
import { MockPost } from "@/data/mockData";
import { SwipeGestureHandler } from "./SwipeGestureHandler";
import { useIsMobile } from "@/hooks/use-mobile";

interface FeedCardProps {
  post: MockPost;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
}

export const FeedCard = ({ 
  post, 
  onSwipeLeft,
  onSwipeRight, 
  onLongPress 
}: FeedCardProps) => {
  const [showReactions, setShowReactions] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const isMobile = useIsMobile();
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked);
  const [isHiding, setIsHiding] = useState(false);

  // Generate avatar with initials if no image
  const getAvatarContent = () => {
    if (post.avatar) {
      return <img src={post.avatar} alt={post.authorName} className="w-full h-full object-cover" />;
    }
    
    const initials = post.authorName.split(' ').map(n => n[0]).join('').toUpperCase();
    const hashCode = post.authorName.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const colors = ['#0A7AFF', '#E41E52', '#FFD464', '#BFE9E9'];
    const color = colors[Math.abs(hashCode) % colors.length];
    
    return (
      <div 
        className="w-full h-full flex items-center justify-center text-white text-sm font-semibold"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
    );
  };

  const getTrustScoreClass = (trust: string | null) => {
    if (!trust) return TRUST_SCORE_COLORS.NONE;
    return TRUST_SCORE_COLORS[trust as keyof typeof TRUST_SCORE_COLORS] || TRUST_SCORE_COLORS.NONE;
  };

  const getStanceColor = (stance: string | null) => {
    switch (stance) {
      case "Condiviso": return "bg-trust-high text-white";
      case "Confutato": return "bg-trust-low text-white"; 
      default: return "bg-muted text-muted-foreground";
    }
  };

  const formatTimeAgo = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}g`;
  };

  const handleSwipeLeft = () => {
    onSwipeLeft?.();
  };

  const handleSwipeRight = () => {
    setIsHiding(true);
    setTimeout(() => {
      onSwipeRight?.();
    }, 300);
  };

  const handleLongPress = () => {
    onLongPress?.();
  };

  const trustClass = getTrustScoreClass(post.trust);
  const trustLabel = post.sources.length === 0 ? "Nessuna Fonte" : post.trust || "Nessuna Fonte";

  return (
    <>
      <SwipeGestureHandler
        onSwipeLeft={handleSwipeLeft}
        onSwipeRight={handleSwipeRight}
        onLongPress={handleLongPress}
      >
        <div
          className={cn("relative transition-all duration-500 ease-out float-in", isHiding && "opacity-0 scale-95")}
        >
          <div className="glass-card rounded-2xl mx-4 relative z-10 gentle-hover group transition-all duration-300">
            {/* Main Content Grid */}
            <div className="p-5">
              {/* User Row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-white/10 gentle-hover">
                      {getAvatarContent()}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-card-foreground">{post.authorName}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{formatTimeAgo(post.minutesAgo)}</span>
                    </div>
                  </div>
                {post.stance && (
                  <span className={`${getStanceColor(post.stance)} text-xs px-3 py-1.5 rounded-full font-medium ml-3 backdrop-blur-sm`}>
                    {post.stance}
                  </span>
                )}
              </div>

              {/* Comment */}
              <p className="text-card-foreground text-sm leading-relaxed line-clamp-3 mb-4">
                {post.userComment}
              </p>

              {/* Topic Tag */}
              {post.topicTag && (
                <div className="mb-4">
                  <span className="bg-secondary text-secondary-foreground text-xs px-3 py-1.5 rounded-full font-semibold w-fit">
                    {post.topicTag}
                  </span>
                </div>
              )}

              {/* Article Content */}
              {post.sharedTitle && (
                <div className="space-y-3 mb-3">
                  <h3 className="font-bold text-card-foreground text-base line-clamp-2">
                    {post.sharedTitle}
                  </h3>
                  
                  {post.previewImg && (
                    <div className="w-full aspect-video bg-muted rounded-lg overflow-hidden">
                      <img 
                        src={post.previewImg} 
                        alt="Article preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {post.url && (
                    <p className="text-xs text-muted-foreground opacity-70">
                      {post.url}
                    </p>
                  )}
                </div>
              )}

              {/* Action Row */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={() => setIsLiked(!isLiked)}
                      className="p-1 text-muted-foreground hover:text-primary apple-spring focus-ring rounded-lg"
                    >
                      <HeartIcon className="w-5 h-5 stroke-[1.5px]" filled={isLiked} />
                    </button>
                    <span className="text-xs text-muted-foreground font-medium">{post.reactions.heart}</span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button className="p-1 text-muted-foreground hover:text-primary apple-spring focus-ring rounded-lg">
                      <MessageCircleIcon className="w-5 h-5 stroke-[1.5px]" />
                    </button>
                    <span className="text-xs text-muted-foreground font-medium">{post.reactions.comments}</span>
                  </div>

                  <button 
                    onClick={() => setIsBookmarked(!isBookmarked)}
                    className="p-1 text-muted-foreground hover:text-primary apple-spring focus-ring rounded-lg"
                  >
                    <BookmarkIcon className="w-5 h-5 stroke-[1.5px]" filled={isBookmarked} />
                  </button>
                </div>

                <div className="relative flex items-center space-x-1">
                  <button
                    onClick={() => setShowTooltip(!showTooltip)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap backdrop-blur-sm border-0 apple-spring focus-ring",
                      trustClass
                    )}
                  >
                    {trustLabel}
                  </button>
                  <button
                    onClick={() => setShowTooltip(!showTooltip)}
                    className="p-0.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                  >
                    <InfoIcon className="w-3 h-3" />
                  </button>

                  {/* Tooltip */}
                  {showTooltip && (
                    <div className={cn(
                      "absolute bottom-full mb-2 bg-popover border rounded-lg shadow-lg backdrop-blur-sm text-xs text-popover-foreground z-[200] max-w-[280px]",
                      isMobile 
                        ? "right-0 w-72 max-w-[calc(100vw-2rem)] p-2 mr-2" 
                        : "left-1/2 transform -translate-x-1/2 w-64 p-3"
                    )}>
                      <div className="relative whitespace-normal">
                        {post.sources.length === 0 ? TOOLTIPS.NO_SOURCES : TOOLTIPS.TRUST_SCORE}
                        <div className={cn(
                          "absolute top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-popover",
                          isMobile ? "right-4" : "left-1/2 transform -translate-x-1/2"
                        )}></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </SwipeGestureHandler>

      {/* Extended Reactions Palette */}
      {showReactions && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-popover border rounded-lg shadow-lg p-2 flex space-x-2 z-50">
          {Object.entries(reactions).map(([key, emoji]) => (
            <button
              key={key}
              onClick={() => {
                setShowReactions(false);
                setIsLiked(true);
              }}
              className="text-xl hover:scale-110 transition-transform p-1"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

    </>
  );
};
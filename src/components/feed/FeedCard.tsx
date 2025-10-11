import { useState, useEffect } from "react";
import { HeartIcon, MessageCircleIcon, BookmarkIcon, MoreHorizontal, EyeOff } from "lucide-react";
import { TrustBadge } from "@/components/ui/trust-badge";
import { fetchTrustScore } from "@/lib/comprehension-gate";
import { cn } from "@/lib/utils";
import { MockPost } from "@/data/mockData";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FeedCardProps {
  post: MockPost;
  onOpenReader?: () => void;
  onRemove?: () => void;
}

const getTimeAgo = (timestamp: number) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const getHostnameFromUrl = (url: string | undefined): string => {
  if (!url) return 'Fonte';
  try {
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    return new URL(urlWithProtocol).hostname;
  } catch {
    return 'Fonte';
  }
};

export const FeedCard = ({ 
  post, 
  onOpenReader,
  onRemove 
}: FeedCardProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked);
  const [trustScore, setTrustScore] = useState<any>(null);
  const [loadingTrust, setLoadingTrust] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

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
    const colors = ['#1D9BF0', '#E41E52', '#FFD464', '#BFE9E9'];
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

  const formatTimeAgo = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}g`;
  };

  // Load trust score for posts with sources
  useEffect(() => {
    if (post.url && !trustScore && !loadingTrust) {
      setLoadingTrust(true);
      fetchTrustScore({
        postText: post.userComment || "",
        sources: [post.url],
        userMeta: { verified: post.authorName.includes("Verified") }
      })
      .then(setTrustScore)
      .catch(console.error)
      .finally(() => setLoadingTrust(false));
    }
  }, [post, trustScore, loadingTrust]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    setTouchEnd(e.targetTouches[0].clientX);
    const offset = touchStart - e.targetTouches[0].clientX;
    if (offset > 0) {
      setSwipeOffset(Math.min(offset, 80));
    }
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    
    if (isLeftSwipe && onOpenReader) {
      onOpenReader();
    }
    
    setSwipeOffset(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <article 
      className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer" 
      style={{
        transform: `translateX(-${swipeOffset}px)`,
        transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={onOpenReader}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
          {getAvatarContent()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* User Info */}
          <div className="flex items-center gap-1 mb-1">
            <span className="font-semibold text-foreground text-[15px] hover:underline" onClick={(e) => e.stopPropagation()}>
              {post.authorName}
            </span>
            <span className="text-muted-foreground text-[15px]">·</span>
            <span className="text-muted-foreground text-[15px]">{formatTimeAgo(post.minutesAgo)}</span>
            
            {/* More Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="ml-auto p-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRemove?.(); }}>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Nascondi questo post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Comment */}
          <p className="text-foreground text-[15px] leading-5 mb-3 whitespace-pre-wrap">
            {post.userComment}
          </p>

          {/* Article Preview */}
          {post.sharedTitle && (
            <div className="border border-border rounded-2xl overflow-hidden mb-3">
              {post.previewImg && (
                <div className="w-full aspect-video bg-muted">
                  <img 
                    src={post.previewImg} 
                    alt="Article preview" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {getHostnameFromUrl(post.url)}
                </p>
                <h3 className="font-semibold text-foreground text-[15px] line-clamp-2">
                  {post.sharedTitle}
                </h3>
              </div>
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center justify-between max-w-md -ml-2">
            <button 
              onClick={(e) => { e.stopPropagation(); /* TODO: Comment */ }}
              className="flex items-center gap-2 p-2 rounded-full hover:bg-primary/10 group transition-colors"
            >
              <MessageCircleIcon className="w-[18px] h-[18px] text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-[13px] text-muted-foreground group-hover:text-primary transition-colors">
                {post.reactions.comments}
              </span>
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); /* TODO: Repost */ }}
              className="flex items-center gap-2 p-2 rounded-full hover:bg-green-500/10 group transition-colors"
            >
              <svg className="w-[18px] h-[18px] text-muted-foreground group-hover:text-green-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 1l4 4-4 4" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 23l-4-4 4-4" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <span className="text-[13px] text-muted-foreground group-hover:text-green-500 transition-colors">
                {Math.floor(post.reactions.heart / 10)}
              </span>
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); setIsLiked(!isLiked); }}
              className="flex items-center gap-2 p-2 rounded-full hover:bg-red-500/10 group transition-colors"
            >
              <HeartIcon 
                className={cn(
                  "w-[18px] h-[18px] transition-colors",
                  isLiked ? "text-red-500 fill-red-500" : "text-muted-foreground group-hover:text-red-500"
                )}
              />
              <span className={cn(
                "text-[13px] transition-colors",
                isLiked ? "text-red-500" : "text-muted-foreground group-hover:text-red-500"
              )}>
                {post.reactions.heart + (isLiked ? 1 : 0)}
              </span>
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); setIsBookmarked(!isBookmarked); }}
              className="p-2 rounded-full hover:bg-primary/10 group transition-colors"
            >
              <BookmarkIcon 
                className={cn(
                  "w-[18px] h-[18px] transition-colors",
                  isBookmarked ? "text-primary fill-primary" : "text-muted-foreground group-hover:text-primary"
                )}
              />
            </button>
          </div>

          {/* Trust Score - Discrete */}
          {(trustScore || post.url) && (
            <div className="mt-2 pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
              {trustScore ? (
                <TrustBadge
                  band={trustScore.band}
                  score={trustScore.score}
                  reasons={trustScore.reasons}
                  size="sm"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                />
              ) : loadingTrust ? (
                <div className="flex items-center gap-2 opacity-60">
                  <div className="w-5 h-5 rounded-full bg-muted animate-pulse" />
                  <div className="w-12 h-2.5 bg-muted animate-pulse rounded" />
                </div>
              ) : (
                <TrustBadge size="sm" className="opacity-60 hover:opacity-100 transition-opacity" />
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

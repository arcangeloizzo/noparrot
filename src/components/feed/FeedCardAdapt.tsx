import { useState, useEffect } from "react";
import { HeartIcon, MessageCircleIcon, BookmarkIcon, MoreHorizontal, EyeOff } from "lucide-react";
import { TrustBadge } from "@/components/ui/trust-badge";
import { fetchTrustScore } from "@/lib/comprehension-gate";
import { cn } from "@/lib/utils";
import { Post } from "@/hooks/usePosts";
import { useToggleReaction } from "@/hooks/usePosts";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommentsSheet } from "./CommentsSheet";

interface FeedCardProps {
  post: Post;
  onOpenReader?: () => void;
  onRemove?: () => void;
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

export const FeedCard = ({ 
  post, 
  onOpenReader,
  onRemove 
}: FeedCardProps) => {
  const toggleReaction = useToggleReaction();
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [showComments, setShowComments] = useState(false);

  const handleHeart = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleReaction.mutate({ postId: post.id, reactionType: 'heart' });
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleReaction.mutate({ postId: post.id, reactionType: 'bookmark' });
  };

  const getAvatarContent = () => {
    if (post.author.avatar_url) {
      return (
        <img 
          src={post.author.avatar_url}
          alt={post.author.full_name || post.author.username}
          className="w-full h-full object-cover"
        />
      );
    }
    
    const initial = (post.author.full_name || post.author.username).charAt(0).toUpperCase();
    const bgColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500'];
    const colorIndex = post.author.username.charCodeAt(0) % bgColors.length;
    
    return (
      <div className={`${bgColors[colorIndex]} w-full h-full flex items-center justify-center text-white font-bold text-lg`}>
        {initial}
      </div>
    );
  };

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    if (isLeftSwipe && onOpenReader) {
      onOpenReader();
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { 
    addSuffix: true,
    locale: it 
  });

  return (
    <div 
      className="p-4 hover:bg-muted/30 transition-colors"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-muted">
            {getAvatarContent()}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-foreground hover:underline text-sm">
              {post.author.full_name || post.author.username}
            </span>
            <span className="text-muted-foreground text-sm">
              @{post.author.username.split('@')[0]}
            </span>
            <span className="text-muted-foreground text-sm">·</span>
            <span className="text-muted-foreground text-sm">
              {timeAgo}
            </span>

            {/* Actions Menu */}
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="p-1.5 hover:bg-primary/10 rounded-full transition-colors text-muted-foreground hover:text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onRemove?.();
                  }}>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Nascondi post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* User Comment */}
          <div className="mb-3 text-foreground text-[15px] leading-normal whitespace-pre-wrap break-words">
            {post.content}
          </div>

          {/* Article Preview Card */}
          {post.shared_url && (
            <div className="mb-3 border border-border rounded-2xl overflow-hidden hover:bg-muted/30 transition-colors">
              {post.preview_img && (
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  <img 
                    src={post.preview_img}
                    alt={post.shared_title || ''}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-3">
                <div className="text-xs text-muted-foreground mb-1">
                  {getHostnameFromUrl(post.shared_url)}
                </div>
                <div className="font-semibold text-sm text-foreground line-clamp-2">
                  {post.shared_title}
                </div>
              </div>
            </div>
          )}

          {/* Trust Badge */}
          {post.trust_level && (
            <div className="mb-3 flex items-center gap-2">
              <TrustBadge 
                band={post.trust_level}
                score={post.trust_level === 'ALTO' ? 85 : post.trust_level === 'MEDIO' ? 60 : 35}
                size="sm"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-6 text-muted-foreground mt-3">
            <button 
              className="flex items-center gap-2 hover:text-primary transition-colors group"
              onClick={handleHeart}
            >
              <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                <HeartIcon 
                  className={cn(
                    "w-[18px] h-[18px] transition-all",
                    post.user_reactions.has_hearted && "fill-primary stroke-primary"
                  )}
                />
              </div>
              <span className="text-sm">{post.reactions.hearts}</span>
            </button>

            <button 
              className="flex items-center gap-2 hover:text-primary transition-colors group"
              onClick={(e) => {
                e.stopPropagation();
                setShowComments(true);
              }}
            >
              <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                <MessageCircleIcon className="w-[18px] h-[18px]" />
              </div>
              <span className="text-sm">{post.reactions.comments}</span>
            </button>

            <button 
              className="flex items-center gap-2 hover:text-primary transition-colors group ml-auto"
              onClick={handleBookmark}
            >
              <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                <BookmarkIcon 
                  className={cn(
                    "w-[18px] h-[18px] transition-all",
                    post.user_reactions.has_bookmarked && "fill-primary stroke-primary"
                  )}
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      <CommentsSheet
        postId={post.id}
        isOpen={showComments}
        onClose={() => setShowComments(false)}
      />
    </div>
  );
};

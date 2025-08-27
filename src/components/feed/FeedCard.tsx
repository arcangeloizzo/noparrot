import { useState } from "react";
import { HeartIcon, MessageCircleIcon, BookmarkIcon, InfoIcon } from "@/components/ui/icons";
import { reactions } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface FeedCardProps {
  post: {
    id: string;
    user: {
      name: string;
      avatar?: string;
    };
    status: "Shared" | "Refuted" | "No Source";
    comment: string;
    topic?: string;
    title?: string;
    previewImage?: string;
    sourceUrl?: string;
    trustScore?: "LOW" | "MEDIUM" | "HIGH" | "No Sources";
    reactions: {
      heart: number;
      comments: number;
    };
    isBookmarked: boolean;
  };
  scale?: number;
  offset?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
}

export const FeedCard = ({ 
  post, 
  scale = 1, 
  offset = 0,
  onSwipeLeft,
  onSwipeRight, 
  onLongPress 
}: FeedCardProps) => {
  const [showReactions, setShowReactions] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked);

  // Generate avatar with initials if no image
  const getAvatarContent = () => {
    if (post.user.avatar) {
      return <img src={post.user.avatar} alt={post.user.name} className="w-full h-full object-cover" />;
    }
    
    const initials = post.user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    const colors = ['bg-primary-blue', 'bg-brand-pink', 'bg-brand-yellow', 'bg-light-blue'];
    const colorIndex = post.user.name.length % colors.length;
    
    return (
      <div className={`w-full h-full ${colors[colorIndex]} flex items-center justify-center text-white text-sm font-semibold`}>
        {initials}
      </div>
    );
  };

  const getTrustScoreColor = (score: string) => {
    switch (score) {
      case "HIGH": return "bg-trust-high text-white";
      case "MEDIUM": return "bg-trust-medium text-dark-blue";
      case "LOW": return "bg-trust-low text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Shared": return "bg-trust-high text-white";
      case "Refuted": return "bg-trust-low text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div 
      className="relative"
      style={{
        transform: `scale(${scale}) translateY(${offset}px)`,
        transformOrigin: 'top center'
      }}
    >
      <div className="bg-card rounded-lg shadow-card border border-border/50 p-4 space-y-3 mx-4">
        {/* User Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full overflow-hidden">
              {getAvatarContent()}
            </div>
            <span className="font-medium text-card-foreground">{post.user.name}</span>
          </div>
          <span className={`${getStatusColor(post.status)} text-xs px-2 py-1 rounded-full font-medium`}>
            {post.status}
          </span>
        </div>

        {/* Comment */}
        <p className="text-card-foreground text-sm leading-relaxed line-clamp-3">
          {post.comment}
        </p>

        {/* Topic Tag */}
        {post.topic && (
          <span className="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full font-medium w-fit">
            {post.topic}
          </span>
        )}

        {/* Article Content */}
        {post.title && (
          <div className="space-y-3">
            <h3 className="font-semibold text-card-foreground text-sm line-clamp-2">
              {post.title}
            </h3>
            
            {post.previewImage && (
              <div className="w-full aspect-video bg-muted rounded-md overflow-hidden">
                <img 
                  src={post.previewImage} 
                  alt="Article preview" 
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              {post.sourceUrl && (
                <p className="text-xs text-muted-foreground opacity-70">
                  {post.sourceUrl}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Trust Score - positioned between URL and actions */}
        <div className="flex justify-end">
          <div className="flex items-center space-x-1">
            <span className={`${getTrustScoreColor(post.trustScore || "No Sources")} text-xs px-2 py-1 rounded-full font-medium`}>
              {post.trustScore || "No Sources"}
            </span>
            <InfoIcon className="w-3 h-3 text-muted-foreground" />
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center space-x-4 pt-1">
          <div className="flex items-center space-x-1">
            <button 
              onClick={() => setIsLiked(!isLiked)}
              className="p-1 text-muted-foreground hover:text-primary-blue transition-colors"
            >
              <HeartIcon className="w-5 h-5" filled={isLiked} />
            </button>
            <span className="text-xs text-muted-foreground">{post.reactions.heart}</span>
          </div>

          <div className="flex items-center space-x-1">
            <button className="p-1 text-muted-foreground hover:text-primary-blue transition-colors">
              <MessageCircleIcon className="w-5 h-5" />
            </button>
            <span className="text-xs text-muted-foreground">{post.reactions.comments}</span>
          </div>

          <button 
            onClick={() => setIsBookmarked(!isBookmarked)}
            className="p-1 text-muted-foreground hover:text-primary-blue transition-colors ml-auto"
          >
            <BookmarkIcon className="w-5 h-5" filled={isBookmarked} />
          </button>
        </div>
      </div>
    </div>
  );
};
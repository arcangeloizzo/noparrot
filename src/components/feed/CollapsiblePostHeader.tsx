import { useState, useEffect } from 'react';
import { MoreHorizontal, ArrowLeft } from 'lucide-react';
import { Post } from '@/hooks/usePosts';
import { Comment } from '@/hooks/useComments';
import { cn, getDisplayUsername } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

interface CollapsiblePostHeaderProps {
  post: Post;
  isCollapsed: boolean;
  onExpand: () => void;
  focusComment?: Comment | null;
  onBackToPost?: () => void;
}

export const CollapsiblePostHeader = ({ 
  post, 
  isCollapsed, 
  onExpand,
  focusComment,
  onBackToPost
}: CollapsiblePostHeaderProps) => {
  const content = focusComment || post;
  const isComment = !!focusComment;
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatar = () => {
    const avatarUrl = isComment 
      ? (content as Comment).author.avatar_url 
      : (content as Post).author.avatar_url;
    const name = isComment
      ? (content as Comment).author.full_name || (content as Comment).author.username
      : (content as Post).author.full_name || (content as Post).author.username;

    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={name}
          className={cn(
            "rounded-full object-cover transition-all duration-220",
            isCollapsed ? "w-7 h-7" : "w-10 h-10"
          )}
        />
      );
    }
    return (
      <div className={cn(
        "rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold transition-all duration-220",
        isCollapsed ? "w-7 h-7 text-xs" : "w-10 h-10 text-sm"
      )}>
        {getInitials(name)}
      </div>
    );
  };

  const displayName = isComment
    ? (content as Comment).author.full_name || getDisplayUsername((content as Comment).author.username)
    : (content as Post).author.full_name || getDisplayUsername((content as Post).author.username);

  const displayHandle = isComment
    ? getDisplayUsername((content as Comment).author.username)
    : getDisplayUsername((content as Post).author.username);

  const timestamp = formatDistanceToNow(new Date(content.created_at), {
    addSuffix: true,
    locale: it
  });

  const contentText = isComment 
    ? (content as Comment).content 
    : (content as Post).content;

  if (isCollapsed) {
    return (
      <div 
        className="sticky top-0 bg-background/95 backdrop-blur-sm z-30 border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-all duration-220 collapsible-header"
        onClick={onExpand}
      >
        <div className="px-4 py-2 flex items-center gap-3">
          {getAvatar()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-semibold truncate">{displayName}</span>
              <span className="text-muted-foreground">@{displayHandle}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground text-xs">{timestamp}</span>
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {contentText}
            </div>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              // Menu actions
            }}
            className="p-1.5 hover:bg-muted rounded-full transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border animate-fade-in">
      {focusComment && onBackToPost && (
        <button
          onClick={onBackToPost}
          className="px-4 py-2 flex items-center gap-2 text-sm text-primary hover:bg-muted/30 transition-colors w-full"
        >
          <ArrowLeft className="w-4 h-4" />
          Vedi post
        </button>
      )}
      <div className="px-4 py-3">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            {getAvatar()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-base">
                {displayName}
              </span>
              <span className="text-muted-foreground text-sm">
                @{displayHandle}
              </span>
            </div>
            <div className="text-base leading-relaxed mb-2 whitespace-pre-wrap">
              {contentText}
            </div>
            <div className="text-muted-foreground text-sm">
              {new Date(content.created_at).toLocaleString('it-IT', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

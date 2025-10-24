import { useState, useEffect, useRef } from 'react';
import { Comment } from '@/hooks/useComments';
import { CommentItem } from './CommentItem';

interface CommentListProps {
  comments: Comment[];
  currentUserId?: string;
  onReply: (comment: Comment) => void;
  onLike: (commentId: string, isLiked: boolean) => void;
  onDelete: (commentId: string) => void;
  focusCommentId?: string | null;
  sortMode: 'relevance' | 'recent' | 'top';
}

interface CommentWithReplies extends Comment {
  replies?: CommentWithReplies[];
  likesCount?: number;
}

export const CommentList = ({
  comments,
  currentUserId,
  onReply,
  onLike,
  onDelete,
  focusCommentId,
  sortMode
}: CommentListProps) => {
  const [visibleCount, setVisibleCount] = useState(30);
  const [hasAnimated, setHasAnimated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lazy load more comments on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      if (distanceFromBottom < 200 && visibleCount < comments.length) {
        setVisibleCount(prev => Math.min(prev + 20, comments.length));
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [visibleCount, comments.length]);

  // Stagger fade-in animation (first render only)
  useEffect(() => {
    if (!hasAnimated && comments.length > 0) {
      setHasAnimated(true);
    }
  }, [comments.length, hasAnimated]);

  // Auto-scroll and highlight focused comment
  useEffect(() => {
    if (focusCommentId) {
      setTimeout(() => {
        const element = document.getElementById(`comment-${focusCommentId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-comment');
          setTimeout(() => element.classList.remove('highlight-comment'), 1000);
        }
      }, 300);
    }
  }, [focusCommentId]);

  const buildCommentTree = (comments: Comment[]): CommentWithReplies[] => {
    const topLevel = comments.filter(c => !c.parent_id);
    const repliesMap = new Map<string, Comment[]>();
    
    // Group replies by parent_id
    comments.filter(c => c.parent_id).forEach(comment => {
      const parentId = comment.parent_id!;
      if (!repliesMap.has(parentId)) {
        repliesMap.set(parentId, []);
      }
      repliesMap.get(parentId)!.push(comment);
    });
    
    // Recursively add replies
    const addReplies = (comment: Comment): CommentWithReplies => {
      const children = repliesMap.get(comment.id) || [];
      if (children.length === 0) {
        return comment;
      }
      return {
        ...comment,
        replies: children.map(addReplies)
      };
    };
    
    return topLevel.map(addReplies);
  };

  const flattenComments = (tree: CommentWithReplies[]): Comment[] => {
    const result: Comment[] = [];
    const traverse = (comments: CommentWithReplies[]) => {
      comments.forEach(comment => {
        result.push(comment);
        if (comment.replies && comment.replies.length > 0) {
          traverse(comment.replies);
        }
      });
    };
    traverse(tree);
    return result;
  };

  const commentTree = buildCommentTree(comments);
  const flatComments = flattenComments(commentTree);
  const visibleComments = flatComments.slice(0, visibleCount);

  if (comments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Nessun commento ancora.</p>
        <p className="text-xs mt-1">Sii il primo a rispondere!</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="pb-20">
      {visibleComments.map((comment, index) => (
        <div
          key={comment.id}
          id={`comment-${comment.id}`}
          className={!hasAnimated ? 'animate-fade-in' : ''}
          style={!hasAnimated ? { animationDelay: `${index * 40}ms` } : {}}
        >
          <CommentItem
            comment={comment}
            currentUserId={currentUserId}
            onReply={() => onReply(comment)}
            onLike={onLike}
            onDelete={() => onDelete(comment.id)}
            isHighlighted={comment.id === focusCommentId}
          />
        </div>
      ))}
      {visibleCount < flatComments.length && (
        <div className="text-center py-4">
          <div className="text-sm text-muted-foreground">Caricamento...</div>
        </div>
      )}
    </div>
  );
};

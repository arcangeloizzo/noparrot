import { useState, useRef, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMediaComments, useAddMediaComment, useDeleteMediaComment } from '@/hooks/useMediaComments';
import { useAuth } from '@/contexts/AuthContext';
import { CommentItem } from '@/components/feed/CommentItem';
import type { Comment } from '@/hooks/useComments';

interface Media {
  id: string;
  type: 'image' | 'video';
  url: string;
}

interface MediaCommentsSheetProps {
  media: Media;
  isOpen: boolean;
  onClose: () => void;
}

export const MediaCommentsSheet = ({ media, isOpen, onClose }: MediaCommentsSheetProps) => {
  const { user } = useAuth();
  const { data: comments = [], isLoading } = useMediaComments(media.id);
  const addComment = useAddMediaComment();
  const deleteComment = useDeleteMediaComment();
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    if (!newComment.trim() || addComment.isPending) return;

    const parentComment = replyingTo ? comments.find(c => c.id === replyingTo) : null;
    
    await addComment.mutateAsync({
      mediaId: media.id,
      content: newComment.trim(),
      parentId: replyingTo,
      level: parentComment ? parentComment.level + 1 : 0
    });

    setNewComment('');
    setReplyingTo(null);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Adapter to convert media comment to Comment type for CommentItem
  const adaptMediaComment = (mediaComment: typeof comments[0]): Comment => ({
    id: mediaComment.id,
    post_id: '', // Media comments don't have post_id
    author_id: mediaComment.author_id,
    content: mediaComment.content,
    created_at: mediaComment.created_at,
    parent_id: mediaComment.parent_id,
    level: mediaComment.level,
    passed_gate: false,
    author: {
      id: mediaComment.author.id,
      username: mediaComment.author.username,
      full_name: mediaComment.author.full_name,
      avatar_url: mediaComment.author.avatar_url,
    },
    media: [],
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-[60] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between z-20">
        <button
          onClick={onClose}
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold">Commenti</span>
        <div className="w-10" />
      </div>

      {/* Comments Area */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Caricamento commenti...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 px-4">
              <p className="text-sm">Nessun commento ancora.</p>
              <p className="text-xs mt-1">Sii il primo a commentare!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="px-2 py-1">
                <CommentItem
                  comment={adaptMediaComment(comment)}
                  currentUserId={user?.id}
                  onReply={() => {
                    setReplyingTo(comment.id);
                    textareaRef.current?.focus();
                  }}
                  onDelete={() => deleteComment.mutate(comment.id)}
                  commentKind="media"
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Reply Form */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-30">
        {replyingTo && (
          <div className="mb-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>Rispondi a {comments.find(c => c.id === replyingTo)?.author.full_name}</span>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-destructive hover:underline"
            >
              Annulla
            </button>
          </div>
        )}
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Scrivi un commento..."
            className="flex-1 bg-transparent border-none focus:outline-none resize-none text-sm min-h-[40px] max-h-[120px]"
            maxLength={500}
            rows={2}
          />
          <Button
            onClick={handleSubmit}
            disabled={!newComment.trim() || addComment.isPending}
            size="sm"
            className="rounded-full px-4 font-bold"
          >
            {addComment.isPending ? 'Invio...' : 'Invia'}
          </Button>
        </div>
      </div>
    </div>
  );
};

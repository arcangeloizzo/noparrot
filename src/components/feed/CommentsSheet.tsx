import { useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useComments, useAddComment, useDeleteComment } from '@/hooks/useComments';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

interface CommentsSheetProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CommentsSheet = ({ postId, isOpen, onClose }: CommentsSheetProps) => {
  const { user } = useAuth();
  const { data: comments = [], isLoading } = useComments(postId);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const [newComment, setNewComment] = useState('');

  const handleSubmit = async () => {
    if (!newComment.trim() || addComment.isPending) return;

    await addComment.mutateAsync({
      postId,
      content: newComment.trim()
    });

    setNewComment('');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Commenti ({comments.length})</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-[calc(100%-60px)] mt-4">
          {/* Comments List */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">
                Caricamento commenti...
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Nessun commento ancora. Sii il primo a commentare!
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {comment.author.avatar_url ? (
                      <img
                        src={comment.author.avatar_url}
                        alt={comment.author.full_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
                        {getInitials(comment.author.full_name || comment.author.username)}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">
                        {comment.author.full_name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        @{comment.author.username}
                      </span>
                      <span className="text-muted-foreground text-xs">·</span>
                      <span className="text-muted-foreground text-xs">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                          locale: it
                        })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>

                    {/* Delete button (only for own comments) */}
                    {user?.id === comment.author_id && (
                      <button
                        onClick={() => deleteComment.mutate(comment.id)}
                        className="text-xs text-destructive hover:underline mt-1 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Elimina
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input Area */}
          <div className="border-t pt-4">
            <div className="flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Scrivi un commento..."
                className="min-h-[80px] resize-none"
                maxLength={500}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <Button
                onClick={handleSubmit}
                disabled={!newComment.trim() || addComment.isPending}
                size="icon"
                className="h-10 w-10 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {newComment.length}/500 caratteri
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { Comment } from '@/hooks/useComments';
import { cn, getDisplayUsername } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { haptics } from '@/lib/haptics';

interface StickyComposerProps {
  postId: string;
  replyToComment?: Comment | null;
  onClearReplyTo: () => void;
  onSubmit: (content: string) => Promise<void>;
}

export const StickyComposer = ({
  postId,
  replyToComment,
  onClearReplyTo,
  onSubmit
}: StickyComposerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    haptics.light();
    
    try {
      await onSubmit(content);
      setContent('');
      setIsExpanded(false);
      if (replyToComment) {
        onClearReplyTo();
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      {/* Live region for accessibility */}
      <div role="status" aria-live="polite" className="sr-only">
        {isSubmitting ? 'Pubblicazione in corso...' : ''}
      </div>

      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40 sticky-composer",
          "transition-all duration-300 ease-out",
          isExpanded ? "h-[60vh]" : "h-14"
        )}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        {!isExpanded ? (
          <button
            onClick={() => {
              setIsExpanded(true);
              haptics.light();
              // Focus textarea after expansion
              setTimeout(() => {
                const textarea = document.querySelector('textarea[name="comment-content"]') as HTMLTextAreaElement;
                textarea?.focus();
              }, 100);
            }}
            className="w-full h-full px-4 text-left text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            {replyToComment 
              ? `Rispondi a @${getDisplayUsername(replyToComment.author.username)}` 
              : 'Posta la tua risposta'}
          </button>
        ) : (
          <div className="h-full flex flex-col p-4 animate-fade-in">
            {/* Reply context chip */}
            {replyToComment && (
              <div className="flex items-center gap-2 mb-2 p-2 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground flex-1">
                  In risposta a <span className="text-primary font-medium">@{getDisplayUsername(replyToComment.author.username)}</span>
                </span>
                <button
                  onClick={() => {
                    onClearReplyTo();
                    haptics.light();
                  }}
                  className="p-1 hover:bg-background rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Textarea */}
            <Textarea
              name="comment-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={replyToComment ? 'Scrivi una risposta...' : 'Cosa ne pensi?'}
              className="flex-1 resize-none border-none focus-visible:ring-0 text-base"
              autoFocus
            />

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsExpanded(false);
                  setContent('');
                  if (replyToComment) {
                    onClearReplyTo();
                  }
                  haptics.light();
                }}
              >
                Annulla
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!content.trim() || isSubmitting}
                size="sm"
                className="gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Pubblicazione...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Pubblica
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

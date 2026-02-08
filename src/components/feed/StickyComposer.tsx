import { useState, useRef, useEffect } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import { Comment } from '@/hooks/useComments';
import { cn, getDisplayUsername } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { haptics } from '@/lib/haptics';
import { useUserSearch } from '@/hooks/useUserSearch';
import { MentionDropdown } from './MentionDropdown';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Mention system
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const { data: mentionUsers = [], isLoading: isLoadingUsers } = useUserSearch(mentionQuery);

  // Auto-focus quando replyToComment cambia
  useEffect(() => {
    if (replyToComment && !isExpanded) {
      setIsExpanded(true);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [replyToComment]);

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

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPos = e.target.selectionStart;
    setContent(newContent);

    // Detect @ mentions
    const textBeforeCursor = newContent.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionStartPos(cursorPos - mentionMatch[0].length);
      setSelectedMentionIndex(0);
    } else {
      setMentionQuery('');
      setMentionStartPos(null);
    }
  };

  const handleMentionSelect = (user: any) => {
    if (mentionStartPos === null) return;

    const username = getDisplayUsername(user.username);
    const beforeMention = content.substring(0, mentionStartPos);
    const afterMention = content.substring(textareaRef.current?.selectionStart || content.length);
    const newContent = `${beforeMention}@${username} ${afterMention}`;

    setContent(newContent);
    setMentionQuery('');
    setMentionStartPos(null);

    // Restore focus
    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursorPos = mentionStartPos + username.length + 2;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention dropdown navigation
    if (mentionQuery && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => 
          prev < mentionUsers.length - 1 ? prev + 1 : prev
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev > 0 ? prev - 1 : 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleMentionSelect(mentionUsers[selectedMentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery('');
        setMentionStartPos(null);
        return;
      }
    }

    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = content.trim().length > 0 && !isSubmitting;

  return (
    <>
      {/* Live region for accessibility */}
      <div role="status" aria-live="polite" className="sr-only">
        {isSubmitting ? 'Pubblicazione in corso...' : ''}
      </div>

      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40",
          "bg-gradient-to-t from-background via-background/98 to-background/95",
          "border-t border-white/10 backdrop-blur-xl",
          "transition-all duration-300 ease-out"
        )}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          height: isExpanded ? '50vh' : 'auto'
        }}
      >
        {!isExpanded ? (
          /* Collapsed State - Modern Pill Bar */
          <button
            onClick={() => {
              setIsExpanded(true);
              haptics.light();
              setTimeout(() => textareaRef.current?.focus(), 100);
            }}
            className={cn(
              "w-full p-3 flex items-center gap-3",
              "hover:bg-white/5 transition-colors"
            )}
          >
            <div className={cn(
              "flex-1 flex items-center gap-3 px-4 py-3",
              "bg-white/5 rounded-full border border-white/10",
              "text-muted-foreground text-left"
            )}>
              <MessageCircle className="w-5 h-5 text-primary/60" />
              <span className="text-sm">
                {replyToComment 
                  ? `Rispondi a @${getDisplayUsername(replyToComment.author.username)}` 
                  : 'Scrivi un commento...'}
              </span>
            </div>
          </button>
        ) : (
          /* Expanded State */
          <div className="h-full flex flex-col p-4 animate-fade-in">
            {/* Reply context chip */}
            {replyToComment && (
              <div className={cn(
                "flex items-center gap-2 mb-3 px-3 py-2",
                "bg-primary/10 rounded-xl border border-primary/20"
              )}>
                <span className="text-sm text-foreground flex-1">
                  In risposta a{' '}
                  <span className="text-primary font-semibold">
                    @{getDisplayUsername(replyToComment.author.username)}
                  </span>
                </span>
                <button
                  onClick={() => {
                    onClearReplyTo();
                    haptics.light();
                  }}
                  className={cn(
                    "p-1.5 rounded-full",
                    "hover:bg-white/10 transition-colors"
                  )}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Mention Dropdown */}
            {mentionQuery && (
              <div className="relative mb-2">
                <MentionDropdown
                  users={mentionUsers}
                  selectedIndex={selectedMentionIndex}
                  onSelect={handleMentionSelect}
                  isLoading={isLoadingUsers}
                  position="below"
                />
              </div>
            )}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              name="comment-content"
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              placeholder={replyToComment ? 'Scrivi una risposta...' : 'Cosa ne pensi?'}
              className={cn(
                "flex-1 w-full resize-none bg-transparent",
                "text-base text-foreground placeholder:text-muted-foreground/60",
                "outline-none border-none focus:ring-0",
                "px-1 py-2"
              )}
              autoFocus
            />

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-auto">
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
                className="rounded-full px-4 hover:bg-white/10"
              >
                Annulla
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                size="sm"
                className={cn(
                  "rounded-full px-5 gap-2",
                  "bg-gradient-to-r from-primary to-primary/80",
                  "hover:shadow-lg hover:shadow-primary/25 hover:scale-105",
                  "active:scale-95 transition-all duration-200",
                  "disabled:opacity-50 disabled:hover:scale-100"
                )}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Invio...
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

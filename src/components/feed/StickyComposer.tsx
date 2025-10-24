import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { Comment } from '@/hooks/useComments';
import { cn, getDisplayUsername } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
              setTimeout(() => textareaRef.current?.focus(), 100);
            }}
            className="w-full h-full px-4 text-left text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            {replyToComment 
              ? `Rispondi a @${getDisplayUsername(replyToComment.author.username)}` 
              : 'Posta la tua risposta'}
          </button>
        ) : (
          <div className="h-full flex flex-col p-4 animate-fade-in relative">
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

            {/* Mention Dropdown - positioned below */}
            {mentionQuery && (
              <div className="relative">
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
            <Textarea
              ref={textareaRef}
              name="comment-content"
              value={content}
              onChange={handleContentChange}
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

import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Trash2, Image, Video, BarChart3, Smile, MapPin, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useComments, useAddComment, useDeleteComment } from '@/hooks/useComments';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Post } from '@/hooks/usePosts';
import { TrustBadge } from '@/components/ui/trust-badge';
import { MentionDropdown } from './MentionDropdown';
import { MentionText } from './MentionText';
import { useUserSearch } from '@/hooks/useUserSearch';
import { cn, getDisplayUsername } from '@/lib/utils';

interface CommentsSheetProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  autoFocusInput?: boolean;
}

export const CommentsSheet = ({ post, isOpen, onClose, autoFocusInput = false }: CommentsSheetProps) => {
  const { user } = useAuth();
  const { data: comments = [], isLoading } = useComments(post.id);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const [newComment, setNewComment] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: mentionUsers = [], isLoading: isSearching } = useUserSearch(mentionQuery);

  const handleSubmit = async () => {
    if (!newComment.trim() || addComment.isPending) return;

    await addComment.mutateAsync({
      postId: post.id,
      content: newComment.trim()
    });

    setNewComment('');
    setShowMentions(false);
    setMentionQuery('');
    
    // Scroll to top per vedere il nuovo commento
    setTimeout(() => {
      const scrollContainer = document.querySelector('.comments-scroll-container');
      scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 300);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setNewComment(value);
    setCursorPosition(cursorPos);

    // Detect @ mentions
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }
  };

  const handleSelectMention = (user: { username: string }) => {
    const textBeforeCursor = newComment.slice(0, cursorPosition);
    const textAfterCursor = newComment.slice(cursorPosition);
    
    // Remove the partial @mention and replace with full @username
    const beforeMention = textBeforeCursor.replace(/@\w*$/, '');
    const newText = `${beforeMention}@${user.username} ${textAfterCursor}`;
    
    setNewComment(newText);
    setShowMentions(false);
    setMentionQuery('');
    
    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursorPos = beforeMention.length + user.username.length + 2;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Auto-focus textarea SOLO se autoFocusInput è true (click sull'icona commento)
      if (autoFocusInput) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(0, 0);
          });
        });
      }
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, autoFocusInput]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserAvatar = (avatarUrl: string | null, name: string) => {
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={name}
          className="w-10 h-10 rounded-full object-cover"
        />
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
        {getInitials(name)}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold">Post</span>
        <Button
          onClick={handleSubmit}
          disabled={!newComment.trim() || addComment.isPending}
          size="sm"
          className="rounded-full"
        >
          Posta
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto comments-scroll-container">
        {/* Original Post */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              {getUserAvatar(post.author.avatar_url, post.author.full_name || post.author.username)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{post.author.full_name || getDisplayUsername(post.author.username)}</span>
                <span className="text-muted-foreground text-xs">@{getDisplayUsername(post.author.username)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words mb-3">{post.content}</p>
              
              {post.preview_img && (
                <img
                  src={post.preview_img}
                  alt=""
                  className="rounded-2xl w-full mb-3"
                />
              )}
              
              {post.trust_level && (
                <div className="mb-3">
                  <TrustBadge 
                    band={post.trust_level}
                    score={post.trust_level === 'ALTO' ? 85 : post.trust_level === 'MEDIO' ? 60 : 35}
                    size="sm"
                  />
                </div>
              )}
              
              <div className="text-muted-foreground text-xs">
                {formatDistanceToNow(new Date(post.created_at), {
                  addSuffix: true,
                  locale: it
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Reply Input Area */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex gap-3 relative">
            <div className="flex-shrink-0">
              {user && getUserAvatar(user.user_metadata?.avatar_url, user.user_metadata?.full_name || user.user_metadata?.username || 'Utente')}
            </div>
            <div className="flex-1 min-w-0 relative">
              <textarea
                ref={textareaRef}
                value={newComment}
                onChange={handleTextChange}
                placeholder={`In risposta a @${getDisplayUsername(post.author.username)}`}
                className="w-full bg-transparent border-none focus:outline-none resize-none text-sm min-h-[100px] placeholder:text-muted-foreground"
                maxLength={500}
                inputMode="text"
              />
              
              {/* Mention Dropdown */}
              {showMentions && (
                <MentionDropdown
                  users={mentionUsers}
                  onSelect={handleSelectMention}
                  isLoading={isSearching}
                />
              )}
              
              {/* Icon Bar */}
              <div className="flex items-center gap-1 mt-2 text-primary">
                <button className="p-2 hover:bg-primary/10 rounded-full transition-colors">
                  <Image className="w-4 h-4" />
                </button>
                <button className="p-2 hover:bg-primary/10 rounded-full transition-colors">
                  <Video className="w-4 h-4" />
                </button>
                <button className="p-2 hover:bg-primary/10 rounded-full transition-colors">
                  <BarChart3 className="w-4 h-4" />
                </button>
                <button className="p-2 hover:bg-primary/10 rounded-full transition-colors">
                  <Smile className="w-4 h-4" />
                </button>
                <button className="p-2 hover:bg-primary/10 rounded-full transition-colors">
                  <MapPin className="w-4 h-4" />
                </button>
                <button className="p-2 hover:bg-primary/10 rounded-full transition-colors">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
              
              <p className="text-xs text-muted-foreground mt-2">
                {newComment.length}/500
              </p>
            </div>
          </div>
        </div>

        {/* Comments List */}
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Caricamento commenti...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 px-4">
              <p className="text-sm">Nessun commento ancora.</p>
              <p className="text-xs mt-1">Sii il primo a rispondere!</p>
            </div>
          ) : (
            [...comments].reverse().map((comment) => (
              <div key={comment.id} className="px-4 py-3">
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    {getUserAvatar(comment.author.avatar_url, comment.author.full_name || comment.author.username)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">
                        {comment.author.full_name || getDisplayUsername(comment.author.username)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        @{getDisplayUsername(comment.author.username)}
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
                      <MentionText text={comment.content} />
                    </p>
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
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

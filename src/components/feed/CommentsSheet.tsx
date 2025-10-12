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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CommentsSheetProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  mode: 'view' | 'reply'; // 'view' = click sul post, 'reply' = click sull'icona
}

export const CommentsSheet = ({ post, isOpen, onClose, mode }: CommentsSheetProps) => {
  const { user } = useAuth();
  const { data: comments = [], isLoading } = useComments(post.id);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const [newComment, setNewComment] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [internalMode, setInternalMode] = useState<'view' | 'reply'>(mode);
  const [formHeight, setFormHeight] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const { data: mentionUsers = [], isLoading: isSearching } = useUserSearch(mentionQuery);

  // Carica il profilo dell'utente corrente dal database
  const { data: currentUserProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

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

  // Sync internal mode with prop mode
  useEffect(() => {
    setInternalMode(mode);
  }, [mode]);

  // Manage body overflow
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

  // Measure form height for dynamic padding
  useEffect(() => {
    if (!formRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setFormHeight(entry.contentRect.height);
      }
    });
    
    resizeObserver.observe(formRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Auto-focus when switching to reply mode
  useEffect(() => {
    if (internalMode === 'reply' && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 350);
    }
  }, [internalMode]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserAvatar = (avatarUrl: string | null | undefined, name: string | undefined, username?: string) => {
    const displayName = name || username || 'U';
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-10 h-10 rounded-full object-cover"
        />
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
        {getInitials(displayName)}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header - Sticky Top */}
      <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between z-20">
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
        <div className="w-10" />
      </div>

      {/* Original Post - Always Visible at Top */}
      <div className="px-4 py-3 border-b border-border bg-background">
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

      {/* Comments Area - Scrollable, compresses when form appears */}
      <div 
        className="flex-1 overflow-y-auto comments-scroll-container"
        style={{ 
          paddingBottom: internalMode === 'reply' ? `${formHeight}px` : '0px',
          transition: 'padding-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
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
...
              </div>
            ))
          )}
        </div>
      </div>

      {/* Form - Fixed at bottom with transform slide animation */}
      <div 
        ref={formRef}
        className={`fixed bottom-0 left-0 right-0 z-10 bg-background border-t border-border transition-transform duration-300 ease-out ${
          internalMode === 'reply' ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="px-4 py-3">
          <div className="flex gap-3 relative">
            <div className="flex-shrink-0">
              {currentUserProfile && getUserAvatar(
                currentUserProfile.avatar_url, 
                currentUserProfile.full_name,
                currentUserProfile.username
              )}
            </div>
            <div className="flex-1 min-w-0 relative">
              <textarea
                ref={textareaRef}
                value={newComment}
                onChange={handleTextChange}
                onClick={(e) => e.stopPropagation()}
                placeholder={`In risposta a @${getDisplayUsername(post.author.username)}`}
                className="w-full bg-transparent border-none focus:outline-none resize-none text-[15px] min-h-[80px] max-h-[120px] placeholder:text-muted-foreground leading-normal"
                maxLength={500}
                inputMode="text"
                rows={3}
                style={{ 
                  height: 'auto',
                  overflowY: newComment.split('\n').length > 5 ? 'scroll' : 'hidden'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
              
              {showMentions && (
                <MentionDropdown
                  users={mentionUsers}
                  onSelect={handleSelectMention}
                  isLoading={isSearching}
                />
              )}
              
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-1 text-primary">
                  <button 
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 hover:bg-primary/10 rounded-full transition-colors"
                  >
                    <Image className="w-[18px] h-[18px]" />
                  </button>
                  <button 
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 hover:bg-primary/10 rounded-full transition-colors"
                  >
                    <Smile className="w-[18px] h-[18px]" />
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                  <p className="text-xs text-muted-foreground">
                    {newComment.length}/500
                  </p>
                  <Button
                    onClick={handleSubmit}
                    disabled={!newComment.trim() || addComment.isPending}
                    size="sm"
                    className="rounded-full px-4 font-bold"
                  >
                    {addComment.isPending ? 'Invio...' : 'Rispondi'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

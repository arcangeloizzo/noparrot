import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Trash2, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useComments, useAddComment, useDeleteComment } from '@/hooks/useComments';
import { useCommentReactions, useToggleCommentReaction } from '@/hooks/useCommentReactions';
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
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { MediaUploadButton } from '@/components/media/MediaUploadButton';
import { MediaPreviewTray } from '@/components/media/MediaPreviewTray';
import { MediaGallery } from '@/components/media/MediaGallery';
import { MediaViewer } from '@/components/media/MediaViewer';

interface CommentsSheetProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  mode: 'view' | 'reply';
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
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [internalMode, setInternalMode] = useState<'view' | 'reply'>(mode);
  const [formHeight, setFormHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [viewerMedia, setViewerMedia] = useState<any[] | null>(null);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const { data: mentionUsers = [], isLoading: isSearching } = useUserSearch(mentionQuery);
  const { uploadMedia, uploadedMedia, removeMedia, clearMedia, isUploading } = useMediaUpload();

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

    const parentComment = replyingTo ? comments.find(c => c.id === replyingTo) : null;

    const commentId = await addComment.mutateAsync({
      postId: post.id,
      content: newComment.trim(),
      parentId: replyingTo,
      level: parentComment ? parentComment.level + 1 : 0
    });

    if (uploadedMedia.length > 0 && commentId) {
      for (let i = 0; i < uploadedMedia.length; i++) {
        await supabase.from('comment_media').insert({
          comment_id: commentId,
          media_id: uploadedMedia[i].id,
          order_idx: i
        });
      }
    }

    setNewComment('');
    setShowMentions(false);
    setMentionQuery('');
    setReplyingTo(null);
    clearMedia();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setNewComment(value);
    setCursorPosition(cursorPos);

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
    
    const beforeMention = textBeforeCursor.replace(/@\w*$/, '');
    const newText = `${beforeMention}@${user.username} ${textAfterCursor}`;
    const newCursorPos = beforeMention.length + user.username.length + 2;
    
    setNewComment(newText);
    setCursorPosition(newCursorPos);
    setShowMentions(false);
    setMentionQuery('');
    setSelectedMentionIndex(0);
    
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  };

  useEffect(() => {
    setInternalMode(mode);
  }, [mode]);

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

  useEffect(() => {
    if (!formRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setFormHeight(entry.contentRect.height);
      }
    });
    
    observer.observe(formRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (internalMode === 'reply' && mode === 'reply' && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.click();
    }
  }, [internalMode, mode]);

  // Reset selection when users change
  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [mentionUsers]);

  useEffect(() => {
    if (!isOpen) return;

    const handleViewportChange = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const diff = windowHeight - viewportHeight;
        setKeyboardHeight(diff > 0 ? diff : 0);
      }
    };

    window.visualViewport?.addEventListener('resize', handleViewportChange);
    handleViewportChange();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      setKeyboardHeight(0);
    };
  }, [isOpen]);

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
    <>
      <div 
        className="fixed inset-0 bg-background z-50 flex flex-col"
        style={{ paddingTop: keyboardHeight > 0 ? `${keyboardHeight}px` : '0' }}
      >
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

        <div className="px-4 py-3 border-b border-border bg-background flex-shrink-0">
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

        <div 
          className="flex-1 overflow-y-auto comments-scroll-container"
          style={{ 
            paddingBottom: internalMode === 'reply' ? `${formHeight}px` : '80px'
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
              comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={user?.id}
                  onReply={() => {
                    setReplyingTo(comment.id);
                    setInternalMode('reply');
                    setTimeout(() => textareaRef.current?.focus(), 100);
                  }}
                  onDelete={() => deleteComment.mutate(comment.id)}
                  onMediaClick={(media, index) => {
                    setViewerMedia(comment.media || []);
                    setViewerInitialIndex(index);
                  }}
                  getUserAvatar={getUserAvatar}
                />
              ))
            )}
          </div>
        </div>

        <div 
          ref={formRef}
          className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-30"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="px-4 py-3">
            {replyingTo && internalMode === 'reply' && (
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
            <div className="flex gap-3 items-start relative">
              <div className="flex-shrink-0 pt-1">
                {currentUserProfile && getUserAvatar(
                  currentUserProfile.avatar_url, 
                  currentUserProfile.full_name,
                  currentUserProfile.username
                )}
              </div>
              <div className="flex-1 min-w-0 relative">
                {internalMode === 'view' ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setInternalMode('reply');
                      setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
                    className="w-full bg-transparent cursor-text py-2 text-[15px] min-h-[40px] text-muted-foreground"
                  >
                    Posta la tua risposta
                  </div>
                ) : (
                  <>
                    <textarea
                      ref={textareaRef}
                      value={newComment}
                      onChange={handleTextChange}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (!showMentions || mentionUsers.length === 0) return;
                        
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setSelectedMentionIndex((prev) => 
                            (prev + 1) % mentionUsers.length
                          );
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setSelectedMentionIndex((prev) => 
                            (prev - 1 + mentionUsers.length) % mentionUsers.length
                          );
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSelectMention(mentionUsers[selectedMentionIndex]);
                        } else if (e.key === 'Escape') {
                          setShowMentions(false);
                        }
                      }}
                      placeholder={`In risposta a @${getDisplayUsername(post.author.username)}`}
                      className="w-full bg-transparent border-none focus:outline-none resize-none text-[15px] min-h-[40px] max-h-[120px] placeholder:text-muted-foreground leading-normal"
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
                        selectedIndex={selectedMentionIndex}
                        onSelect={handleSelectMention}
                        isLoading={isSearching}
                      />
                    )}
                    
                    <MediaPreviewTray
                      media={uploadedMedia}
                      onRemove={removeMedia}
                    />
                    
                    <div className="flex gap-2 mt-2">
                      <MediaUploadButton
                        type="image"
                        onFilesSelected={(files) => uploadMedia(files, 'image')}
                        maxFiles={4}
                        disabled={isUploading}
                      />
                      <MediaUploadButton
                        type="video"
                        onFilesSelected={(files) => uploadMedia(files, 'video')}
                        maxFiles={1}
                        disabled={isUploading}
                      />
                    </div>
                    
                    <div className="flex items-center justify-end gap-3 mt-3">
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
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewerMedia && (
        <MediaViewer
          media={viewerMedia}
          initialIndex={viewerInitialIndex}
          onClose={() => setViewerMedia(null)}
        />
      )}
    </>
  );
};

interface CommentItemProps {
  comment: any;
  currentUserId?: string;
  onReply: () => void;
  onDelete: () => void;
  onMediaClick: (media: any, index: number) => void;
  getUserAvatar: (avatarUrl: string | null | undefined, name: string | undefined, username?: string) => JSX.Element;
}

const CommentItem = ({ comment, currentUserId, onReply, onDelete, onMediaClick, getUserAvatar }: CommentItemProps) => {
  const { data: reactions } = useCommentReactions(comment.id);
  const toggleReaction = useToggleCommentReaction();

  const handleLike = () => {
    toggleReaction.mutate({
      commentId: comment.id,
      isLiked: reactions?.likedByMe || false
    });
  };

  return (
    <div 
      className="px-4 py-3 relative"
      style={{ paddingLeft: `${16 + comment.level * 16}px` }}
    >
      {comment.level > 0 && (
        <div 
          className="absolute left-4 top-0 bottom-0 w-0.5 bg-border"
          style={{ marginLeft: `${comment.level * 16 - 16}px` }}
        />
      )}
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
          <p className="text-sm whitespace-pre-wrap break-words mb-2">
            <MentionText text={comment.content} />
          </p>
          
          {comment.media && comment.media.length > 0 && (
            <MediaGallery 
              media={comment.media}
              onClick={onMediaClick}
            />
          )}
          
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={handleLike}
              className="flex items-center gap-1 text-muted-foreground hover:text-red-500 transition-colors"
            >
              <Heart 
                className={cn(
                  "w-4 h-4",
                  reactions?.likedByMe && "fill-red-500 text-red-500"
                )} 
              />
              {reactions?.likesCount ? (
                <span className="text-xs">{reactions.likesCount}</span>
              ) : null}
            </button>
            
            <button
              onClick={onReply}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Rispondi
            </button>
            
            {currentUserId === comment.author_id && (
              <button
                onClick={onDelete}
                className="text-xs text-destructive hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Elimina
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import { useState, useRef, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
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
import { extractFirstUrl } from '@/lib/shouldRequireGate';
import { runGateBeforeAction } from '@/lib/runGateBeforeAction';
import { QuizModal } from '@/components/ui/quiz-modal';
import { toast as sonnerToast } from 'sonner';

interface CommentsDrawerProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  mode: 'view' | 'reply';
}

export const CommentsDrawer = ({ post, isOpen, onClose, mode }: CommentsDrawerProps) => {
  const { user } = useAuth();
  const { data: comments = [], isLoading } = useComments(post.id);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const [newComment, setNewComment] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [viewerMedia, setViewerMedia] = useState<any[] | null>(null);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizData, setQuizData] = useState<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: mentionUsers = [], isLoading: isSearching } = useUserSearch(mentionQuery);
  const { uploadMedia, uploadedMedia, removeMedia, clearMedia, isUploading } = useMediaUpload();
  const [snap, setSnap] = useState<number | string | null>(0.5);

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

  useEffect(() => {
    if (mode === 'reply' && isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [mode, isOpen]);

  const handleSubmit = async () => {
    if (!newComment.trim() || addComment.isPending || isProcessing) return;

    const linkUrl = extractFirstUrl(newComment);

    const doSubmit = async () => {
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

    if (linkUrl) {
      await runGateBeforeAction({
        linkUrl,
        onSuccess: doSubmit,
        onCancel: () => sonnerToast.error('Condivisione annullata'),
        setIsProcessing,
        setQuizData,
        setShowQuiz
      });
    } else {
      await doSubmit();
    }
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
    setShowMentions(false);
    setMentionQuery('');
    setSelectedMentionIndex(0);
    
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        setCursorPosition(newCursorPos);
      }
    });
  };

  useEffect(() => {
    if (isOpen && mode === 'reply') {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [isOpen, mode]);

  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [mentionUsers]);

  useEffect(() => {
    const handleResize = () => {
      if (textareaRef.current && document.activeElement === textareaRef.current) {
        textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
          className="w-8 h-8 rounded-full object-cover"
        />
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
        {getInitials(displayName)}
      </div>
    );
  };

  return (
    <>
      <Drawer 
        open={isOpen} 
        onOpenChange={(open) => !open && onClose()}
        snapPoints={[0.5, 1]}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
        modal={false}
      >
        <DrawerContent className="cognitive-drawer pb-[env(safe-area-inset-bottom)]">
          {/* Header con Post Originale Compatto */}
          <DrawerHeader className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-20 pt-6">
            <DrawerTitle className="text-center cognitive-text-primary mb-3">
              Commenti
            </DrawerTitle>
            
            {/* Post Preview Compatto */}
            <div className="flex gap-3 pb-2">
              <div className="flex-shrink-0">
                {getUserAvatar(post.author.avatar_url, post.author.full_name || post.author.username)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm cognitive-text-primary">
                    {post.author.full_name || getDisplayUsername(post.author.username)}
                  </span>
                  <span className="text-xs cognitive-text-secondary">
                    @{getDisplayUsername(post.author.username)}
                  </span>
                </div>
                
                <p className="text-sm cognitive-text-primary line-clamp-2 mt-1">
                  <MentionText content={post.content} />
                </p>
                
                {post.preview_img && (
                  <img 
                    src={post.preview_img}
                    className="w-20 h-20 object-cover rounded-lg mt-2"
                    alt=""
                  />
                )}

                {post.trust_level && (
                  <div className="mt-2">
                    <TrustBadge 
                      band={post.trust_level}
                      score={post.trust_level === 'ALTO' ? 85 : post.trust_level === 'MEDIO' ? 60 : 35}
                      size="sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </DrawerHeader>

          {/* Lista Commenti Scrollabile */}
          <div className="flex-1 overflow-y-auto px-4">
            {isLoading ? (
              <div className="text-center cognitive-text-secondary py-8">
                Caricamento commenti...
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center cognitive-text-secondary py-8 px-4">
                <p className="text-sm">Nessun commento ancora.</p>
                <p className="text-xs mt-1">Sii il primo a rispondere!</p>
              </div>
            ) : (
              <div>
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    currentUserId={user?.id}
                    onReply={() => {
                      setReplyingTo(comment.id);
                      setTimeout(() => textareaRef.current?.focus(), 100);
                    }}
                    onDelete={() => deleteComment.mutate(comment.id)}
                    onMediaClick={(media, index) => {
                      setViewerMedia(comment.media || []);
                      setViewerInitialIndex(index);
                    }}
                    getUserAvatar={getUserAvatar}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Fixed Bottom Composer */}
          <div className="sticky bottom-0 bg-background border-t border-border z-30 pb-[env(safe-area-inset-bottom)]">
            <div className="px-4 py-4">
              {replyingTo && (
                <div className="mb-2 text-xs cognitive-text-secondary flex items-center justify-between">
                  <span>Rispondi a @{comments.find(c => c.id === replyingTo)?.author.username}</span>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="text-destructive hover:underline"
                  >
                    Annulla
                  </button>
                </div>
              )}
              <div className="cognitive-comment-composer p-3">
                <div className="flex gap-3 items-start relative">
                  <div className="flex-shrink-0 pt-2">
                    {currentUserProfile && getUserAvatar(
                      currentUserProfile.avatar_url, 
                      currentUserProfile.full_name,
                      currentUserProfile.username
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <textarea
                      ref={textareaRef}
                      value={newComment}
                      onChange={handleTextChange}
                      onKeyDown={(e) => {
                        if (!showMentions || mentionUsers.length === 0) {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                          }
                          return;
                        }
                        
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
                        } else if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSelectMention(mentionUsers[selectedMentionIndex]);
                        } else if (e.key === 'Escape') {
                          setShowMentions(false);
                        }
                      }}
                      placeholder={replyingTo ? `Rispondi...` : `Scrivi un commento...`}
                      className="w-full bg-transparent border-none focus:outline-none resize-none text-[15px] min-h-[44px] max-h-[120px] leading-relaxed cognitive-text-primary placeholder:cognitive-text-secondary"
                      maxLength={500}
                      rows={1}
                      style={{ 
                        height: 'auto',
                        overflowY: newComment.split('\n').length > 4 ? 'scroll' : 'hidden'
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
                    
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex gap-3">
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
                      
                      <Button
                        onClick={handleSubmit}
                        disabled={!newComment.trim() || addComment.isPending || isUploading}
                        size="sm"
                        className="rounded-full px-5 py-2 font-semibold h-9"
                      >
                        {addComment.isPending ? 'Invio...' : (replyingTo ? 'Rispondi' : 'Pubblica')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {viewerMedia && (
        <MediaViewer
          media={viewerMedia}
          initialIndex={viewerInitialIndex}
          onClose={() => setViewerMedia(null)}
        />
      )}

      {showQuiz && quizData && (
        <QuizModal
          questions={quizData.questions}
          onSubmit={async (answers: Record<string, string>) => {
            quizData.onSuccess();
            setShowQuiz(false);
            setQuizData(null);
            return { passed: true, wrongIndexes: [] };
          }}
          onCancel={() => {
            quizData.onCancel();
            setShowQuiz(false);
            setQuizData(null);
          }}
          provider="gemini"
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
      className={cn(
        "cognitive-comment-item",
        comment.level > 0 && "border-l-2 border-l-muted"
      )}
      style={{ 
        marginLeft: comment.level > 0 ? `${comment.level * 24}px` : '0'
      }}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {getUserAvatar(comment.author.avatar_url, comment.author.full_name, comment.author.username)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm cognitive-text-primary">
              {comment.author.full_name || getDisplayUsername(comment.author.username)}
            </span>
            <span className="cognitive-text-secondary text-xs">
              @{getDisplayUsername(comment.author.username)}
            </span>
            <span className="cognitive-text-secondary text-xs">·</span>
            <span className="cognitive-text-secondary text-xs">
              {formatDistanceToNow(new Date(comment.created_at), {
                addSuffix: true,
                locale: it
              })}
            </span>
          </div>

          <div className="text-sm cognitive-text-primary mb-2">
            <MentionText content={comment.content} />
          </div>

          {comment.media && comment.media.length > 0 && (
            <div className="mb-2">
              <MediaGallery
                media={comment.media}
                onClick={onMediaClick}
              />
            </div>
          )}

          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={handleLike}
              className="flex items-center gap-1.5 text-xs cognitive-text-secondary hover:text-primary transition-colors"
            >
              <Heart
                className={cn(
                  "w-4 h-4",
                  reactions?.likedByMe && "fill-primary text-primary"
                )}
              />
              {reactions?.likesCount || 0}
            </button>

            <button
              onClick={onReply}
              className="text-xs cognitive-text-secondary hover:text-primary transition-colors"
            >
              Rispondi
            </button>

            {currentUserId === comment.author.id && (
              <button
                onClick={onDelete}
                className="text-xs text-destructive hover:underline"
              >
                Elimina
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

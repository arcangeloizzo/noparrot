import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Heart, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useComments, useAddComment, useDeleteComment } from '@/hooks/useComments';
import { useFocusComments, useAddFocusComment, useDeleteFocusComment } from '@/hooks/useFocusComments';
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
import { LOGO_BASE } from '@/config/brand';
import { getWordCount, getTestModeWithSource } from '@/lib/gate-utils';
import { generateQA, fetchArticlePreview } from '@/lib/ai-helpers';
import { addBreadcrumb } from '@/lib/crashBreadcrumbs';
import { useLongPress } from '@/hooks/useLongPress';
import { ReactionPicker, type ReactionType, reactionToEmoji } from '@/components/ui/reaction-picker';
import { ReactionSummary, getReactionCounts } from '@/components/feed/ReactionSummary';
import { haptics } from '@/lib/haptics';

interface CommentsDrawerProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  mode: 'view' | 'reply';
  /** Scroll to specific comment when opening drawer from notification */
  scrollToCommentId?: string;
}

export const CommentsDrawer = ({ post, isOpen, onClose, mode, scrollToCommentId }: CommentsDrawerProps) => {
  const { user } = useAuth();
  
  // [FIX] Check for sources - include both URL-based sources AND media with OCR text
  const postMediaWithExtractedText = (post as any).media?.find((m: any) => 
    m.extracted_status === 'done' && 
    m.extracted_text && 
    m.extracted_text.length > 120
  );
  const postHasSource = !!post.shared_url || !!postMediaWithExtractedText;
  const isFocusContent = post.shared_url === 'focus://internal';
  
  // Determine focus type from post data
  const focusType: 'daily' | 'interest' = post.author?.username === 'Daily Focus' ? 'daily' : 'interest';
  
  // Use appropriate hooks based on content type
  const { data: regularComments = [], isLoading: regularLoading } = useComments(post.id);
  const { data: focusComments = [], isLoading: focusLoading } = useFocusComments(
    isFocusContent ? post.id : '', 
    focusType
  );
  
  const comments = isFocusContent ? focusComments : regularComments;
  const isLoading = isFocusContent ? focusLoading : regularLoading;
  
  const addComment = useAddComment();
  const addFocusComment = useAddFocusComment();
  const deleteComment = useDeleteComment();
  const deleteFocusComment = useDeleteFocusComment();
  const toggleReaction = useToggleCommentReaction();
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
  const [contentCategory, setContentCategory] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerContainerRef = useRef<HTMLDivElement>(null);
  const { data: mentionUsers = [], isLoading: isSearching } = useUserSearch(mentionQuery);
  const { uploadMedia, uploadedMedia, removeMedia, clearMedia, isUploading } = useMediaUpload();
  
  // Stati per la scelta del tipo di commento
  const [showCommentTypeChoice, setShowCommentTypeChoice] = useState(false);
  const [selectedCommentType, setSelectedCommentType] = useState<'spontaneous' | 'informed' | null>(null);
  const [isProcessingGate, setIsProcessingGate] = useState(false);

  console.log('[CommentsDrawer] Current state:', {
    postHasSource,
    postSharedUrl: post.shared_url,
    postId: post.id,
    isFocusContent,
    focusType,
    selectedCommentType,
    showCommentTypeChoice,
    isProcessingGate,
    showQuiz,
    hasQuizData: !!quizData,
    isDrawerOpen: isOpen
  });

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

  // Scroll to specific comment when coming from notification
  useEffect(() => {
    if (isOpen && scrollToCommentId && !isLoading && comments.length > 0) {
      // Wait for render then scroll
      setTimeout(() => {
        const commentElement = document.getElementById(`comment-${scrollToCommentId}`);
        if (commentElement) {
          commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add highlight effect
          commentElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
          setTimeout(() => {
            commentElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
          }, 2000);
        }
      }, 300);
    }
  }, [isOpen, scrollToCommentId, isLoading, comments.length]);

  // Reset completo dello stato quando il drawer si chiude
  useEffect(() => {
    if (!isOpen) {
      setSelectedCommentType(null);
      setShowCommentTypeChoice(false);
      setIsProcessingGate(false);
      setShowQuiz(false);
      setQuizData(null);
      setNewComment('');
      setReplyingTo(null);
      console.log('[CommentsDrawer] State reset on close');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!newComment.trim() || addComment.isPending || addFocusComment.isPending || isProcessing) return;

    const linkUrl = extractFirstUrl(newComment);
    
    // Determina il valore di passed_gate in base al tipo di commento selezionato
    const passedGate = selectedCommentType === 'informed';

    const doSubmit = async () => {
      const parentComment = replyingTo ? comments.find((c: any) => c.id === replyingTo) : null;

      let commentId: string;
      
      if (isFocusContent) {
        // Use focus comments for Focus content
        commentId = await addFocusComment.mutateAsync({
          focusId: post.id,
          focusType,
          content: newComment.trim(),
          parentId: replyingTo,
          level: parentComment ? parentComment.level + 1 : 0,
          isVerified: passedGate,
        });
      } else {
        // Use regular comments for posts
        commentId = await addComment.mutateAsync({
          postId: post.id,
          content: newComment.trim(),
          parentId: replyingTo,
          level: parentComment ? parentComment.level + 1 : 0,
          passedGate,
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
      }

      setNewComment('');
      setShowMentions(false);
      setMentionQuery('');
      setReplyingTo(null);
      setSelectedCommentType(null);
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
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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
  
  // Reset scelta quando chiude il drawer
  useEffect(() => {
    if (!isOpen) {
      setSelectedCommentType(null);
      setShowCommentTypeChoice(false);
      setIsProcessingGate(false);
    }
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
          className="w-8 h-8 rounded-full object-cover"
        />
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-primary/60 flex items-center justify-center text-xs font-semibold text-primary-foreground">
        {getInitials(displayName)}
      </div>
    );
  };

  return (
    <>
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[90vh] bg-[#0A0F14]/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl pb-[env(safe-area-inset-bottom)]">
          {/* Drawer handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-white/20 rounded-full" />
          </div>
          
          {/* Header */}
          <DrawerHeader className="border-b border-white/[0.06] sticky top-0 bg-[#0A0F14]/95 backdrop-blur-xl z-20 pt-2 pb-4">
            <DrawerTitle className="text-center text-lg font-semibold text-foreground mb-4">
              Commenti
            </DrawerTitle>
            
            {/* Post Preview - Compact card */}
            <div className="mx-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="flex gap-2.5">
                <div className="flex-shrink-0">
                  {getUserAvatar(post.author.avatar_url, post.author.full_name || post.author.username)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">
                      {post.author.full_name || getDisplayUsername(post.author.username)}
                    </span>
                  </div>
                  
                  {post.preview_img && (
                    <div className="flex gap-2 mt-1.5">
                      <img 
                        src={post.preview_img}
                        className="w-14 h-14 object-cover rounded-lg"
                        alt=""
                      />
                      <p className="text-xs text-foreground/70 line-clamp-3 leading-relaxed flex-1">
                        <MentionText content={post.content} />
                      </p>
                    </div>
                  )}
                  
                  {!post.preview_img && (
                    <p className="text-xs text-foreground/70 line-clamp-2 mt-0.5 leading-relaxed">
                      <MentionText content={post.content} />
                    </p>
                  )}
                </div>
              </div>
            </div>
          </DrawerHeader>

          {/* Comment type indicator badge */}
          {selectedCommentType && (
            <div className="mx-4 my-2 px-4 py-2.5 bg-white/[0.03] rounded-xl border border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedCommentType === 'informed' ? (
                  <img 
                    src={LOGO_BASE}
                    alt="Consapevole"
                    className="w-5 h-5"
                  />
                ) : (
                  <MessageCircle className="w-5 h-5 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-foreground/80">
                  {selectedCommentType === 'spontaneous' ? 'Commento spontaneo' : 'Commento consapevole'}
                </span>
              </div>
              <button 
                onClick={() => {
                  setSelectedCommentType(null);
                  setNewComment("");
                }}
                className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
              >
                Cambia
              </button>
            </div>
          )}

          {/* Comments List - Scrollable area with urban texture */}
          <div className="flex-1 overflow-y-auto px-3 py-4 relative">
            {/* Urban texture overlay */}
            <div className="absolute inset-0 urban-texture opacity-[0.04] pointer-events-none" />
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 relative z-10">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">Caricamento commenti...</span>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-16 px-6 relative z-10">
                <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p className="text-foreground/80 font-medium mb-1">Nessun commento</p>
                <p className="text-sm text-muted-foreground">
                  Sii il primo a entrare nella conversazione
                </p>
              </div>
            ) : (
              <div className="space-y-1 relative z-10">
                {comments.map((comment: any) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    currentUserId={user?.id}
                    onReply={() => {
                      setReplyingTo(comment.id);
                      setTimeout(() => textareaRef.current?.focus(), 100);
                    }}
                    onLike={(commentId, mode, reactionType) => {
                      toggleReaction.mutate({ commentId, mode, reactionType });
                    }}
                    onDelete={() => {
                      if (isFocusContent) {
                        deleteFocusComment.mutate({ commentId: comment.id, focusId: post.id, focusType });
                      } else {
                        deleteComment.mutate(comment.id);
                      }
                    }}
                    onMediaClick={(media, index) => {
                      setViewerMedia(comment.media || []);
                      setViewerInitialIndex(index);
                    }}
                    getUserAvatar={getUserAvatar}
                    postHasSource={postHasSource}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Fixed Bottom Composer - Compact inline style */}
          <div className="sticky bottom-0 bg-[#0D1318] border-t border-white/[0.06] z-30 pb-[env(safe-area-inset-bottom)]">
            <div className="px-3 py-3">
              {/* Reply indicator */}
              {replyingTo && (
                <div className="mb-2 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20 flex items-center justify-between">
                  <span className="text-xs text-foreground/80">
                    In risposta a <span className="text-primary font-medium">{comments.find(c => c.id === replyingTo)?.author.full_name || ''}</span>
                  </span>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
                  >
                    Annulla
                  </button>
                </div>
              )}
              
              {/* Compact composer row */}
              <div className="flex gap-2 items-center" ref={composerContainerRef}>
                {/* Current user avatar */}
                <div className="flex-shrink-0">
                  {currentUserProfile && getUserAvatar(
                    currentUserProfile.avatar_url, 
                    currentUserProfile.full_name,
                    currentUserProfile.username
                  )}
                </div>
                
                {/* Input with inline media icon */}
                <div className={cn(
                  "flex-1 flex items-center gap-2 rounded-full border transition-all duration-200",
                  "bg-[#1A2328] border-white/[0.08]",
                  "focus-within:border-primary/30"
                )}>
                  <textarea
                    ref={textareaRef}
                    value={newComment}
                    onChange={handleTextChange}
                    onFocus={() => {
                      if (postHasSource && selectedCommentType === null && !showCommentTypeChoice) {
                        setShowCommentTypeChoice(true);
                        textareaRef.current?.blur();
                      }
                    }}
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
                    placeholder={
                      selectedCommentType === null && postHasSource
                        ? "Scegli come entrare..."
                        : "Scrivi un commento..."
                    }
                    className={cn(
                      "flex-1 bg-transparent border-none focus:outline-none focus:ring-0 resize-none",
                      "text-sm text-foreground placeholder:text-muted-foreground/50",
                      "min-h-[42px] py-3 pl-4 pr-2",
                      postHasSource && selectedCommentType === null && "opacity-50 cursor-not-allowed"
                    )}
                    maxLength={500}
                    rows={1}
                    style={{ overflow: 'hidden' }}
                  />
                  
                  {/* Media button inline */}
                  <div className="flex-shrink-0 pr-1">
                    <MediaUploadButton
                      type="image"
                      onFilesSelected={(files) => uploadMedia(files, 'image')}
                      maxFiles={4}
                      disabled={isUploading}
                    />
                  </div>
                </div>
                
                {/* Send button */}
                <Button
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || addComment.isPending}
                  size="sm"
                  className={cn(
                    "rounded-full px-5 h-[42px] font-semibold text-sm",
                    "bg-primary/90 hover:bg-primary",
                    "disabled:opacity-40 disabled:bg-primary/40"
                  )}
                >
                  {addComment.isPending ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Invia'
                  )}
                </Button>
              </div>
              
              {/* Media preview */}
              {uploadedMedia.length > 0 && (
                <div className="mt-2 pl-11">
                  <MediaPreviewTray
                    media={uploadedMedia}
                    onRemove={removeMedia}
                  />
                </div>
              )}
              
              {/* Mention dropdown */}
              {showMentions && (
                <div className="relative mt-2 pl-11">
                  <MentionDropdown
                    users={mentionUsers}
                    selectedIndex={selectedMentionIndex}
                    onSelect={handleSelectMention}
                    isLoading={isSearching}
                    position="below"
                    containerRef={composerContainerRef}
                  />
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Choice UI - Dialog with immersive style */}
      <Dialog open={showCommentTypeChoice} onOpenChange={setShowCommentTypeChoice}>
        <DialogContent className="sm:max-w-md bg-[#0E1419] border border-white/10 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-center text-xl text-foreground">Come vuoi entrare nella conversazione?</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              Scegli il tuo approccio
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 pt-2">
            {/* Opzione Spontaneo - Card */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Spontaneo button] Clicked');
                setSelectedCommentType('spontaneous');
                setShowCommentTypeChoice(false);
                setTimeout(() => textareaRef.current?.focus(), 150);
              }}
              className="w-full p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.15] transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-white/[0.05] group-hover:bg-white/[0.08] transition-colors">
                  <MessageCircle className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[15px] text-foreground mb-0.5">Partecipa subito</p>
                  <p className="text-sm text-muted-foreground/80">
                    Rispondi direttamente, senza consultare la fonte
                  </p>
                </div>
              </div>
            </button>
            
            {/* Opzione Consapevole - Card con Glow */}
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Consapevole button] Clicked', { 
                  hasSharedUrl: !!post.shared_url, 
                  sharedUrl: post.shared_url,
                  hasMediaOCR: !!postMediaWithExtractedText,
                  isProcessing: isProcessingGate,
                  newCommentLength: newComment.length
                });
                
                // [FIX] Allow if has URL OR media with OCR
                if (!post.shared_url && !postMediaWithExtractedText) {
                  sonnerToast.error("Questo post non ha una fonte da verificare");
                  setShowCommentTypeChoice(false);
                  return;
                }
                
                setShowCommentTypeChoice(false);
                setIsProcessingGate(true);
                
                try {
                  // Calcola word count e testMode
                  const userWordCount = getWordCount(newComment);
                  const testMode = getTestModeWithSource(userWordCount);
                  
                  sonnerToast.info("Sto preparando ciò che ti serve per orientarti…");
                  
                  // [FIX] Handle media OCR case - use media text directly
                  if (postMediaWithExtractedText && !post.shared_url) {
                    // Post has media with OCR but no URL - generate QA from media
                    const result = await generateQA({
                      contentId: post.id,
                      title: '',
                      qaSourceRef: { kind: 'mediaId', id: postMediaWithExtractedText.id },
                      userText: newComment,
                      sourceUrl: undefined,
                      testMode: 'SOURCE_ONLY', // For media, always SOURCE_ONLY
                    });
                    
                    if (result.insufficient_context || result.error || !result.questions) {
                      sonnerToast.error(result.error || "Contenuto insufficiente per il quiz");
                      setIsProcessingGate(false);
                      return;
                    }
                    
                    setQuizData({
                      qaId: result.qaId,
                      questions: result.questions,
                      sourceUrl: `media://${postMediaWithExtractedText.id}`,
                    });
                    setShowQuiz(true);
                    setIsProcessingGate(false);
                    return;
                  }
                  
                  // URL-based source (existing logic)
                  const isFocusContent = post.shared_url === 'focus://internal';
                  let fullContent = '';
                  let contentTitle = '';
                  let externalPreview: any = null;
                  
                  if (isFocusContent && post.article_content) {
                    // È un Focus - usa direttamente article_content (deep_content)
                    fullContent = post.article_content;
                    contentTitle = post.shared_title || '';
                    console.log('[CommentsDrawer] Using Focus deep_content:', fullContent.substring(0, 100));
                  } else {
                    // Post normale - fetch articolo esterno
                    externalPreview = await fetchArticlePreview(post.shared_url!);
                    
                    if (!externalPreview) {
                      sonnerToast.error("Impossibile recuperare il contenuto della fonte");
                      setIsProcessingGate(false);
                      return;
                    }
                    
                    fullContent = externalPreview.content || externalPreview.summary || externalPreview.excerpt || '';
                    contentTitle = externalPreview.title || post.shared_title || '';
                    console.log('[CommentsDrawer] External preview qaSourceRef:', externalPreview.qaSourceRef);
                  }
                  
                  sonnerToast.info(`Sto creando le domande giuste per capire davvero…`);
                  
                  // Generate Q&A with new logic
                  // Use qaSourceRef for external sources (Spotify, YouTube, etc.)
                  // Use summary only for internal Focus content
                  const result = await generateQA({
                    contentId: post.id,
                    title: contentTitle,
                    summary: isFocusContent ? fullContent : undefined,
                    qaSourceRef: !isFocusContent ? externalPreview?.qaSourceRef : undefined,
                    userText: newComment,
                    sourceUrl: post.shared_url!,
                    testMode,
                  });
                  
                  if (result.insufficient_context) {
                    sonnerToast.error("Contenuto troppo breve per generare il quiz");
                    setIsProcessingGate(false);
                    return;
                  }
                  
                  if (result.error || !result.questions) {
                    sonnerToast.error(result.error || "Errore generazione quiz");
                    setIsProcessingGate(false);
                    return;
                  }
                  
                  // Show quiz - include qaId for server validation
                  setQuizData({
                    qaId: result.qaId,
                    questions: result.questions,
                    sourceUrl: post.shared_url
                  });
                  setShowQuiz(true);
                  
                } catch (error) {
                  console.error("Error running informed comment gate:", error);
                  sonnerToast.error("Errore durante la verifica del contenuto");
                } finally {
                  setIsProcessingGate(false);
                }
              }}
              disabled={isProcessingGate}
              className="w-full p-4 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(10,122,255,0.15)] transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <img 
                    src={LOGO_BASE} 
                    alt="Consapevole" 
                    className="w-7 h-7"
                  />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[15px] text-foreground mb-0.5">
                    Entra con consapevolezza
                  </p>
                  <p className="text-sm text-muted-foreground/80">
                    Leggi la fonte prima. Il tuo commento porterà il segno NoParrot
                  </p>
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {viewerMedia && (
        <MediaViewer
          media={viewerMedia}
          initialIndex={viewerInitialIndex}
          onClose={() => setViewerMedia(null)}
        />
      )}

      {showQuiz && quizData && !quizData.error && quizData.questions && (() => {
        // Capture questions in a stable reference for the onSubmit callback
        const questionsSnapshot = [...quizData.questions];
        const isFocusContent = quizData.sourceUrl === 'focus://internal';
        
        return createPortal(
          <QuizModal
            questions={questionsSnapshot}
            qaId={quizData.qaId}
            onSubmit={async (answers: Record<string, string>) => {
              try {
                // SECURITY HARDENED: All validation via submit-qa edge function
                // For Focus items, use sourceUrl-based validation
                const sourceUrl = isFocusContent 
                  ? `focus://${post.id}` 
                  : quizData.sourceUrl;
                
                const { data, error } = await supabase.functions.invoke('submit-qa', {
                  body: {
                    qaId: quizData.qaId,
                    postId: isFocusContent ? null : post.id,
                    sourceUrl: sourceUrl,
                    answers,
                    gateType: 'comment'
                  }
                });

                if (error) {
                  console.error('[QuizModal] Validation error:', error);
                  sonnerToast.error("Errore durante la validazione del quiz");
                  addBreadcrumb('quiz_closed', { via: 'validation_error' });
                  setShowQuiz(false);
                  setQuizData(null);
                  return { passed: false, wrongIndexes: [] };
                }

                const total = questionsSnapshot.length;
                const passed = data?.passed || false;
                const wrongIndexes = data?.wrongIndexes || [];
                const score = data?.score || 0;
                
                console.log('[CommentsDrawer] Server validation:', { score, total, passed, wrongIndexes });
                
                if (!passed) {
                  sonnerToast.error('Non ancora chiaro. Puoi comunque fare un commento spontaneo.');
                  addBreadcrumb('quiz_closed', { via: 'failed' });
                  setShowQuiz(false);
                  setQuizData(null);
                  return { passed: false, score, total, wrongIndexes };
                }

                sonnerToast.success('Hai fatto chiarezza. Il tuo commento avrà il segno di NoParrot.');
                setSelectedCommentType('informed');
                addBreadcrumb('quiz_closed', { via: 'passed' });
                setShowQuiz(false);
                setQuizData(null);
                setTimeout(() => textareaRef.current?.focus(), 150);
                return { passed: true, score, total, wrongIndexes };
              } catch (err) {
                console.error('[QuizModal] Unexpected error:', err);
                sonnerToast.error("Errore durante la validazione del quiz");
                addBreadcrumb('quiz_closed', { via: 'error' });
                setShowQuiz(false);
                setQuizData(null);
                return { passed: false, wrongIndexes: [] };
              }
            }}
            onCancel={() => {
              sonnerToast.info("Puoi fare un commento spontaneo.");
              addBreadcrumb('quiz_closed', { via: 'cancelled' });
              setShowQuiz(false);
              setQuizData(null);
            }}
            provider="gemini"
            postCategory={post.category}
          />,
          document.body
        );
      })()}
      
      {/* Error state for quiz loading failure */}
      {showQuiz && quizData?.error && createPortal(
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-md p-8 text-center shadow-2xl border border-border">
            <h2 className="text-xl font-bold mb-4 text-foreground">Errore</h2>
            <p className="text-muted-foreground mb-6">{quizData.errorMessage || 'Impossibile caricare il quiz'}</p>
            <Button 
              onClick={() => {
                if (quizData.onCancel) quizData.onCancel();
                setShowQuiz(false);
                setQuizData(null);
              }} 
              variant="outline" 
              className="w-full"
            >
              Chiudi
            </Button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

interface CommentItemProps {
  comment: any;
  currentUserId?: string;
  onReply: () => void;
  onLike: (commentId: string, mode: 'add' | 'remove' | 'update', reactionType: ReactionType) => void;
  onDelete: () => void;
  onMediaClick: (media: any, index: number) => void;
  getUserAvatar: (avatarUrl: string | null | undefined, name: string | undefined, username?: string) => JSX.Element;
  postHasSource?: boolean;
}

const CommentItem = ({ comment, currentUserId, onReply, onLike, onDelete, onMediaClick, getUserAvatar, postHasSource }: CommentItemProps) => {
  const { data: reactions } = useCommentReactions(comment.id);
  const toggleReaction = useToggleCommentReaction();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const likeButtonRef = useRef<HTMLButtonElement>(null);

  const handleLike = (reactionType: ReactionType = 'heart') => {
    haptics.light();
    const liked = reactions?.likedByMe || false;
    const prevType = (reactions?.myReactionType ?? 'heart') as ReactionType;
    const mode: 'add' | 'remove' | 'update' = !liked ? 'add' : prevType === reactionType ? 'remove' : 'update';
    toggleReaction.mutate({
      commentId: comment.id,
      mode,
      reactionType
    });
  };

  const likeHandlers = useLongPress({
    onLongPress: () => setShowReactionPicker(true),
    onTap: () => handleLike('heart'),
  });

  return (
    <div 
      id={`comment-${comment.id}`}
      className={cn(
        "py-3 px-1",
        comment.level > 0 && "ml-6 pl-3 border-l-2 border-gradient-to-b from-primary/40 to-primary/10"
      )}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {getUserAvatar(comment.author.avatar_url, comment.author.full_name, comment.author.username)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-sm text-foreground">
              {comment.author.full_name || getDisplayUsername(comment.author.username)}
            </span>
            <span className="text-muted-foreground/50 text-xs">
              · {formatDistanceToNow(new Date(comment.created_at), {
                addSuffix: false,
                locale: it
              })}
            </span>
            {postHasSource && (comment.passed_gate || comment.is_verified) && (
              <img 
                src={LOGO_BASE}
                alt="Consapevole"
                className="w-4 h-4"
              />
            )}
          </div>

          <div className="text-sm text-foreground/90 mb-1 leading-relaxed">
            <MentionText content={comment.content} />
          </div>

          {/* Reaction Summary for multiple reaction types */}
          {reactions && reactions.likesCount > 0 && 
           Object.keys(reactions.byType || {}).length > 1 && (
            <div className="mb-2">
              <ReactionSummary
                reactions={getReactionCounts(reactions.byType)}
                totalCount={reactions.likesCount}
                showCount={false}
                className="text-xs"
              />
            </div>
          )}

          {comment.media && comment.media.length > 0 && (
            <div className="mb-2">
              <MediaGallery
                media={comment.media}
                onClick={onMediaClick}
              />
            </div>
          )}

          <div className="flex items-center gap-4 mt-2 action-bar-zone">
            <div className="relative">
              <button
                ref={likeButtonRef}
                {...likeHandlers}
                className="flex items-center gap-1.5 text-xs cognitive-text-secondary hover:text-destructive transition-colors active:scale-90 select-none"
                style={{ WebkitTapHighlightColor: 'transparent', WebkitUserSelect: 'none' }}
              >
                {reactions?.myReactionType && reactions.myReactionType !== 'heart' ? (
                  <span className="text-base">{reactionToEmoji(reactions.myReactionType)}</span>
                ) : (
                  <Heart
                    className={cn(
                      "w-4 h-4",
                      reactions?.likedByMe && "fill-destructive text-destructive"
                    )}
                  />
                )}
                {reactions?.likesCount || 0}
              </button>
              <ReactionPicker
                isOpen={showReactionPicker}
                onClose={() => setShowReactionPicker(false)}
                onSelect={(type) => {
                  handleLike(type);
                  setShowReactionPicker(false);
                }}
                currentReaction={reactions?.myReactionType}
                triggerRef={likeButtonRef}
              />
            </div>

            <button
              onClick={onReply}
              className="text-xs cognitive-text-secondary hover:text-primary transition-colors select-none"
              style={{ WebkitTapHighlightColor: 'transparent' }}
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

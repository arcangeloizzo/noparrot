import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Heart, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { LOGO_BASE } from '@/config/brand';
import { getWordCount, getTestModeWithSource } from '@/lib/gate-utils';
import { generateQA, fetchArticlePreview } from '@/lib/ai-helpers';

interface CommentsDrawerProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  mode: 'view' | 'reply';
}

export const CommentsDrawer = ({ post, isOpen, onClose, mode }: CommentsDrawerProps) => {
  const { user } = useAuth();
  const postHasSource = !!post.shared_url;
  
  const { data: comments = [], isLoading } = useComments(post.id);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
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
    if (!newComment.trim() || addComment.isPending || isProcessing) return;

    const linkUrl = extractFirstUrl(newComment);
    
    // Determina il valore di passed_gate in base al tipo di commento selezionato
    const passedGate = selectedCommentType === 'informed';

    const doSubmit = async () => {
      const parentComment = replyingTo ? comments.find(c => c.id === replyingTo) : null;

      const commentId = await addComment.mutateAsync({
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
      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
        {getInitials(displayName)}
      </div>
    );
  };

  return (
    <>
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[90vh] cognitive-drawer pb-[env(safe-area-inset-bottom)]">
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

          {/* Badge indicatore tipo commento selezionato */}
          {selectedCommentType && (
            <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedCommentType === 'informed' ? (
                  <img 
                    src={LOGO_BASE}
                    alt="Consapevole"
                    className="w-5 h-5"
                  />
                ) : (
                  <MessageCircle className="w-5 h-5" />
                )}
                <span className="text-sm font-medium">
                  {selectedCommentType === 'spontaneous' ? 'Commento spontaneo' : 'Commento consapevole'}
                </span>
              </div>
              <button 
                onClick={() => {
                  setSelectedCommentType(null);
                  setNewComment("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cambia
              </button>
            </div>
          )}

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
                    onLike={(commentId, isLiked) => {
                      toggleReaction.mutate({ commentId, isLiked });
                    }}
                    onDelete={() => deleteComment.mutate(comment.id)}
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

          {/* Fixed Bottom Composer */}
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border z-30">
            <div className="px-4 py-3">
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
              <div className="cognitive-comment-composer">
                <div className="flex gap-3 items-start relative">
                  <div className="flex-shrink-0 pt-1">
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
                      onFocus={() => {
                        // Se il post ha source E non abbiamo ancora scelto, mostra la scelta
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
                          ? "👆 Scegli come vuoi entrare nella conversazione."
                          : replyingTo 
                          ? `Rispondi...` 
                          : `Aggiungi un commento...`
                      }
                      className={cn(
                        "w-full bg-transparent border-none focus:outline-none resize-none text-[15px] min-h-[40px] max-h-[120px] leading-normal",
                        postHasSource && selectedCommentType === null && "opacity-60 cursor-not-allowed"
                      )}
                      maxLength={500}
                      rows={2}
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
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex gap-2">
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
                        disabled={!newComment.trim() || addComment.isPending}
                        size="sm"
                        className="rounded-full px-4 font-bold"
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

      {/* Choice UI - Dialog */}
      <Dialog open={showCommentTypeChoice} onOpenChange={setShowCommentTypeChoice}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Come vuoi entrare nella conversazione?</DialogTitle>
            <DialogDescription className="text-center">
              Scegli il tuo approccio
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
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
              className="w-full p-5 rounded-2xl border-2 border-[hsl(var(--cognitive-light))] hover:border-[hsl(var(--cognitive-light))] hover:bg-muted/20 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <MessageCircle className="w-10 h-10 text-muted-foreground transition-transform group-hover:scale-110 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold text-base mb-2">Partecipa subito</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Rispondi in modo diretto, senza consultare la fonte.
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
                  isProcessing: isProcessingGate,
                  newCommentLength: newComment.length
                });
                
                if (!post.shared_url) {
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
                  
                  // Fetch article preview
                  const preview = await fetchArticlePreview(post.shared_url);
                  
                  if (!preview) {
                    sonnerToast.error("Impossibile recuperare il contenuto della fonte");
                    setIsProcessingGate(false);
                    return;
                  }
                  
                  sonnerToast.info(`Sto creando le domande giuste per capire davvero…`);
                  
                  // Generate Q&A with new logic
                  const fullContent = preview.content || preview.summary || preview.excerpt || '';
                  const result = await generateQA({
                    contentId: post.id,
                    title: preview.title || post.shared_title || '',
                    summary: fullContent,
                    userText: newComment,
                    sourceUrl: post.shared_url,
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
                  
                  // Show quiz
                  setQuizData({
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
              className="w-full p-5 rounded-2xl border-2 border-[hsl(var(--cognitive-correct))] hover:border-[hsl(var(--cognitive-glow-blue))] hover:shadow-[0_0_12px_4px_rgba(10,122,255,0.3)] hover:bg-[hsl(var(--cognitive-glow-blue))]/5 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-4">
                <img 
                  src={LOGO_BASE} 
                  alt="Consapevole" 
                  className="w-10 h-10 transition-transform group-hover:scale-110 flex-shrink-0"
                />
                <div className="flex-1">
                  <p className="font-bold text-base mb-2 flex items-center gap-2">
                    Entra con consapevolezza 🧠
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Leggi la fonte e procedi con il percorso. Il tuo commento porterà il segno di NoParrot.
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

      {showQuiz && quizData && createPortal(
        <QuizModal
          questions={quizData.questions}
          onSubmit={async (answers: Record<string, string>) => {
            try {
              const { data, error } = await supabase.functions.invoke('validate-answers', {
                body: {
                  postId: post.id,
                  sourceUrl: quizData.sourceUrl,
                  answers,
                  gateType: 'comment'
                }
              });

              if (error) {
                console.error('[QuizModal] Validation error:', error);
                sonnerToast.error("Errore durante la validazione del quiz");
                setShowQuiz(false);
                setQuizData(null);
                return { passed: false, wrongIndexes: [] };
              }

              const actualPassed = data.passed && (data.total - data.score) <= 2;
              
              if (!actualPassed) {
                console.log('[QuizModal] Quiz failed:', data);
                sonnerToast.error('Serve ancora un po\' di chiarezza. Puoi comunque fare un commento spontaneo.');
                setShowQuiz(false);
                setQuizData(null);
                return { passed: false, wrongIndexes: data?.wrongIndexes || [] };
              }

              console.log('[QuizModal] Quiz passed!');
              sonnerToast.success('Possiamo procedere. Il tuo commento avrà il segno di NoParrot.');
              setSelectedCommentType('informed');
              setShowQuiz(false);
              setQuizData(null);
              setTimeout(() => textareaRef.current?.focus(), 150);
              return { passed: true, wrongIndexes: [] };
            } catch (err) {
              console.error('[QuizModal] Unexpected error:', err);
              sonnerToast.error("Errore durante la validazione del quiz");
              setShowQuiz(false);
              setQuizData(null);
              return { passed: false, wrongIndexes: [] };
            }
          }}
          onCancel={() => {
            sonnerToast.info("Puoi fare un commento spontaneo.");
            setShowQuiz(false);
            setQuizData(null);
          }}
          provider="gemini"
          postCategory={post.category}
        />,
        document.body
      )}
    </>
  );
};

interface CommentItemProps {
  comment: any;
  currentUserId?: string;
  onReply: () => void;
  onLike: (commentId: string, isLiked: boolean) => void;
  onDelete: () => void;
  onMediaClick: (media: any, index: number) => void;
  getUserAvatar: (avatarUrl: string | null | undefined, name: string | undefined, username?: string) => JSX.Element;
  postHasSource?: boolean;
}

const CommentItem = ({ comment, currentUserId, onReply, onLike, onDelete, onMediaClick, getUserAvatar, postHasSource }: CommentItemProps) => {
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
            {postHasSource && comment.passed_gate && (
              <img 
                src={LOGO_BASE}
                alt="Consapevole"
                className="w-5 h-5 ml-1"
              />
            )}
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
              onClick={() => onLike(comment.id, reactions?.likedByMe || false)}
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

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Heart, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useComments, useAddComment, useDeleteComment } from '@/hooks/useComments';
import { useFocusComments, useAddFocusComment, useDeleteFocusComment } from '@/hooks/useFocusComments';
import { useCommentReactions } from '@/hooks/useCommentReactions';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthPrompt } from '@/hooks/useAuthPrompt';
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
import { LogoVertical } from '@/components/ui/LogoVertical';
import { getAvatarImageUrl } from "@/lib/mediaUtils";
import { getWordCount, getPostFullText, getTestModeWithSource, MIN_EXTRACTED_CHARS } from '@/lib/gate-utils';
import { generateQA, fetchArticlePreview } from '@/lib/ai-helpers';
import { addBreadcrumb } from '@/lib/crashBreadcrumbs';
import { useLongPress } from '@/hooks/useLongPress';
import { useVisualViewportOffset } from '@/hooks/useVisualViewportOffset';
import { ReactionPicker, type ReactionType, reactionToEmoji } from '@/components/ui/reaction-picker';
import { ReactionSummary, getReactionCounts } from '@/components/feed/ReactionSummary';
import { haptics } from '@/lib/haptics';
import { CommentItem } from './CommentItem';
import { getCategoryColor } from '@/config/categories';


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
  
  // [FIX] Consider the WHOLE carousel: concat all extracted_text (order_idx) and
  // compare the aggregate against the unified MIN_EXTRACTED_CHARS threshold.
  const postMediaExtracted = ((post as any).media || [])
    .filter((m: any) => m.extracted_status === 'done' && m.extracted_text)
    .sort((a: any, b: any) => (a.order_idx ?? 0) - (b.order_idx ?? 0));
  const postExtractedTotal = postMediaExtracted.reduce(
    (n: number, m: any) => n + (m.extracted_text?.length || 0), 0
  );
  const postHasMediaText = postExtractedTotal >= MIN_EXTRACTED_CHARS;
  const postPrimaryExtractedMedia = postHasMediaText ? postMediaExtracted[0] : null;
  const postHasSource = !!post.shared_url || postHasMediaText;
  const isFocusContent = post.shared_url === 'focus://internal';
  const accent = getCategoryColor((post as any).category) || '#0A7AFF';

  // [GATE ALIGNMENT] Post text-only senza fonte: se >30 parole, attiva gate
  // sulle parole del post stesso (allineato al reshare in ComposerModal).
  const postOriginalWordCount = getWordCount(getPostFullText(post));
  const postHasLongText = !postHasSource && postOriginalWordCount > 30;
  const requiresGateChoice = postHasSource || postHasLongText;
  
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
  // toggleReaction removed - CommentItem now handles reactions internally
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

  // #8 Header filter: TUTTI / CONSAPEVOLI
  const [awareOnly, setAwareOnly] = useState(false);
  const visibleComments = awareOnly
    ? (comments as any[]).filter((c: any) => c.passed_gate)
    : comments;

  const keyboardOffset = useVisualViewportOffset();
  const isKeyboardOpen = keyboardOffset > 0;

  console.log('[CommentsDrawer] Current state:', {
    postHasSource,
    postHasLongText,
    postOriginalWordCount,
    requiresGateChoice,
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
    if ((!newComment.trim() && uploadedMedia.length === 0) || addComment.isPending || addFocusComment.isPending || isProcessing) return;

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
          content: newComment.trim() || "\u200B",
          parentId: replyingTo,
          level: parentComment ? parentComment.level + 1 : 0,
          isVerified: passedGate,
        });
      } else {
        // Use regular comments for posts
        commentId = await addComment.mutateAsync({
          postId: post.id,
          content: newComment.trim() || "\u200B",
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
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
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
    
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    
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
          src={getAvatarImageUrl(avatarUrl)}
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
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} repositionInputs={false}>
        <DrawerContent 
          className={cn(
            "max-h-[90vh] rounded-t-3xl",
            !isKeyboardOpen && "pb-[env(safe-area-inset-bottom)]"
          )}
          style={{ 
            paddingBottom: isKeyboardOpen ? Math.max(0, keyboardOffset) : undefined, 
            zIndex: 60,
            background:'rgba(18,26,42,0.92)', 
            backdropFilter:'blur(26px) saturate(150%)', 
            WebkitBackdropFilter:'blur(26px) saturate(150%)', 
            boxShadow:'0 1px 0 rgba(255,255,255,0.09) inset, 0 -24px 60px rgba(0,0,0,0.6)' 
          }}
        >
          {/* Drawer handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
          </div>
          
          {/* Header */}
          <DrawerHeader className="sticky top-0 z-20 pt-2 pb-4" style={{ boxShadow:'0 1px 0 rgba(255,255,255,0.06)' }}>
            <DrawerTitle className="text-center text-lg font-semibold text-foreground mb-4">
              Commenti <span style={{ fontFamily:'var(--mono)', fontSize:'12px', color:'var(--txt-3)', fontWeight:600 }}>· {comments.length}</span>
            </DrawerTitle>

            {/* Filter pills: TUTTI / CONSAPEVOLI */}
            <div className="flex justify-center gap-2 mb-3">
              {([
                { key: 'all', label: 'TUTTI' },
                { key: 'aware', label: 'CONSAPEVOLI' },
              ] as const).map(opt => {
                const active = (opt.key === 'aware') === awareOnly;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setAwareOnly(opt.key === 'aware')}
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10,
                      letterSpacing: '0.10em',
                      fontWeight: 700,
                      padding: '5px 12px',
                      borderRadius: 999,
                      color: active ? '#0E1522' : 'var(--txt-3)',
                      background: active ? '#F2F5FA' : 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            
            {/* Post Preview - Compact card */}
            <div className="mx-2 p-3 rounded-2xl flex gap-2.5 items-stretch" style={{ background:`${accent}12`, border:`1px solid ${accent}2E` }}>
              <div style={{ width:'4px', borderRadius:'2px', background:accent, flexShrink:0 }} />
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="line-clamp-1" style={{ fontFamily:"'Anton',sans-serif", fontSize:'13.5px', textTransform:'uppercase', letterSpacing:'0.01em', lineHeight:1.2 }}>
                  {(post as any).title || post.author.full_name || getDisplayUsername(post.author.username)}
                </div>
                <p className="line-clamp-1 mt-0.5" style={{ fontSize:'12px', color:'var(--txt-3)' }}>
                  <MentionText content={post.content} />
                </p>
                {post.shared_url && !post.shared_url.startsWith('focus://') && !post.shared_url.startsWith('internal://') && (
                  <a href={post.shared_url} target="_blank" rel="noopener noreferrer"
                     className="text-primary active:opacity-60 transition-opacity mt-1 inline-block"
                     style={{ fontFamily:'var(--mono)', fontSize:'10px', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:600 }}>
                    Leggi la fonte →
                  </a>
                )}
              </div>
              {post.preview_img && (
                <img src={post.preview_img} className="w-11 h-11 object-cover rounded-lg flex-shrink-0 self-center" alt="" />
              )}
            </div>
          </DrawerHeader>

          {/* Comment type indicator badge */}
          {selectedCommentType && (
            <div className="mx-4 my-2 px-4 py-2.5 bg-muted/30 rounded-xl border border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedCommentType === 'informed' ? (
                  <LogoVertical 
                    hideText={true}
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
                <div className="w-16 h-16 rounded-full bg-muted/30 border border-border/50 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p className="text-foreground/80 font-medium mb-1">Nessun commento</p>
                <p className="text-sm text-muted-foreground">
                  Sii il primo a entrare nella conversazione
                </p>
              </div>
            ) : visibleComments.length === 0 ? (
              <div className="text-center py-16 px-6 relative z-10">
                <p className="text-foreground/80 font-medium mb-1">Nessun commento consapevole</p>
                <p className="text-sm text-muted-foreground">Cambia filtro per vedere tutti i commenti.</p>
              </div>
            ) : (
              <div className="space-y-1 relative z-10">
                {visibleComments.map((comment: any) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    currentUserId={user?.id}
                    onReply={() => {
                      setReplyingTo(comment.id);
                      setTimeout(() => textareaRef.current?.focus(), 100);
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
                    postHasLongText={postHasLongText}
                    postAuthorId={post.author?.id}
                    commentKind={isFocusContent ? 'focus' : 'post'}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Fixed Bottom Composer - Compact inline style */}
          <div className={cn("sticky bottom-0 z-30", !isKeyboardOpen && "pb-[env(safe-area-inset-bottom)]")} style={{ background:'rgba(12,18,30,0.75)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', boxShadow:'0 -1px 0 rgba(255,255,255,0.06)' }}>
            {/* #9 In-drawer gate choice panel (replaces the old Dialog) */}
            {showCommentTypeChoice && user?.id !== post.author?.id && (
              <div
                className="mx-3 mt-3 mb-2 p-3 rounded-2xl"
                style={{
                  background: 'rgba(18,26,42,0.88)',
                  backdropFilter: 'blur(22px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(22px) saturate(140%)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    letterSpacing: '0.10em',
                    color: 'var(--txt-3)',
                    textTransform: 'uppercase',
                    marginBottom: 10,
                    textAlign: 'center',
                  }}
                >
                  Come vuoi entrare nella conversazione
                </p>

                {/* Primary (order inverted): Leggi prima la fonte */}
                <button
                  disabled={isProcessingGate}
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Bypass if user already passed gate
                    if (user) {
                      const { data: existingAttempt } = await supabase
                        .from('post_gate_attempts')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('post_id', post.id)
                        .eq('passed', true)
                        .limit(1)
                        .maybeSingle();
                      if (existingAttempt) {
                        setShowCommentTypeChoice(false);
                        setSelectedCommentType('informed');
                        sonnerToast.success('Gate già superato! Puoi commentare.');
                        setTimeout(() => textareaRef.current?.focus(), 150);
                        return;
                      }
                    }

                    setShowCommentTypeChoice(false);
                    setIsProcessingGate(true);

                    // Long-text-only path
                    if (postHasLongText && !post.shared_url && !postPrimaryExtractedMedia) {
                      sonnerToast.info('Sto preparando ciò che ti serve per orientarti…');
                      await runGateBeforeAction({
                        linkUrl: `internal://post/${post.id}`,
                        intentPostContent: [(post as any).title, post.content].filter(Boolean).join('\n\n'),
                        onSuccess: () => {
                          setSelectedCommentType('informed');
                          setTimeout(() => textareaRef.current?.focus(), 150);
                        },
                        onCancel: () => setSelectedCommentType(null),
                        setIsProcessing: setIsProcessingGate,
                        setQuizData,
                        setShowQuiz,
                      });
                      return;
                    }

                    try {
                      // #1 FIX: testMode è calcolato sul TESTO DELL'AUTORE del post,
                      // NON sul commento in bozza. E userText inviato a generateQA è
                      // il testo dell'autore del post.
                      const authorText = getPostFullText(post);
                      const authorWordCount = getWordCount(authorText);
                      const testMode = getTestModeWithSource(authorWordCount);

                      sonnerToast.info('Sto preparando ciò che ti serve per orientarti…');

                      // Media OCR case (no URL)
                      if (postPrimaryExtractedMedia && !post.shared_url) {
                        const result = await generateQA({
                          contentId: post.id,
                          title: '',
                          qaSourceRef: { kind: 'mediaId', id: postPrimaryExtractedMedia.id },
                          userText: authorText, // #1 FIX
                          sourceUrl: undefined,
                          testMode: 'SOURCE_ONLY',
                        });
                        if (result.insufficient_context || result.error || !result.questions) {
                          sonnerToast.error(result.error || 'Contenuto insufficiente per il quiz');
                          setIsProcessingGate(false);
                          return;
                        }
                        setQuizData({
                          qaId: result.qaId,
                          questions: result.questions,
                          sourceUrl: `media://${postPrimaryExtractedMedia.id}`,
                        });
                        setShowQuiz(true);
                        setIsProcessingGate(false);
                        return;
                      }

                      // URL-based source
                      const isFocus = post.shared_url === 'focus://internal';
                      let fullContent = '';
                      let contentTitle = '';
                      let externalPreview: any = null;

                      if (isFocus && (post as any).article_content) {
                        fullContent = (post as any).article_content;
                        contentTitle = (post as any).shared_title || '';
                      } else {
                        externalPreview = await fetchArticlePreview(post.shared_url!);
                        if (!externalPreview) {
                          sonnerToast.error('Impossibile recuperare il contenuto della fonte');
                          setIsProcessingGate(false);
                          return;
                        }
                        fullContent = externalPreview.content || externalPreview.summary || externalPreview.excerpt || '';
                        contentTitle = externalPreview.title || (post as any).shared_title || '';
                      }

                      const result = await generateQA({
                        contentId: post.id,
                        title: contentTitle,
                        summary: isFocus ? fullContent : undefined,
                        qaSourceRef: !isFocus ? externalPreview?.qaSourceRef : undefined,
                        userText: authorText, // #1 FIX
                        sourceUrl: post.shared_url!,
                        testMode,
                      });

                      if (result.insufficient_context) {
                        sonnerToast.error('Contenuto troppo breve per generare il quiz');
                        setIsProcessingGate(false);
                        return;
                      }
                      if (result.error || !result.questions) {
                        sonnerToast.error(result.error || 'Errore generazione quiz');
                        setIsProcessingGate(false);
                        return;
                      }

                      setQuizData({
                        qaId: result.qaId,
                        questions: result.questions,
                        sourceUrl: post.shared_url,
                      });
                      setShowQuiz(true);
                    } catch (err) {
                      console.error('Error running informed comment gate:', err);
                      sonnerToast.error('Errore durante la verifica del contenuto');
                    } finally {
                      setIsProcessingGate(false);
                    }
                  }}
                  className="w-full text-left rounded-xl p-3 mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, rgba(10,122,255,0.16), rgba(10,122,255,0.05))',
                    border: '1px solid rgba(10,122,255,0.45)',
                    boxShadow: '0 0 16px rgba(10,122,255,0.20)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div style={{ padding: 8, borderRadius: 12, background: 'rgba(10,122,255,0.20)' }}>
                      <LogoVertical hideText={true} className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[14px] font-semibold text-foreground mb-0.5">Leggi prima la fonte</p>
                      <p className="text-[12px] text-muted-foreground/80">Il tuo commento porterà il segno "HA LETTO"</p>
                    </div>
                  </div>
                </button>

                {/* Secondary: Partecipa subito */}
                <button
                  disabled={isProcessingGate}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedCommentType('spontaneous');
                    setShowCommentTypeChoice(false);
                    setTimeout(() => textareaRef.current?.focus(), 150);
                  }}
                  className="w-full text-left rounded-xl p-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div style={{ padding: 8, borderRadius: 12, background: 'rgba(255,255,255,0.05)' }}>
                      <MessageCircle className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[14px] font-semibold text-foreground mb-0.5">Partecipa subito</p>
                      <p className="text-[12px] text-muted-foreground/80">Commenta senza consultare la fonte</p>
                    </div>
                  </div>
                </button>
              </div>
            )}

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
              
              {/* Mention dropdown - ABOVE the composer to stay visible with keyboard */}
              {showMentions && (
                <div className="relative mb-2 pl-11">
                  <MentionDropdown
                    users={mentionUsers}
                    selectedIndex={selectedMentionIndex}
                    onSelect={handleSelectMention}
                    isLoading={isSearching}
                    position="above"
                    containerRef={composerContainerRef}
                  />
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
                  "flex-1 flex items-center gap-2 rounded-full transition-all duration-200",
                  "focus-within:border-primary/30"
                )} style={{ background:'rgba(255,255,255,0.07)', boxShadow:'0 1px 0 rgba(255,255,255,0.07) inset' }}>
                  <textarea
                    ref={textareaRef}
                    value={newComment}
                    onChange={handleTextChange}
                    onFocus={() => {
                      // [UX FIX] Bypass gate choice if user is the post author
                      // Author doesn't need to pass gate on their own content
                      if (user?.id === post.author?.id) {
                        console.log('[CommentsDrawer] Bypassing gate choice - user is author');
                        setSelectedCommentType('informed');
                        return;
                      }
                      
                      if (requiresGateChoice && selectedCommentType === null && !showCommentTypeChoice) {
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
                      selectedCommentType === null && requiresGateChoice
                        ? "Entra nella conversazione…"
                        : "Scrivi un commento..."
                    }
                    disabled={showCommentTypeChoice && user?.id !== post.author?.id}
                    className={cn(
                      "flex-1 bg-transparent border-none focus:outline-none focus:ring-0 resize-none",
                      "text-sm text-foreground placeholder:text-muted-foreground/50",
                      "min-h-[42px] max-h-[120px] py-3 pl-4 pr-2",
                      ((requiresGateChoice && selectedCommentType === null) || showCommentTypeChoice) && "opacity-50 cursor-not-allowed"
                    )}
                    maxLength={500}
                    rows={1}
                    style={{ overflowY: newComment.length > 100 ? 'auto' : 'hidden' }}
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
                  disabled={(!newComment.trim() && uploadedMedia.length === 0) || addComment.isPending}
                  size="sm"
                  className={cn(
                    "rounded-full w-[42px] h-[42px] p-0 flex-shrink-0 disabled:opacity-40"
                  )}
                  style={{ background:'linear-gradient(135deg,#0A7AFF,#0862CC)', boxShadow:'0 6px 16px -6px rgba(10,122,255,0.55)' }}
                >
                  {addComment.isPending ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-[18px] h-[18px] text-white" />
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
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Choice UI moved in-drawer above the composer (#9). */}

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

// Local CommentItem removed - now using imported CommentItem from './CommentItem'

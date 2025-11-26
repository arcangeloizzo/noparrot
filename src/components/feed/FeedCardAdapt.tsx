import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, EyeOff, ExternalLink, ShieldCheck, ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

// UI Components
import { TrustBadge } from "@/components/ui/trust-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuizModal } from "@/components/ui/quiz-modal";

// Feed Components
import { PostTestActionsModal } from "./PostTestActionsModal";
import { QuotedPostCard } from "./QuotedPostCard";
import { PostHeader } from "./PostHeader";
import { MentionText } from "./MentionText";

// Media Components
import { MediaGallery } from "@/components/media/MediaGallery";
import { MediaViewer } from "@/components/media/MediaViewer";

// Composer Components
import { SourceReaderGate } from "../composer/SourceReaderGate";
import { CommentsDrawer } from "./CommentsDrawer";

// Share Components
import { ShareSheet } from "@/components/share/ShareSheet";
import { PeoplePicker } from "@/components/share/PeoplePicker";

// Hooks & Utils
import { Post, useQuotedPost } from "@/hooks/usePosts";
import { useToggleReaction } from "@/hooks/usePosts";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn, getDisplayUsername } from "@/lib/utils";
import { fetchTrustScore } from "@/lib/comprehension-gate";
import { generateQA, fetchArticlePreview } from "@/lib/ai-helpers";
import { supabase } from "@/integrations/supabase/client";
import { uniqueSources } from "@/lib/url";
import { useCreateThread } from "@/hooks/useMessageThreads";
import { useSendMessage } from "@/hooks/useMessages";
import { getWordCount, getTestModeWithSource, getQuestionCountWithoutSource } from "@/lib/gate-utils";

interface FeedCardProps {
  post: Post;
  onOpenReader?: () => void;
  onRemove?: () => void;
  onQuoteShare?: (post: Post) => void;
}

const getHostnameFromUrl = (url: string | undefined): string => {
  if (!url) return 'Fonte';
  try {
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    return new URL(urlWithProtocol).hostname;
  } catch {
    return 'Fonte';
  }
};

export const FeedCard = ({ 
  post, 
  onOpenReader,
  onRemove,
  onQuoteShare
}: FeedCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toggleReaction = useToggleReaction();
  const { data: quotedPost } = useQuotedPost(post.quoted_post_id);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  const createThread = useCreateThread();
  const sendMessage = useSendMessage();
  
  // Article preview state
  const [articlePreview, setArticlePreview] = useState<any>(null);
  
  // Remove swipe gesture states - no longer needed
  
  // Gate states
  const [showReader, setShowReader] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [readerSource, setReaderSource] = useState<any>(null);
  const [quizData, setQuizData] = useState<any>(null);
  
  // Comments state
  const [showComments, setShowComments] = useState(false);
  
  // Share states
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [shareAction, setShareAction] = useState<'feed' | 'friend' | null>(null);
  
  // Trust Score state
  const [trustScore, setTrustScore] = useState<{
    band: 'BASSO' | 'MEDIO' | 'ALTO';
    score: number;
    reasons?: string[];
  } | null>(null);
  const [loadingTrustScore, setLoadingTrustScore] = useState(false);
  const [showTrustTooltip, setShowTrustTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  // Fetch article preview dynamically
  useEffect(() => {
    const loadArticlePreview = async () => {
      if (!post.shared_url) {
        setArticlePreview(null);
        return;
      }
      
      try {
        const preview = await fetchArticlePreview(post.shared_url);
        if (preview) {
          setArticlePreview(preview);
        }
      } catch (error) {
        console.error('Error fetching article preview:', error);
      }
    };
    
    loadArticlePreview();
  }, [post.shared_url]);

  // Fetch trust score for posts with sources
  useEffect(() => {
    const loadTrustScore = async () => {
      if (!post.shared_url) {
        setTrustScore(null);
        return;
      }
      
      setLoadingTrustScore(true);
      try {
        const result = await fetchTrustScore({
          postText: post.content,
          sources: [post.shared_url]
        });
        if (result) {
          setTrustScore({
            band: result.band,
            score: result.score,
            reasons: result.reasons
          });
        }
      } catch (error) {
        console.error('Error fetching trust score:', error);
      } finally {
        setLoadingTrustScore(false);
      }
    };
    
    loadTrustScore();
  }, [post.shared_url, post.content]);

  const handleHeart = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleReaction.mutate({ postId: post.id, reactionType: 'heart' });
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleReaction.mutate({ postId: post.id, reactionType: 'bookmark' });
  };

  const getAvatarContent = () => {
    if (post.author.avatar_url) {
      return (
        <img 
          src={post.author.avatar_url}
          alt={post.author.full_name || post.author.username}
          className="w-full h-full object-cover"
        />
      );
    }
    
    const initial = (post.author.full_name || post.author.username).charAt(0).toUpperCase();
    const bgColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500'];
    const colorIndex = post.author.username.charCodeAt(0) % bgColors.length;
    
    return (
      <div className={`${bgColors[colorIndex]} w-full h-full flex items-center justify-center text-white font-bold text-lg`}>
        {initial}
      </div>
    );
  };

  // Swipe functions removed - using button instead

  // Share button handler - MOSTRA PRIMA LO SHEET
  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
      toast({
        title: 'Accedi per condividere',
        description: 'Devi essere autenticato',
        variant: 'destructive'
      });
      return;
    }

    // Mostra ShareSheet per far scegliere all'utente
    setShowShareSheet(true);
  };

  // Handler per condivisione nel feed
  const handleShareToFeed = async () => {
    setShareAction('feed');
    
    const userText = post.content;
    const userWordCount = getWordCount(userText);
    
    // CASO 1: Post CON fonte esterna
    if (post.shared_url) {
      await startComprehensionGate();
      return;
    }

    // CASO 2: Post SENZA fonte (contenuto originale)
    const questionCount = getQuestionCountWithoutSource(userWordCount);
    
    if (questionCount === 0) {
      // Nessun gate richiesto (≤50 parole)
      onQuoteShare?.({
        ...post,
        _originalSources: Array.isArray(post.sources) ? post.sources : []
      });
      toast({
        title: 'Post pronto per la condivisione',
        description: 'Aggiungi un tuo commento'
      });
    } else {
      // Gate richiesto (1 o 3 domande)
      toast({
        title: 'Lettura richiesta',
        description: `Leggi il post per condividerlo (${questionCount} ${questionCount === 1 ? 'domanda' : 'domande'})`
      });
      await startComprehensionGateForPost();
    }
  };

  // Handler per condivisione con amico
  const handleShareToFriend = async () => {
    setShareAction('friend');
    
    const userText = post.content;
    const userWordCount = getWordCount(userText);
    
    // CASO 1: Post CON fonte esterna
    if (post.shared_url) {
      await startComprehensionGate();
      return;
    }

    // CASO 2: Post SENZA fonte (contenuto originale)
    const questionCount = getQuestionCountWithoutSource(userWordCount);
    
    if (questionCount === 0) {
      // Nessun gate richiesto (≤50 parole)
      setShowPeoplePicker(true);
    } else {
      // Gate richiesto (1 o 3 domande)
      toast({
        title: 'Lettura richiesta',
        description: `Leggi il post per condividerlo (${questionCount} ${questionCount === 1 ? 'domanda' : 'domande'})`
      });
      await startComprehensionGateForPost();
    }
  };

  const startComprehensionGateForPost = async () => {
    if (!user) return;

    // Show reader with the post content
    setReaderSource({
      url: '', // No URL for original posts
      title: `Post di @${post.author.username}`,
      content: post.content,
      isOriginalPost: true, // Flag to distinguish from external sources
    });
    setShowReader(true);
  };

  const startComprehensionGate = async () => {
    if (!post.shared_url || !user) return;

    toast({
      title: 'Caricamento contenuto...',
      description: 'Preparazione del Comprehension Gate'
    });

    // Fetch article preview
    const preview = await fetchArticlePreview(post.shared_url);
    
    if (!preview) {
      toast({
        title: 'Errore',
        description: 'Impossibile recuperare il contenuto',
        variant: 'destructive'
      });
      return;
    }

    // Show Reader with FULL content - use content field which contains full tweet text
    setReaderSource({
      url: post.shared_url,
      title: preview.title || post.shared_title || '',
      content: preview.content || preview.summary || preview.excerpt || '',
      ...preview
    });
    setShowReader(true);
  };

  const handleReaderComplete = async () => {
    setShowReader(false);
    
    if (!readerSource || !user) return;

    // Check if it's an original post
    const isOriginalPost = readerSource.isOriginalPost;
    
    const userText = post.content;
    const userWordCount = getWordCount(userText);
    
    // Determina parametri in base al tipo di contenuto
    let testMode: 'SOURCE_ONLY' | 'MIXED' | 'USER_ONLY' | undefined;
    let questionCount: 1 | 3 | undefined;
    
    if (isOriginalPost) {
      // Contenuto originale senza fonte
      questionCount = getQuestionCountWithoutSource(userWordCount) as 1 | 3;
    } else {
      // Contenuto con fonte
      testMode = getTestModeWithSource(userWordCount);
    }
    
    toast({
      title: 'Generazione Q&A...',
      description: isOriginalPost 
        ? `Creazione del test (${questionCount} ${questionCount === 1 ? 'domanda' : 'domande'})`
        : `Creazione del test di comprensione (${testMode === 'SOURCE_ONLY' ? 'sulla fonte' : testMode === 'MIXED' ? 'misto' : 'sul tuo testo'})`
    });

    // Use FULL content for quiz generation
    const fullContent = readerSource.content || readerSource.summary || readerSource.excerpt || post.content;
    
    console.log('Generating QA with params:', { 
      fullContentLength: fullContent.length,
      userWordCount,
      testMode,
      questionCount,
      isOriginalPost
    });

    const result = await generateQA({
      contentId: post.id,
      title: readerSource.title,
      summary: fullContent,
      userText: userText,
      sourceUrl: isOriginalPost ? undefined : readerSource.url,
      testMode,
      questionCount,
    });

    if (result.insufficient_context) {
      toast({
        title: 'Contenuto troppo breve',
        description: 'Puoi comunque condividere questo post',
      });
      onQuoteShare?.(post);
      return;
    }

    if (result.error || !result.questions) {
      toast({
        title: 'Errore generazione quiz',
        description: result.error || 'Impossibile generare Q&A',
        variant: 'destructive'
      });
      return;
    }

    setQuizData({
      questions: result.questions,
      sourceUrl: readerSource.url || ''
    });
    setShowQuiz(true);
  };

  const handleQuizSubmit = async (answers: Record<string, string>) => {
    if (!user || !quizData) return { passed: false, score: 0, total: 0, wrongIndexes: [] };

    try {
      console.log('Quiz submitted:', { answers, postId: post.id, sourceUrl: quizData.sourceUrl });
      
      const { data, error } = await supabase.functions.invoke('validate-answers', {
        body: {
          postId: post.id,
          sourceUrl: quizData.sourceUrl,
          answers,
          gateType: 'share'
        }
      });

      console.log('Quiz validation response:', { data, error });

      if (error) {
        console.error('Quiz validation error:', error);
        throw error;
      }

      // IMPORTANTE: aprire composer SOLO se il test è superato (max 2 errori totali)
      const actualPassed = data.passed && (data.total - data.score) <= 2;
      
      console.log('Quiz result details:', {
        score: data.score,
        total: data.total,
        errors: data.total - data.score,
        percentage: ((data.score / data.total) * 100).toFixed(0) + '%',
        backendPassed: data.passed,
        actualPassed
      });
      
      if (actualPassed) {
        toast({
          title: '✅ Test superato!',
          description: 'Ora puoi condividere il post'
        });
        setShowQuiz(false);
        setQuizData(null);
        
        // Esegui l'azione scelta dall'utente
        if (shareAction === 'feed') {
          onQuoteShare?.({
            ...post,
            _originalSources: Array.isArray(post.sources) ? post.sources : []
          });
        } else if (shareAction === 'friend') {
          setShowPeoplePicker(true);
        }
        
        // Reset share action
        setShareAction(null);
      } else {
        console.warn('Test failed, NOT opening composer');
        toast({
          title: 'Test Non Superato',
          description: `Punteggio: ${data.score}/${data.total} (${((data.score / data.total) * 100).toFixed(0)}%). Serve almeno 66%!`,
          variant: 'destructive'
        });
        setShowQuiz(false);
        setQuizData(null);
        setShareAction(null);
        // NON aprire il composer
      }
      
      return data;
    } catch (error) {
      console.error('Error validating quiz:', error);
      toast({
        title: 'Errore',
        description: 'Errore durante la validazione',
        variant: 'destructive'
      });
      return { passed: false, score: 0, total: 0, wrongIndexes: [] };
    }
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: it 
  });

  // Deduplicazione fonti
  const displaySources = uniqueSources(post.sources || []);

  return (
    <>
      <article 
        className="feed-card-base p-5 overflow-hidden"
      >
        <div className="flex gap-3">
          {/* Avatar circolare a sinistra */}
          <div 
            className="flex-shrink-0 cursor-pointer transition-opacity hover:opacity-80"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${post.author.id}`);
            }}
          >
          <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-border/20">
            {getAvatarContent()}
          </div>
          </div>
          
          {/* Content a destra */}
          <div className="flex-1 min-w-0">
            {/* Header: Nome utente e timestamp - clean */}
            <div className="flex items-baseline gap-2 mb-2">
              <div 
                className="flex-1 min-w-0 cursor-pointer" 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${post.author.id}`);
                }}
              >
                <span className="font-semibold text-[15px] text-white truncate">
                  {post.author.full_name || getDisplayUsername(post.author.username)}
                </span>
              </div>
              <span className="text-[13px] text-gray-400 flex-shrink-0">
                {timeAgo}
              </span>
            </div>

            {/* User Comment - Interlinea rilassata */}
            <div className="text-[15px] leading-relaxed text-gray-100 mb-3 whitespace-pre-wrap break-words">
              <MentionText content={post.content} />
            </div>

            {/* Media Gallery */}
            {post.media && post.media.length > 0 && (
              <MediaGallery 
                media={post.media}
                onClick={(_, index) => {
                  setSelectedMediaIndex(index);
                }}
              />
            )}

            {/* Quoted Post */}
            {quotedPost && (
              <QuotedPostCard 
                quotedPost={quotedPost} 
                parentSources={post.shared_url ? [post.shared_url, ...(post.sources || [])] : (post.sources || [])} 
              />
            )}

            {/* Rich Link Preview Card - Liquid Glass Nested Panel */}
            {post.shared_url && (
              <div 
                className="mb-3 liquid-glass-nested overflow-hidden hover:bg-[rgba(255,255,255,0.06)] transition-all duration-200 cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                }}
              >
                {/* Image preview - 16:9 aspect ratio */}
                <div className="relative w-full aspect-[16/9] bg-gradient-to-br from-gray-900 to-gray-800">
                  {(articlePreview?.image || articlePreview?.previewImg || post.preview_img) ? (
                    <img 
                      src={articlePreview?.image || articlePreview?.previewImg || post.preview_img}
                      alt={articlePreview?.title || post.shared_title || ''}
                      className="w-full h-full object-cover opacity-80"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ExternalLink className="w-10 h-10 text-gray-600" />
                    </div>
                  )}
                  {/* Overlay gradient per leggibilità */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
                
                {/* Metadata below image */}
                <div className="p-3 space-y-1">
                  <h4 className="font-semibold text-sm text-white line-clamp-2">
                    {articlePreview?.title || post.shared_title || getHostnameFromUrl(post.shared_url)}
                  </h4>
                  <p className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                    {articlePreview?.platform === "youtube" && (
                      <span className="text-red-400">▶</span>
                    )}
                    {articlePreview?.platform === "instagram" && (
                      <span className="text-pink-400">📷</span>
                    )}
                    {getHostnameFromUrl(post.shared_url)}
                  </p>
                </div>
              </div>
            )}

            {/* Trust Badge - Liquid Glass Pill ESATTAMENTE tra Preview e Action Bar */}
            {/* Trust Badge - Liquid Glass con Tooltip */}
            {trustScore && post.shared_url && (
              <div className="flex items-center justify-start mb-3">
                <div 
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md transition-all duration-200",
                    trustScore.band === "ALTO" && "trust-badge-high",
                    trustScore.band === "MEDIO" && "trust-badge-medium",
                    trustScore.band === "BASSO" && "trust-badge-low"
                  )}
                >
                  {/* Icona Lucchetto */}
                  {trustScore.band === "ALTO" && <ShieldCheck className="w-4 h-4" />}
                  {trustScore.band === "MEDIO" && <ShieldAlert className="w-4 h-4" />}
                  {trustScore.band === "BASSO" && <AlertTriangle className="w-4 h-4" />}
                  
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {trustScore.band}
                  </span>

                  {/* Info Icon con Tooltip */}
                  {trustScore.reasons && trustScore.reasons.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipPosition({ 
                          top: rect.bottom + 8, 
                          left: rect.left 
                        });
                        setShowTrustTooltip(!showTrustTooltip);
                      }}
                      className="ml-1 hover:opacity-70 transition-opacity"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Bar - Aligned with avatar using spacer - Liquid Glass Icons */}
        <div className="flex gap-3 pt-3">
          <div className="w-8 flex-shrink-0" /> {/* Avatar spacer */}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                {/* Like - Always Outline */}
                <button 
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1.5 rounded-full transition-all group",
                    post.user_reactions.has_hearted 
                      ? "text-red-400" 
                      : "text-gray-400 hover:text-white"
                  )}
                  onClick={handleHeart}
                >
                  <Heart className={cn(
                    "w-[18px] h-[18px] transition-all",
                    post.user_reactions.has_hearted ? "icon-glow" : "group-hover:icon-glow"
                  )} />
                  {post.reactions.hearts > 0 && (
                    <span className="text-sm">{post.reactions.hearts}</span>
                  )}
                </button>

                {/* Comments - Always Outline */}
                <button 
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-full text-gray-400 hover:text-white transition-all group"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowComments(true);
                  }}
                >
                  <MessageCircle className="w-[18px] h-[18px] group-hover:icon-glow" />
                  {post.reactions.comments > 0 && (
                    <span className="text-sm">{post.reactions.comments}</span>
                  )}
                </button>

                {/* Share - Always Outline */}
                <button 
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-full text-gray-400 hover:text-white transition-all group"
                  onClick={handleShareClick}
                  title="Condividi"
                >
                  <img 
                    src="/lovable-uploads/f6970c06-9fd9-4430-b863-07384bbb05ce.png"
                    alt="Condividi"
                    className="w-[18px] h-[18px] opacity-60 group-hover:opacity-100 group-hover:icon-glow"
                  />
                </button>
              </div>

              {/* Bookmark - Always Outline, Right Side */}
              <button 
                className={cn(
                  "flex items-center px-2 py-1.5 rounded-full transition-all",
                  post.user_reactions.has_bookmarked 
                    ? "text-blue-400" 
                    : "text-gray-400 hover:text-white"
                )}
                onClick={handleBookmark}
              >
                <Bookmark className={cn(
                  "w-[18px] h-[18px]",
                  post.user_reactions.has_bookmarked ? "icon-glow" : "hover:icon-glow"
                )} />
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* Reader Modal - Rendered via Portal */}
      {showReader && readerSource && createPortal(
        <SourceReaderGate
          source={readerSource}
          isOpen={showReader}
          onClose={() => {
            setShowReader(false);
            setReaderSource(null);
          }}
          onComplete={handleReaderComplete}
        />,
        document.body
      )}

      {/* Quiz Modal - Rendered via Portal */}
      {showQuiz && quizData && createPortal(
        <QuizModal
          questions={quizData.questions}
          onSubmit={handleQuizSubmit}
          onCancel={() => {
            setShowQuiz(false);
            setQuizData(null);
          }}
        />,
        document.body
      )}

      {/* Media Viewer - Rendered via Portal */}
      {selectedMediaIndex !== null && post.media && createPortal(
        <MediaViewer
          media={post.media}
          initialIndex={selectedMediaIndex}
          onClose={() => setSelectedMediaIndex(null)}
        />,
        document.body
      )}

      {/* Share Sheet */}
      <ShareSheet
        isOpen={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        onShareToFeed={handleShareToFeed}
        onShareToFriend={handleShareToFriend}
      />

      {/* People Picker */}
      <PeoplePicker
        isOpen={showPeoplePicker}
        onClose={() => setShowPeoplePicker(false)}
        onSend={async (userIds) => {
          // Invia il post agli amici selezionati
          for (const userId of userIds) {
            try {
              // Crea o recupera il thread con questo utente
              const threadResult = await createThread.mutateAsync([userId]);
              
              if (threadResult?.thread_id) {
                // Invia il messaggio
                const shareMessage = post.shared_url 
                  ? `${post.content}\n\n${post.shared_url}`
                  : post.content;

                await sendMessage.mutateAsync({
                  threadId: threadResult.thread_id,
                  content: shareMessage,
                  linkUrl: post.shared_url || undefined
                });
              }
            } catch (error) {
              console.error('Error sending message:', error);
            }
          }
          
          toast({
            title: 'Messaggio inviato',
            description: `Post condiviso con ${userIds.length} ${userIds.length === 1 ? 'amico' : 'amici'}`
          });
          
          setShowPeoplePicker(false);
          setShareAction(null);
        }}
      />

      {/* Trust Score Tooltip */}
      {showTrustTooltip && trustScore?.reasons && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => setShowTrustTooltip(false)}
          />
          <div
            className="fixed z-[9999] bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg max-w-[280px]"
            style={{
              top: `${tooltipPosition.top}px`,
              left: `${tooltipPosition.left}px`,
              transform: 'translateX(-50%)'
            }}
          >
            <p className="text-xs font-semibold mb-2 text-foreground">Motivi del punteggio:</p>
            <ul className="space-y-1">
              {trustScore.reasons.map((reason, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </>,
        document.body
      )}

      {/* Comments Drawer */}
      {showComments && (
        <CommentsDrawer
          post={post}
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          mode="view"
        />
      )}

    </>
  );
};

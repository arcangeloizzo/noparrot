import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, EyeOff, ExternalLink, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
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
    
    // Se ha shared_url → apri reader
    if (post.shared_url) {
      await startComprehensionGate();
      return;
    }

    // Altrimenti controlla word count
    const wordCount = post.content.trim().split(/\s+/).length;
    
    if (wordCount < 150) {
      // Passa direttamente il post quotato
      onQuoteShare?.({
        ...post,
        _originalSources: Array.isArray(post.sources) ? post.sources : []
      });
      toast({
        title: 'Post pronto per la condivisione',
        description: 'Aggiungi un tuo commento'
      });
    } else {
      toast({
        title: 'Lettura richiesta',
        description: 'Leggi il post per condividerlo'
      });
      await startComprehensionGateForPost();
    }
  };

  // Handler per condivisione con amico
  const handleShareToFriend = async () => {
    setShareAction('friend');
    
    // Se ha shared_url → apri reader
    if (post.shared_url) {
      await startComprehensionGate();
      return;
    }

    // Altrimenti controlla word count
    const wordCount = post.content.trim().split(/\s+/).length;
    
    if (wordCount < 150) {
      // Apri direttamente il people picker
      setShowPeoplePicker(true);
    } else {
      toast({
        title: 'Lettura richiesta',
        description: 'Leggi il post per condividerlo'
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
    
    toast({
      title: 'Generazione Q&A...',
      description: isOriginalPost 
        ? 'Creazione del test sul post'
        : 'Creazione del test di comprensione'
    });

    // Use FULL content for quiz generation
    const fullContent = readerSource.content || readerSource.summary || readerSource.excerpt || post.content;
    
    console.log('Generating QA with full content length:', fullContent.length);

    const result = await generateQA({
      contentId: isOriginalPost ? post.id : post.id,
      title: readerSource.title,
      summary: fullContent,
      sourceUrl: isOriginalPost ? undefined : readerSource.url,
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
        className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08)] transition-all duration-200 cursor-pointer overflow-hidden p-5 will-change-transform hover:-translate-y-0.5 active:scale-[0.995]"
        onClick={() => {
          navigate(`/post/${post.id}`);
        }}
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
            <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-border/20">
              {getAvatarContent()}
            </div>
          </div>
          
          {/* Content a destra */}
          <div className="flex-1 min-w-0">
            {/* Header: Nome + Badge Trust a destra */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div 
                className="flex-1 min-w-0 cursor-pointer" 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${post.author.id}`);
                }}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-[15px] text-[hsl(var(--capsule-text-primary))] truncate">
                    {post.author.full_name || getDisplayUsername(post.author.username)}
                  </span>
                  <span className="text-[13px] text-[hsl(var(--capsule-text-muted))]">
                    {timeAgo}
                  </span>
                </div>
              </div>

              {/* Trust Badge Pill - Top Right with Icon */}
              {trustScore && post.shared_url && (
                <div 
                  className="flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div 
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wide",
                      trustScore.band === "ALTO" && "bg-emerald-50 text-emerald-700",
                      trustScore.band === "MEDIO" && "bg-amber-50 text-amber-700",
                      trustScore.band === "BASSO" && "bg-red-50 text-red-700"
                    )}
                  >
                    {trustScore.band === "ALTO" && <ShieldCheck className="w-3 h-3" />}
                    {trustScore.band === "MEDIO" && <ShieldAlert className="w-3 h-3" />}
                    {trustScore.band === "BASSO" && <AlertTriangle className="w-3 h-3" />}
                    <span>{trustScore.band}</span>
                  </div>
                </div>
              )}
            </div>

            {/* User Comment - Interlinea rilassata */}
            <div className="text-[15px] leading-relaxed text-[hsl(var(--capsule-text-body))] mb-3 whitespace-pre-wrap break-words">
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

            {/* Rich Link Preview Card - Professional, Always Shown */}
            {post.shared_url && (
              <div 
                className="mb-3 border border-gray-100 rounded-xl overflow-hidden bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                }}
              >
                {/* Image preview - 16:9 aspect ratio */}
                <div className="relative w-full aspect-[16/9] bg-gradient-to-br from-gray-100 to-gray-50">
                  {(articlePreview?.image || articlePreview?.previewImg || post.preview_img) ? (
                    <img 
                      src={articlePreview?.image || articlePreview?.previewImg || post.preview_img}
                      alt={articlePreview?.title || post.shared_title || ''}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ExternalLink className="w-8 h-8 text-gray-300" />
                    </div>
                  )}
                </div>
                
                {/* Metadata below image */}
                <div className="p-3 space-y-1">
                  <h4 className="font-semibold text-sm text-gray-900 line-clamp-2">
                    {articlePreview?.title || post.shared_title || getHostnameFromUrl(post.shared_url)}
                  </h4>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    {getHostnameFromUrl(post.shared_url)}
                  </p>
                </div>
              </div>
            )}

            {/* Action Bar - Outline Icons, Minimal, Clean */}
            <div className="flex items-center justify-between pt-3 -ml-1">
              <div className="flex items-center gap-6">
                {/* Like - Always Outline */}
                <button 
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1.5 rounded-full transition-all",
                    post.user_reactions.has_hearted 
                      ? "text-blue-600 hover:bg-blue-50" 
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                  )}
                  onClick={handleHeart}
                >
                  <Heart className="w-[18px] h-[18px]" />
                  {post.reactions.hearts > 0 && (
                    <span className="text-sm">{post.reactions.hearts}</span>
                  )}
                </button>

                {/* Comments - Always Outline */}
                <button 
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowComments(true);
                  }}
                >
                  <MessageCircle className="w-[18px] h-[18px]" />
                  {post.reactions.comments > 0 && (
                    <span className="text-sm">{post.reactions.comments}</span>
                  )}
                </button>

                {/* Share - Always Outline */}
                <button 
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
                  onClick={handleShareClick}
                  title="Condividi"
                >
                  <img 
                    src="/lovable-uploads/f6970c06-9fd9-4430-b863-07384bbb05ce.png"
                    alt="Condividi"
                    className="w-[18px] h-[18px] opacity-60 hover:opacity-80"
                  />
                </button>
              </div>

              {/* Bookmark - Always Outline, Right Side */}
              <button 
                className={cn(
                  "flex items-center px-2 py-1.5 rounded-full transition-all",
                  post.user_reactions.has_bookmarked 
                    ? "text-blue-600 hover:bg-blue-50" 
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                )}
                onClick={handleBookmark}
              >
                <Bookmark className="w-[18px] h-[18px]" />
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

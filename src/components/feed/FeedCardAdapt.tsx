import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Trash2, ExternalLink, ShieldCheck, ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

// UI Components
import { TrustBadge } from "@/components/ui/trust-badge";
import { CategoryChip } from "@/components/ui/category-chip";
import { Button } from "@/components/ui/button";
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
import { Post, useQuotedPost, useDeletePost } from "@/hooks/usePosts";
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
import { useDoubleTap } from "@/hooks/useDoubleTap";

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
  const deletePost = useDeletePost();
  const { data: quotedPost } = useQuotedPost(post.quoted_post_id);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  const createThread = useCreateThread();
  const sendMessage = useSendMessage();
  const isOwnPost = user?.id === post.author.id;
  
  // Article preview state
  const [articlePreview, setArticlePreview] = useState<any>(null);
  
  // Remove swipe gesture states - no longer needed
  
  // Gate states
  const [showReader, setShowReader] = useState(false);
  const [readerClosing, setReaderClosing] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [readerSource, setReaderSource] = useState<any>(null);
  const [quizData, setQuizData] = useState<any>(null);
  const [gateStep, setGateStep] = useState<string>('idle');
  // Comments state
  const [showComments, setShowComments] = useState(false);
  
  // Share states
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [shareAction, setShareAction] = useState<'feed' | 'friend' | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  
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

        // Always set a usable preview object so social links (es. Instagram) show *some* info
        const platform = (preview as any)?.platform || detectPlatformFromUrl(post.shared_url);
        const nextPreview = preview
          ? { ...(preview as any), platform }
          : {
              platform,
              title: post.shared_title || getHostnameFromUrl(post.shared_url),
              description: '',
              image: post.preview_img || '',
            };

        setArticlePreview(nextPreview);
      } catch (error) {
        console.error('Error fetching article preview:', error);
        setArticlePreview({
          platform: detectPlatformFromUrl(post.shared_url),
          title: post.shared_title || getHostnameFromUrl(post.shared_url),
          description: '',
          image: post.preview_img || '',
        });
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

  const handleHeart = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    toggleReaction.mutate({ postId: post.id, reactionType: 'heart' });
  };

  // Double tap to like
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  
  const { handleTap: handleDoubleTap } = useDoubleTap({
    onDoubleTap: () => {
      // Only like if not already liked
      if (!post.user_reactions?.has_hearted) {
        handleHeart();
        setShowHeartAnimation(true);
        setTimeout(() => setShowHeartAnimation(false), 800);
      }
    }
  });

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
      id: post.id,
      state: 'reading' as const,
      url: `post://${post.id}`, // Pseudo-URL for original posts
      title: `Post di @${post.author.username}`,
      content: post.content,
      isOriginalPost: true, // Flag to distinguish from external sources
    });
    setShowReader(true);
  };

  // Helper to detect platform from URL
  const detectPlatformFromUrl = (url: string): string | undefined => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      if (hostname.includes('tiktok')) return 'tiktok';
      if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'youtube';
      if (hostname.includes('twitter') || hostname.includes('x.com')) return 'twitter';
      if (hostname.includes('threads')) return 'threads';
      if (hostname.includes('linkedin')) return 'linkedin';
      if (hostname.includes('spotify')) return 'spotify';
      return undefined;
    } catch {
      return undefined;
    }
  };

  const startComprehensionGate = async () => {
    if (!post.shared_url || !user) return;

    // Block unsupported platforms (removed from app)
    try {
      const host = new URL(post.shared_url).hostname.toLowerCase();
      if (
        host.includes('instagram.com') ||
        host.includes('facebook.com') ||
        host.includes('m.facebook.com') ||
        host.includes('fb.com') ||
        host.includes('fb.watch')
      ) {
        toast({
          title: 'Link non supportato',
          description: 'Instagram e Facebook non sono supportati. Apro il link nel browser.',
        });
        window.open(post.shared_url, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch {
      // ignore
    }

    toast({
      title: 'Caricamento contenuto...',
      description: 'Preparazione del Comprehension Gate'
    });

    // Fetch article preview
    const preview = await fetchArticlePreview(post.shared_url);
    
    // Get hostname for fallback title
    let hostname = '';
    try {
      hostname = new URL(post.shared_url).hostname.replace('www.', '');
    } catch {}

    // GRACEFUL FALLBACK: Open reader even if preview fails
    // IMPORTANT: Spread preview FIRST so our defaults take precedence when preview fields are null/undefined
    setReaderSource({
      ...preview,
      id: post.id,
      state: 'reading' as const,
      url: post.shared_url,
      title: preview?.title || post.shared_title || `Contenuto da ${hostname}`,
      content:
        preview?.content ||
        preview?.description ||
        preview?.summary ||
        preview?.excerpt ||
        post.content ||
        '',
      summary: preview?.summary || preview?.description || 'Apri il link per visualizzare il contenuto completo.',
      image: preview?.image || post.preview_img || '',
      platform: preview?.platform || detectPlatformFromUrl(post.shared_url),
      contentQuality: preview?.contentQuality || 'minimal',
    });
    setShowReader(true);
    
    // Informational toast if using fallback
    if (!preview) {
      toast({
        title: 'Contenuto limitato',
        description: 'Alcuni dettagli potrebbero non essere disponibili',
        variant: 'default'
      });
    }
  };

  // Helper per chiusura sicura del reader (iOS Safari)
  // NOTA: NON rimuovere iframes dal DOM manualmente - lascia che React gestisca l'unmount
  const closeReaderSafely = async () => {
    setReaderClosing(true);
    
    try {
      // Solo ferma il caricamento degli iframe, NON rimuoverli dal DOM
      // React li rimuoverà naturalmente quando setShowReader(false) viene chiamato
      const gateRoot = document.querySelector('[data-reader-gate-root="true"]') as HTMLElement | null;
      const iframes = (gateRoot ? gateRoot.querySelectorAll('iframe') : document.querySelectorAll('iframe'));
      
      iframes.forEach((iframe) => {
        try {
          (iframe as HTMLIFrameElement).src = 'about:blank';
          // NON fare iframe.remove() - causa crash su iOS Safari
        } catch (e) {
          console.warn('[Gate] Error blanking iframe:', e);
        }
      });
    } catch (e) {
      console.warn('[Gate] Error during iframe cleanup:', e);
    }
    
    await new Promise((resolve) => setTimeout(resolve, 50));
    setShowReader(false);
    setReaderClosing(false);
    setReaderLoading(false);
    setReaderSource(null);
    setShareAction(null);
  };

  const handleReaderComplete = async () => {
    if (!readerSource || !user) return;

    // 1️⃣ MOSTRA LOADING NEL READER (non chiuderlo!)
    setGateStep('reader:loading');
    setReaderLoading(true);

    console.log('[Gate] handleReaderComplete started', { readerSource, shareAction });

    try {
      const isOriginalPost = readerSource.isOriginalPost;
      const userText = post.content;
      const userWordCount = getWordCount(userText);
      
      let testMode: 'SOURCE_ONLY' | 'MIXED' | 'USER_ONLY' | undefined;
      let questionCount: 1 | 3 | undefined;
      
      if (isOriginalPost) {
        questionCount = getQuestionCountWithoutSource(userWordCount) as 1 | 3;
      } else {
        testMode = getTestModeWithSource(userWordCount);
      }
      
      toast({
        title: 'Stiamo mettendo a fuoco ciò che conta…',
        description: isOriginalPost 
          ? `Sto creando le domande giuste per capire davvero…`
          : `Sto selezionando i punti che contano…`
      });

      const fullContent = readerSource.content || readerSource.summary || readerSource.excerpt || post.content;
      
      console.log('[Gate] Generating QA with params:', { 
        fullContentLength: fullContent.length,
        userWordCount,
        testMode,
        questionCount,
        isOriginalPost,
        qaSourceRef: readerSource.qaSourceRef
      });

      // 2️⃣ GENERA QA MENTRE IL READER È ANCORA APERTO
      // Use qaSourceRef for source-first, fallback to summary for original posts
      const result = await generateQA({
        contentId: post.id,
        title: readerSource.title,
        summary: isOriginalPost ? fullContent : undefined, // Only for original posts
        qaSourceRef: !isOriginalPost ? readerSource.qaSourceRef : undefined,
        userText: userText || '',
        sourceUrl: isOriginalPost ? undefined : readerSource.url,
        testMode,
        questionCount,
      });

      console.log('[Gate] generateQA result', { 
        hasQuestions: !!result?.questions, 
        questionCount: result?.questions?.length,
        error: result?.error,
        insufficient_context: result?.insufficient_context
      });

      // 3️⃣ GESTISCI ERRORI PRIMA DI CHIUDERE
      if (result.insufficient_context) {
        toast({
          title: 'Contenuto troppo breve',
          description: 'Puoi comunque condividere questo post',
        });
        await closeReaderSafely();
        onQuoteShare?.(post);
        return;
      }

      if (!result) {
        console.error('[Gate] generateQA returned null/undefined');
        toast({ title: 'Errore', description: 'Risposta non valida dal server', variant: 'destructive' });
        setReaderLoading(false);
        return; // Reader resta aperto
      }

      if (result.error) {
        console.error('[Gate] generateQA error:', result.error);
        toast({ title: 'Errore', description: result.error, variant: 'destructive' });
        setReaderLoading(false);
        return; // Reader resta aperto
      }

      if (!result.questions || !Array.isArray(result.questions) || result.questions.length === 0) {
        console.error('[Gate] Invalid questions array:', result.questions);
        toast({ title: 'Errore', description: 'Quiz non valido, riprova', variant: 'destructive' });
        setReaderLoading(false);
        return; // Reader resta aperto
      }

      const invalidQuestion = result.questions.find(q => !q.id || !q.stem || !q.choices);
      if (invalidQuestion) {
        console.error('[Gate] Invalid question format:', invalidQuestion);
        toast({ title: 'Errore', description: 'Formato domanda non valido', variant: 'destructive' });
        setReaderLoading(false);
        return; // Reader resta aperto
      }

      // 4️⃣ SALVA sourceUrl PRIMA di chiudere
      const sourceUrl = readerSource.url || '';

      console.log('[Gate] Quiz generated, transitioning...', {
        questionCount: result.questions.length,
        sourceUrl,
      });

      // 5️⃣ OVERLAY APPROACH (iOS-safe): monta il quiz SOPRA al reader, poi chiudi il reader
      // STEP A: monta il quiz mentre il reader è ancora visibile (nessuno “schermo bianco”)
      setGateStep('quiz:mount');
      // SECURITY HARDENED: Always save qaId from server for submit-qa validation
      setQuizData({
        qaId: result.qaId, // Server-generated qaId for secure validation
        questions: result.questions,
        sourceUrl,
      });
      setShowQuiz(true);

      // STEP B: aspetta 1 frame per garantire che il quiz sia renderizzato
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      // STEP C: ora possiamo chiudere il reader in sicurezza (dietro al quiz)
      setGateStep('reader:closing');
      setReaderClosing(true);
      await new Promise((resolve) => setTimeout(resolve, 50));

      setGateStep('reader:unmount');
      setShowReader(false);
      setReaderLoading(false);
      setReaderSource(null);

      // STEP D: reset closing + stato finale
      setReaderClosing(false);
      setGateStep('quiz:shown');

      console.log('[Gate] Quiz mounted via overlay approach');

      console.log('[Gate] Quiz mounted successfully');
    } catch (error) {
      setGateStep('error');
      console.error('[Gate] Error in handleReaderComplete:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore. Riprova.',
        variant: 'destructive'
      });
      setReaderLoading(false);
      setReaderClosing(false);
      // Reader resta aperto, utente può chiudere manualmente o riprovare
    }
  };

  const handleQuizSubmit = async (answers: Record<string, string>) => {
    if (!user || !quizData) return { passed: false, score: 0, total: 0, wrongIndexes: [] };

    try {
      console.log('Quiz submitted:', { answers, postId: post.id, sourceUrl: quizData.sourceUrl });
      
      // SECURITY HARDENED: Use qaId for deterministic server-side validation
      const { data, error } = await supabase.functions.invoke('submit-qa', {
        body: {
          qaId: quizData.qaId, // Server-generated qaId
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

      // SECURITY HARDENED: Server is the ONLY source of truth - no client-side overrides
      const passed = data.passed;
      
      console.log('Quiz result details:', {
        score: data.score,
        total: data.total,
        errors: data.total - data.score,
        percentage: ((data.score / data.total) * 100).toFixed(0) + '%',
        passed
      });
      
      if (passed) {
        toast({
          title: 'Possiamo procedere.',
          description: 'Hai messo a fuoco.'
        });
        setShowQuiz(false);
        setQuizData(null);
        setGateStep('idle');

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
          title: "Serve ancora un po' di chiarezza.",
          description: 'Rileggi il contenuto e riprova.'
        });
        setShowQuiz(false);
        setQuizData(null);
        setShareAction(null);
        setGateStep('idle');
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
        className="feed-card-base p-5 overflow-hidden relative"
        onClick={handleDoubleTap}
      >
        {/* Heart animation on double tap */}
        {showHeartAnimation && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <Heart className="w-20 h-20 text-brand-pink fill-brand-pink animate-scale-in drop-shadow-lg" />
          </div>
        )}
        
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
            <div className="flex items-center gap-2 mb-2">
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
              {isOwnPost && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <button className="p-1.5 rounded-full hover:bg-muted/50 transition-colors">
                      <MoreHorizontal className="w-4 h-4 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        deletePost.mutate(post.id, {
                          onSuccess: () => {
                            toast({ title: 'Post eliminato' });
                            onRemove?.();
                          },
                          onError: () => {
                            toast({ title: 'Errore', description: 'Impossibile eliminare il post', variant: 'destructive' });
                          }
                        });
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Elimina post
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* User Comment - Interlinea rilassata */}
            <div className="text-[15px] leading-relaxed text-gray-100 mb-3 whitespace-pre-wrap break-words">
              {post.content.length > 300 && !isExpanded ? (
                <>
                  <MentionText content={post.content.slice(0, 300) + '...'} />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded(true);
                    }}
                    className="text-primary hover:underline ml-1 font-medium"
                  >
                    mostra di più
                  </button>
                </>
              ) : (
                <MentionText content={post.content} />
              )}
            </div>

            {/* Category Chip */}
            {post.category && (
              <div className="mb-3">
                <CategoryChip category={post.category} />
              </div>
            )}

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
                  
                  {/* Trust Badge overlay in basso a destra */}
                  {trustScore && (
                    <div className="absolute bottom-2 right-2 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (trustScore.reasons && trustScore.reasons.length > 0) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltipPosition({ 
                              top: rect.bottom + 8, 
                              left: rect.left 
                            });
                            setShowTrustTooltip(!showTrustTooltip);
                          }
                        }}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-1 rounded-full",
                          "backdrop-blur-md bg-black/40 border border-white/20 transition-all",
                          trustScore.band === "ALTO" && "text-emerald-400",
                          trustScore.band === "MEDIO" && "text-amber-400",
                          trustScore.band === "BASSO" && "text-red-400"
                        )}
                      >
                        {trustScore.band === "ALTO" && <ShieldCheck className="w-3.5 h-3.5" />}
                        {trustScore.band === "MEDIO" && <ShieldAlert className="w-3.5 h-3.5" />}
                        {trustScore.band === "BASSO" && <AlertTriangle className="w-3.5 h-3.5" />}
                        <span className="text-xs font-bold uppercase">{trustScore.band}</span>
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Metadata below image */}
                <div className="p-3 space-y-1">
                  <h4 className="font-semibold text-sm text-white line-clamp-2">
                    {articlePreview?.title || post.shared_title || getHostnameFromUrl(post.shared_url)}
                  </h4>

                  {(articlePreview?.description || articlePreview?.summary || articlePreview?.excerpt) ? (
                    <p className="text-xs text-gray-300/90 line-clamp-2">
                      {articlePreview?.description || articlePreview?.summary || articlePreview?.excerpt}
                    </p>
                  ) : articlePreview?.platform ? (
                    <p className="text-xs text-gray-300/80 italic">
                      Tocca per aprire il contenuto originale su {articlePreview.platform}
                    </p>
                  ) : null}

                  <p className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                    {articlePreview?.platform === "youtube" && (
                      <span className="text-red-400">▶</span>
                    )}
                    {getHostnameFromUrl(post.shared_url)}
                  </p>
                </div>
              </div>
            )}

            {/* Trust Badge removed - now positioned as overlay on image */}
          </div>
        </div>

        {/* Action Bar - Aligned with avatar using spacer - Liquid Glass Icons */}
        <div className="flex gap-3 pt-3">
          <div className="w-8 flex-shrink-0" /> {/* Avatar spacer */}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                {/* Like */}
                <button 
                  className={cn(
                    "reaction-btn-heart",
                    post.user_reactions.has_hearted && "liked"
                  )}
                  onClick={handleHeart}
                >
                  <Heart 
                    className="w-5 h-5 transition-all"
                    fill={post.user_reactions.has_hearted ? "currentColor" : "none"}
                    strokeWidth={post.user_reactions.has_hearted ? 0 : 2}
                  />
                  <span>{post.reactions.hearts}</span>
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

      {/* Debug badge (visibile su mobile) */}
      {gateStep !== 'idle' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10050] rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground shadow">
          Gate: {gateStep}
        </div>
      )}

      {/* Reader Modal - Rendered directly (no Portal, iOS-safe) */}
      {showReader && readerSource && (
        <div className="fixed inset-0 z-[10040]">
          <SourceReaderGate
            source={readerSource}
            isOpen={showReader}
            isClosing={readerClosing}
            isLoading={readerLoading}
            onClose={async () => {
              if (readerLoading) return; // Non chiudere durante loading
              setGateStep('reader:manual-close');
              setReaderClosing(true);
              await new Promise((resolve) => setTimeout(resolve, 200));
              setShowReader(false);
              setReaderSource(null);
              await new Promise((resolve) => setTimeout(resolve, 50));
              setReaderClosing(false);
              setGateStep('idle');
            }}
            onComplete={handleReaderComplete}
          />
        </div>
      )}

      {/* Quiz Modal - Rendered directly (no Portal, iOS-safe) */}
      {showQuiz && quizData && !quizData.error && quizData.questions && (
        <div className="fixed inset-0 z-[10060]">
          <QuizModal
            questions={quizData.questions}
            qaId={quizData.qaId}
            onSubmit={handleQuizSubmit}
            onCancel={() => {
              setShowQuiz(false);
              setQuizData(null);
              setGateStep('idle');
            }}
          />
        </div>
      )}

      {/* Error state for quiz loading failure */}
      {showQuiz && quizData?.error && (
        <div className="fixed inset-0 bg-black/80 z-[10060] flex items-center justify-center p-4">
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
        </div>
      )}

      {/* Media Viewer */}
      {selectedMediaIndex !== null && post.media && (
        <div className="fixed inset-0 z-[10080]">
          <MediaViewer
            media={post.media}
            initialIndex={selectedMediaIndex}
            onClose={() => setSelectedMediaIndex(null)}
          />
        </div>
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

          // Increment shares count for DM shares (once per share action)
          if (userIds.length > 0) {
            try {
              await supabase.rpc('increment_post_shares', { target_post_id: post.id });
            } catch (e) {
              console.warn('[FeedCardAdapt] Failed to increment shares count:', e);
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
      {showTrustTooltip && trustScore?.reasons && (
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
        </>
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

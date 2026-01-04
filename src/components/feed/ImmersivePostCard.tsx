import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Trash2, ExternalLink, Quote, ShieldCheck, Maximize2, Play } from "lucide-react";
import { useDominantColors } from "@/hooks/useDominantColors";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

// UI Components
import { CategoryChip } from "@/components/ui/category-chip";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuizModal } from "@/components/ui/quiz-modal";

// Feed Components
import { QuotedPostCard } from "./QuotedPostCard";
import { MentionText } from "./MentionText";
import { ReshareContextStack } from "./ReshareContextStack";

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
import { useReshareContextStack } from "@/hooks/useReshareContextStack";
import { useOriginalSource } from "@/hooks/useOriginalSource";

interface ImmersivePostCardProps {
  post: Post;
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

// Helper to detect if user text is similar to article title (avoids duplication)
const isTextSimilarToTitle = (userText: string, title: string): boolean => {
  if (!userText || !title) return false;
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const normalizedUser = normalize(userText);
  const normalizedTitle = normalize(title);
  // If one contains the other or they are very similar
  return normalizedUser.includes(normalizedTitle) || 
         normalizedTitle.includes(normalizedUser) ||
         normalizedUser === normalizedTitle;
};

export const ImmersivePostCard = ({ 
  post, 
  onRemove,
  onQuoteShare
}: ImmersivePostCardProps) => {
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
  
  // Gate states
  const [showReader, setShowReader] = useState(false);
  const [readerClosing, setReaderClosing] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [readerSource, setReaderSource] = useState<any>(null);
  const [quizData, setQuizData] = useState<any>(null);
  const [gateStep, setGateStep] = useState<string>('idle');
  
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

  // Fetch article preview - check post, quoted post, and deep chain source
  // We use finalSourceUrl computed below, but since this runs before those computations,
  // we check direct URLs first, then the hook handles deep chain
  const urlToPreview = post.shared_url || quotedPost?.shared_url;
  
  useEffect(() => {
    const loadArticlePreview = async () => {
      if (!urlToPreview) {
        setArticlePreview(null);
        return;
      }
      try {
        const preview = await fetchArticlePreview(urlToPreview);
        const platform = (preview as any)?.platform || detectPlatformFromUrl(urlToPreview);
        setArticlePreview(preview ? { ...(preview as any), platform } : {
          platform,
          title: post.shared_title || quotedPost?.shared_title || getHostnameFromUrl(urlToPreview),
          description: '',
          image: post.preview_img || quotedPost?.preview_img || '',
        });
      } catch {
        setArticlePreview({
          platform: detectPlatformFromUrl(urlToPreview),
          title: post.shared_title || quotedPost?.shared_title || getHostnameFromUrl(urlToPreview),
          description: '',
          image: post.preview_img || quotedPost?.preview_img || '',
        });
      }
    };
    loadArticlePreview();
  }, [urlToPreview, quotedPost]);

  // Fetch trust score
  useEffect(() => {
    const loadTrustScore = async () => {
      if (!post.shared_url) {
        setTrustScore(null);
        return;
      }
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
      } catch {}
    };
    loadTrustScore();
  }, [post.shared_url, post.content]);

  const handleHeart = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    toggleReaction.mutate({ postId: post.id, reactionType: 'heart' });
  };

  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  
  const { handleTap: handleDoubleTap } = useDoubleTap({
    onDoubleTap: () => {
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

  // Share handlers
  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast({ title: 'Accedi per condividere', description: 'Devi essere autenticato', variant: 'destructive' });
      return;
    }
    setShowShareSheet(true);
  };

  const handleShareToFeed = async () => {
    setShareAction('feed');
    const userText = post.content;
    const userWordCount = getWordCount(userText);
    
    // Use finalSourceUrl to include sources from quoted posts and deep chains
    if (finalSourceUrl) {
      await startComprehensionGate();
      return;
    }

    const questionCount = getQuestionCountWithoutSource(userWordCount);
    
    if (questionCount === 0) {
      onQuoteShare?.({ ...post, _originalSources: Array.isArray(post.sources) ? post.sources : [] });
      toast({ title: 'Post pronto per la condivisione', description: 'Aggiungi un tuo commento' });
    } else {
      toast({ title: 'Lettura richiesta', description: `Leggi il post per condividerlo` });
      await startComprehensionGateForPost();
    }
  };

  const handleShareToFriend = async () => {
    setShareAction('friend');
    const userText = post.content;
    const userWordCount = getWordCount(userText);
    
    // Use finalSourceUrl to include sources from quoted posts and deep chains
    if (finalSourceUrl) {
      await startComprehensionGate();
      return;
    }

    const questionCount = getQuestionCountWithoutSource(userWordCount);
    
    if (questionCount === 0) {
      setShowPeoplePicker(true);
    } else {
      toast({ title: 'Lettura richiesta', description: `Leggi il post per condividerlo` });
      await startComprehensionGateForPost();
    }
  };

  const startComprehensionGateForPost = async () => {
    if (!user) return;
    setReaderSource({
      id: post.id,
      state: 'reading' as const,
      url: `post://${post.id}`,
      title: `Post di @${post.author.username}`,
      content: post.content,
      isOriginalPost: true,
    });
    setShowReader(true);
  };

  const startComprehensionGate = async () => {
    // Use finalSourceUrl to include sources from quoted posts and deep chains
    if (!finalSourceUrl || !user) return;

    try {
      const host = new URL(finalSourceUrl).hostname.toLowerCase();
      if (host.includes('instagram.com') || host.includes('facebook.com') || host.includes('m.facebook.com') || host.includes('fb.com') || host.includes('fb.watch')) {
        toast({ title: 'Link non supportato', description: 'Instagram e Facebook non sono supportati.' });
        window.open(finalSourceUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch {}

    toast({ title: 'Caricamento contenuto...', description: 'Preparazione del Comprehension Gate' });

    const preview = await fetchArticlePreview(finalSourceUrl);
    let hostname = '';
    try { hostname = new URL(finalSourceUrl).hostname.replace('www.', ''); } catch {}

    setReaderSource({
      ...preview,
      id: post.id,
      state: 'reading' as const,
      url: finalSourceUrl,
      title: preview?.title || finalSourceTitle || `Contenuto da ${hostname}`,
      content: preview?.content || preview?.description || preview?.summary || preview?.excerpt || post.content || '',
      summary: preview?.summary || preview?.description || 'Apri il link per visualizzare il contenuto completo.',
      image: preview?.image || finalSourceImage || '',
      platform: preview?.platform || detectPlatformFromUrl(finalSourceUrl),
      contentQuality: preview?.contentQuality || 'minimal',
    });
    setShowReader(true);
  };

  const closeReaderSafely = async () => {
    setReaderClosing(true);
    try {
      const gateRoot = document.querySelector('[data-reader-gate-root="true"]') as HTMLElement | null;
      const iframes = (gateRoot ? gateRoot.querySelectorAll('iframe') : document.querySelectorAll('iframe'));
      iframes.forEach((iframe) => {
        try { (iframe as HTMLIFrameElement).src = 'about:blank'; } catch {}
      });
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
    setShowReader(false);
    setReaderClosing(false);
    setReaderLoading(false);
    setReaderSource(null);
    setShareAction(null);
  };

  const handleReaderComplete = async () => {
    if (!readerSource || !user) return;
    setGateStep('reader:loading');
    setReaderLoading(true);

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
      
      toast({ title: 'Stiamo mettendo a fuoco ciò che conta…' });

      const fullContent = readerSource.content || readerSource.summary || readerSource.excerpt || post.content;

      const result = await generateQA({
        contentId: post.id,
        title: readerSource.title,
        summary: fullContent,
        userText: userText || '',
        sourceUrl: isOriginalPost ? undefined : readerSource.url,
        testMode,
        questionCount,
      });

      if (result.insufficient_context) {
        toast({ title: 'Contenuto troppo breve', description: 'Puoi comunque condividere questo post' });
        await closeReaderSafely();
        onQuoteShare?.(post);
        return;
      }

      if (!result || result.error || !result.questions?.length) {
        toast({ title: 'Errore', description: result?.error || 'Quiz non valido', variant: 'destructive' });
        setReaderLoading(false);
        return;
      }

      const sourceUrl = readerSource.url || '';
      setGateStep('quiz:mount');
      setQuizData({ questions: result.questions, sourceUrl });
      setShowQuiz(true);

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      setGateStep('reader:closing');
      setReaderClosing(true);
      await new Promise((resolve) => setTimeout(resolve, 50));

      setGateStep('reader:unmount');
      setShowReader(false);
      setReaderLoading(false);
      setReaderSource(null);
      setReaderClosing(false);
      setGateStep('quiz:shown');

    } catch (error) {
      setGateStep('error');
      toast({ title: 'Errore', description: 'Si è verificato un errore. Riprova.', variant: 'destructive' });
      setReaderLoading(false);
      setReaderClosing(false);
    }
  };

  const handleQuizSubmit = async (answers: Record<string, string>) => {
    if (!user || !quizData) return { passed: false, score: 0, total: 0, wrongIndexes: [] };

    try {
      const { data, error } = await supabase.functions.invoke('validate-answers', {
        body: { postId: post.id, sourceUrl: quizData.sourceUrl, answers, gateType: 'share' }
      });

      if (error) throw error;

      const actualPassed = data.passed && (data.total - data.score) <= 2;
      
      if (actualPassed) {
        toast({ title: 'Possiamo procedere.', description: 'Hai messo a fuoco.' });
        setShowQuiz(false);
        setQuizData(null);
        setGateStep('idle');

        if (shareAction === 'feed') {
          onQuoteShare?.({ ...post, _originalSources: Array.isArray(post.sources) ? post.sources : [] });
        } else if (shareAction === 'friend') {
          setShowPeoplePicker(true);
        }
        setShareAction(null);
      } else {
        toast({ title: "Serve ancora un po' di chiarezza.", description: 'Rileggi il contenuto e riprova.' });
        setShowQuiz(false);
        setQuizData(null);
        setShareAction(null);
        setGateStep('idle');
      }
      
      return data;
    } catch {
      toast({ title: 'Errore', description: 'Errore durante la validazione', variant: 'destructive' });
      return { passed: false, score: 0, total: 0, wrongIndexes: [] };
    }
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: it });
  const hasMedia = post.media && post.media.length > 0;
  const hasLink = !!post.shared_url;
  const isSpotify = articlePreview?.platform === 'spotify';
  const isMediaOnlyPost = hasMedia && !hasLink && !quotedPost;
  const mediaUrl = post.media?.[0]?.url;
  const isVideoMedia = post.media?.[0]?.type === 'video';
  const backgroundImage = !isMediaOnlyPost ? (articlePreview?.image || post.preview_img || (hasMedia && post.media?.[0]?.url)) : undefined;
  // Exclude quotedPost from text-only to prevent quote marks on reshares
  const isTextOnly = !hasMedia && !hasLink && !quotedPost;
  const articleTitle = articlePreview?.title || post.shared_title || '';
  const shouldShowUserText = hasLink && post.content && !isTextSimilarToTitle(post.content, articleTitle);
  
  // Reshare Stack logic: detect if this is a reshare where the QUOTED POST has short comment (<30 words)
  const quotedPostWordCount = getWordCount(quotedPost?.content || '');
  const isReshareWithShortComment = !!quotedPost && quotedPostWordCount < 30;
  
  // New: detect if reshare has a source (URL) - use stack layout for any length
  const isReshareWithSource = !!quotedPost && !!(quotedPost.shared_url || post.shared_url);
  
  // Use stack layout for: short comments OR reshares with source (any comment length)
  const useStackLayout = isReshareWithShortComment || isReshareWithSource;
  
  // Get source from quoted post if current post doesn't have one (2 levels)
  const effectiveSharedUrl = post.shared_url || quotedPost?.shared_url;
  const effectivePreviewImg = post.preview_img || quotedPost?.preview_img;
  const effectiveSharedTitle = post.shared_title || quotedPost?.shared_title;
  
  // For multi-level reshares, find the original source deep in the chain
  const { data: originalSource } = useOriginalSource(
    // Only fetch if we're a reshare stack and don't have a direct source
    useStackLayout && !effectiveSharedUrl ? post.quoted_post_id : null
  );
  
  // Final effective source: prefer direct, fallback to deep chain search
  const finalSourceUrl = effectiveSharedUrl || originalSource?.url;
  const finalSourceTitle = effectiveSharedTitle || originalSource?.title;
  const finalSourceImage = effectivePreviewImg || originalSource?.image;
  
  // Load article preview for deep chain source when available
  useEffect(() => {
    const loadDeepSourcePreview = async () => {
      // Only fetch if we have a deep source and don't have a direct URL preview
      if (!originalSource?.url || urlToPreview) return;
      
      try {
        const preview = await fetchArticlePreview(originalSource.url);
        const platform = (preview as any)?.platform || detectPlatformFromUrl(originalSource.url);
        setArticlePreview(preview ? { ...(preview as any), platform } : {
          platform,
          title: originalSource.title || getHostnameFromUrl(originalSource.url),
          description: '',
          image: originalSource.image || '',
        });
      } catch {
        setArticlePreview({
          platform: detectPlatformFromUrl(originalSource.url),
          title: originalSource.title || getHostnameFromUrl(originalSource.url),
          description: '',
          image: originalSource.image || '',
        });
      }
    };
    loadDeepSourcePreview();
  }, [originalSource, urlToPreview]);
  
  // Fetch context stack for ALL reshares (show chain for any reshare)
  const { data: contextStack = [] } = useReshareContextStack(post.quoted_post_id);
  
  // Extract dominant colors from media
  const { primary: dominantPrimary, secondary: dominantSecondary } = useDominantColors(isMediaOnlyPost ? mediaUrl : undefined);

  return (
    <>
      <div 
        className="h-[100dvh] w-full snap-start relative flex flex-col p-6 overflow-hidden"
        onClick={handleDoubleTap}
      >
        {/* Background Layer */}
        {isMediaOnlyPost && mediaUrl ? (
          <>
            {/* Dynamic gradient background from dominant colors */}
            <div 
              className="absolute inset-0 transition-colors duration-700"
              style={{ 
                background: `linear-gradient(to bottom, ${dominantPrimary}, ${dominantSecondary})` 
              }}
            />
            {/* Dark overlay for text readability */}
            <div className="absolute inset-0 bg-black/30" />
          </>
        ) : isTextOnly ? (
          <div className="absolute inset-0 bg-[#1F3347]">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10" />
          </div>
        ) : isSpotify ? (
          <div className="absolute inset-0 bg-gradient-to-b from-[#121212] via-[#1a1a2e] to-[#0d1117]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1DB954]/10 to-transparent" />
          </div>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/90 z-0" />
            {backgroundImage && (
              <img 
                src={backgroundImage} 
                className="absolute inset-0 w-full h-full object-cover opacity-60 blur-2xl scale-110 z-[-1]" 
                alt=""
              />
            )}
          </>
        )}

        {/* Heart animation */}
        {showHeartAnimation && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <Heart className="w-24 h-24 text-red-500 fill-red-500 animate-scale-in drop-shadow-lg" />
          </div>
        )}

        {/* Content Layer */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between pt-14 pb-20 sm:pb-24">
          
          {/* Top Bar */}
          <div className="flex justify-between items-start">
            {/* Author */}
            <div 
              className="flex items-center gap-3 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${post.author.id}`);
              }}
            >
              <div className="w-10 h-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-md overflow-hidden shadow-lg">
                {getAvatarContent()}
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm drop-shadow-md">
                  {post.author.full_name || getDisplayUsername(post.author.username)}
                </span>
                <span className="text-white/60 text-xs">{timeAgo}</span>
              </div>
            </div>

            {/* Trust Score / Category */}
            {hasLink && trustScore ? (
              <Dialog>
                <DialogTrigger asChild>
                  <button 
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "flex items-center gap-1.5 bg-black/30 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-full cursor-pointer hover:bg-black/40 transition-colors shadow-xl",
                      trustScore.band === 'ALTO' && "text-emerald-400",
                      trustScore.band === 'MEDIO' && "text-amber-400",
                      trustScore.band === 'BASSO' && "text-red-400"
                    )}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-[10px] font-bold tracking-wider uppercase">
                      TRUST {trustScore.band}
                    </span>
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Trust Score</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm text-muted-foreground">
                    <p>
                      Il Trust Score indica il livello di affidabilità delle fonti citate, 
                      <strong className="text-foreground"> non la verità o la qualità del contenuto</strong>.
                    </p>
                    <p>È calcolato automaticamente e può contenere errori.</p>
                    
                    {trustScore.reasons?.length > 0 && (
                      <div className="pt-3 border-t border-border">
                        <p className="font-medium text-foreground mb-2">Perché questo punteggio:</p>
                        <ul className="space-y-1.5">
                          {trustScore.reasons.map((reason: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <p className="text-xs pt-2 border-t border-border text-muted-foreground">
                      Valuta la qualità delle fonti e la coerenza col contenuto. Non è fact-checking.
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            ) : post.category ? (
              <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                <span className="text-[#0A7AFF] text-xs font-bold tracking-wide uppercase">{post.category}</span>
              </div>
            ) : null}

            {/* Menu */}
            {isOwnPost && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="p-2 rounded-full bg-black/20 backdrop-blur-md hover:bg-white/10 transition-colors">
                    <MoreHorizontal className="w-4 h-4 text-white" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      deletePost.mutate(post.id, {
                        onSuccess: () => { toast({ title: 'Post eliminato' }); onRemove?.(); },
                        onError: () => { toast({ title: 'Errore', variant: 'destructive' }); }
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

          {/* Center Content */}
          <div className="flex-1 flex flex-col justify-center px-2">
            
            {/* Stack Layout: User comment first (normal text, not bold) */}
            {useStackLayout && post.content && (
              <h2 className="text-lg font-normal text-white/90 leading-snug tracking-wide drop-shadow-md mt-4 mb-4">
                <MentionText content={post.content} />
              </h2>
            )}

            {/* Stack Layout: show context stack (reshare chain) for ALL reshares */}
            {quotedPost && contextStack.length > 0 && (
              <ReshareContextStack stack={contextStack} />
            )}
            
            {/* Stack Layout with LONG comment: show quoted post's full comment inline */}
            {useStackLayout && !isReshareWithShortComment && quotedPost && (
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                    {quotedPost.author?.avatar_url ? (
                      <img 
                        src={quotedPost.author.avatar_url} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/60 text-xs font-medium">
                        {(quotedPost.author?.full_name || quotedPost.author?.username || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-white/80 text-xs font-medium truncate">
                    {quotedPost.author?.full_name || quotedPost.author?.username}
                  </span>
                  <span className="text-white/50 text-xs truncate">
                    @{quotedPost.author?.username}
                  </span>
                </div>
                <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
                  <MentionText content={quotedPost.content} />
                </p>
              </div>
            )}

            {/* User Text Content - Show for link posts (if different from article title) - NON stack layout */}
            {!useStackLayout && shouldShowUserText && (
              <h2 className="text-lg font-normal text-white/90 leading-snug tracking-wide drop-shadow-md mb-6">
                <MentionText content={post.content.length > 280 ? post.content.slice(0, 280) + '...' : post.content} />
              </h2>
            )}
            
            {/* User Text for normal reshares (long quoted comment, no source): show current user's comment ABOVE the QuotedPostCard */}
            {!useStackLayout && quotedPost && !hasLink && post.content && (
              <h2 className="text-lg font-normal text-white/90 leading-snug tracking-wide drop-shadow-md mb-6">
                <MentionText content={post.content.length > 280 ? post.content.slice(0, 280) + '...' : post.content} />
              </h2>
            )}

            {/* User Text for media-only posts - ABOVE the media */}
            {isMediaOnlyPost && post.content && (
              <h2 className="text-xl font-medium text-white leading-snug tracking-wide drop-shadow-lg mb-6">
                <MentionText content={post.content.length > 200 ? post.content.slice(0, 200) + '...' : post.content} />
              </h2>
            )}

            {/* Framed Media Window for media-only posts - centered, reduced height (-30%) */}
            {isMediaOnlyPost && mediaUrl && (
              <button
                role="button"
                aria-label={isVideoMedia ? "Riproduci video" : "Apri immagine"}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMediaIndex(0);
                }}
                className="relative w-full max-w-[88%] mx-auto rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/10 active:scale-[0.98] transition-transform mb-6"
              >
                {isVideoMedia ? (
                  <>
                    <img 
                      src={post.media?.[0]?.thumbnail_url || mediaUrl} 
                      alt="" 
                      className="w-full h-[38vh] object-cover"
                    />
                    {/* Play icon overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="bg-white/90 backdrop-blur-sm p-4 rounded-full shadow-xl">
                        <Play className="w-8 h-8 text-black fill-black" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <img 
                      src={mediaUrl} 
                      alt="" 
                      className="w-full h-[44vh] object-cover"
                    />
                    {/* Expand pill with label */}
                    <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs font-medium text-white">Apri</span>
                    </div>
                  </>
                )}
              </button>
            )}

            {/* Spotify Card - Dedicated styling */}
            {hasLink && isSpotify ? (
              <div 
                className="cursor-pointer active:scale-[0.98] transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  if (post.shared_url) {
                    window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                {/* Spotify Artwork - Large centered square */}
                {(articlePreview?.image || post.preview_img) && (
                  <div className="flex justify-center mb-6">
                    <div className="w-56 h-56 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(29,185,84,0.3)] border border-white/10">
                      <img 
                        src={articlePreview?.image || post.preview_img} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
                
                {/* Spotify Title */}
                <h1 className="text-2xl font-bold text-white leading-tight mb-2 text-center drop-shadow-xl">
                  {articlePreview?.title || post.shared_title}
                </h1>
                
                {/* Artist name */}
                {articlePreview?.description && (
                  <p className="text-[#1DB954] text-center font-medium mb-4">
                    {articlePreview.description}
                  </p>
                )}
                
                {/* Spotify badge */}
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 bg-[#1DB954]/20 border border-[#1DB954]/30 px-4 py-2 rounded-full">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1DB954">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                    <span className="text-[#1DB954] text-xs font-bold uppercase tracking-wider">Spotify</span>
                  </div>
                </div>
              </div>
            ) : hasLink && !isReshareWithShortComment && (
              /* Generic Link Preview - Clickable to open external link */
              <div 
                className="cursor-pointer active:scale-[0.98] transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  if (post.shared_url) {
                    window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                {/* Visible Metadata Image - Taller preview */}
                {(articlePreview?.image || post.preview_img) && (
                  <div className="mb-6 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                    <img 
                      src={articlePreview?.image || post.preview_img} 
                      alt="" 
                      className="w-full h-64 object-cover"
                    />
                  </div>
                )}
                
                <div className="w-12 h-1 bg-white/30 rounded-full mb-4" />
                <h1 className="text-2xl font-bold text-white leading-tight mb-3 drop-shadow-xl">
                  {articlePreview?.title || post.shared_title || getHostnameFromUrl(post.shared_url)}
                </h1>
                <div className="flex items-center gap-2 text-white/70 mb-4">
                  <ExternalLink className="w-3 h-3" />
                  <span className="text-xs uppercase font-bold tracking-widest">
                    {getHostnameFromUrl(post.shared_url)}
                  </span>
                </div>
              </div>
            )}

            {/* Stack Layout: Source Preview LAST (uses deep chain source) */}
            {useStackLayout && finalSourceUrl && (
              <div 
                className="cursor-pointer active:scale-[0.98] transition-transform mt-4"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(finalSourceUrl, '_blank', 'noopener,noreferrer');
                }}
              >
                {/* Source Image */}
                {(articlePreview?.image || finalSourceImage) && (
                  <div className="mb-3 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                    <img 
                      src={articlePreview?.image || finalSourceImage} 
                      alt="" 
                      className="w-full h-40 sm:h-48 object-cover"
                    />
                  </div>
                )}
                
                {/* Source Title */}
                <h1 className="text-lg font-semibold text-white leading-tight mb-1 drop-shadow-xl">
                  {articlePreview?.title || finalSourceTitle || getHostnameFromUrl(finalSourceUrl)}
                </h1>
                <div className="flex items-center gap-2 text-white/60">
                  <ExternalLink className="w-3 h-3" />
                  <span className="text-xs uppercase tracking-widest">
                    {getHostnameFromUrl(finalSourceUrl)}
                  </span>
                </div>
              </div>
            )}

            {/* Quoted Post - Only for reshares WITHOUT source (pure comment reshares) */}
            {quotedPost && !useStackLayout && (
              <div className="mt-4">
                <QuotedPostCard 
                  quotedPost={quotedPost} 
                  parentSources={post.shared_url ? [post.shared_url, ...(post.sources || [])] : (post.sources || [])} 
                />
              </div>
            )}

          </div>

          {/* Flexible spacer with minimum gap for small screens */}
          <div className="min-h-4 sm:min-h-0 flex-shrink-0" />

          {/* Bottom Actions - Aligned heights h-10, mr-16 for FAB clearance */}
          <div className="flex items-center justify-between gap-3 mr-16">
            
            {/* Primary Share Button - h-10 px-4 to match reactions */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleShareClick(e);
              }}
              className="h-10 px-4 bg-white hover:bg-gray-50 text-[#1F3347] font-bold rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Logo variant="icon" size="sm" className="h-4 w-4" />
              <span className="text-sm font-semibold leading-none">Condividi</span>
            </button>

            {/* Reactions - Horizontal layout h-10 matching share button */}
            <div className="flex items-center gap-1 bg-black/20 backdrop-blur-xl h-10 px-3 rounded-2xl border border-white/5">
              
              {/* Like */}
              <button 
                className="flex items-center justify-center gap-1.5 h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
                onClick={(e) => { e.stopPropagation(); handleHeart(e); }}
              >
                <Heart 
                  className={cn("w-5 h-5", post.user_reactions.has_hearted ? "text-red-500 fill-red-500" : "text-white")}
                  fill={post.user_reactions.has_hearted ? "currentColor" : "none"}
                />
                <span className="text-xs font-bold text-white">{post.reactions.hearts}</span>
              </button>

              {/* Comments */}
              <button 
                className="flex items-center justify-center gap-1.5 h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
                onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
              >
                <MessageCircle className="w-5 h-5 text-white" />
                <span className="text-xs font-bold text-white">{post.reactions.comments}</span>
              </button>

              {/* Bookmark */}
              <button 
                className="flex items-center justify-center h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
                onClick={handleBookmark}
              >
                <Bookmark 
                  className={cn("w-5 h-5", post.user_reactions.has_bookmarked ? "text-blue-400 fill-blue-400" : "text-white")}
                  fill={post.user_reactions.has_bookmarked ? "currentColor" : "none"}
                />
              </button>

            </div>
          </div>

        </div>
      </div>

      {/* Reader Modal */}
      {showReader && readerSource && (
        <div className="fixed inset-0 z-[10040]">
          <SourceReaderGate
            source={readerSource}
            isOpen={showReader}
            isClosing={readerClosing}
            isLoading={readerLoading}
            onClose={async () => {
              if (readerLoading) return;
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

      {/* Quiz Modal */}
      {showQuiz && quizData && !quizData.error && quizData.questions && (
        <div className="fixed inset-0 z-[10060]">
          <QuizModal
            questions={quizData.questions}
            onSubmit={handleQuizSubmit}
            onCancel={() => {
              setShowQuiz(false);
              setQuizData(null);
              setGateStep('idle');
            }}
          />
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
          for (const userId of userIds) {
            try {
              const threadResult = await createThread.mutateAsync([userId]);
              if (threadResult?.thread_id) {
                const shareMessage = post.shared_url 
                  ? `${post.content}\n\n${post.shared_url}`
                  : post.content;
                await sendMessage.mutateAsync({
                  threadId: threadResult.thread_id,
                  content: shareMessage,
                  linkUrl: post.shared_url || undefined
                });
              }
            } catch {}
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

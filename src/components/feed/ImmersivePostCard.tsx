import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Trash2, ExternalLink, ShieldCheck, ShieldAlert, AlertTriangle, Quote } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

// UI Components
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
import { QuotedPostCard } from "./QuotedPostCard";
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

  // Fetch article preview
  useEffect(() => {
    const loadArticlePreview = async () => {
      if (!post.shared_url) {
        setArticlePreview(null);
        return;
      }
      try {
        const preview = await fetchArticlePreview(post.shared_url);
        const platform = (preview as any)?.platform || detectPlatformFromUrl(post.shared_url);
        setArticlePreview(preview ? { ...(preview as any), platform } : {
          platform,
          title: post.shared_title || getHostnameFromUrl(post.shared_url),
          description: '',
          image: post.preview_img || '',
        });
      } catch {
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
    
    if (post.shared_url) {
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
    
    if (post.shared_url) {
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
    if (!post.shared_url || !user) return;

    try {
      const host = new URL(post.shared_url).hostname.toLowerCase();
      if (host.includes('instagram.com') || host.includes('facebook.com') || host.includes('m.facebook.com') || host.includes('fb.com') || host.includes('fb.watch')) {
        toast({ title: 'Link non supportato', description: 'Instagram e Facebook non sono supportati.' });
        window.open(post.shared_url, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch {}

    toast({ title: 'Caricamento contenuto...', description: 'Preparazione del Comprehension Gate' });

    const preview = await fetchArticlePreview(post.shared_url);
    let hostname = '';
    try { hostname = new URL(post.shared_url).hostname.replace('www.', ''); } catch {}

    setReaderSource({
      ...preview,
      id: post.id,
      state: 'reading' as const,
      url: post.shared_url,
      title: preview?.title || post.shared_title || `Contenuto da ${hostname}`,
      content: preview?.content || preview?.description || preview?.summary || preview?.excerpt || post.content || '',
      summary: preview?.summary || preview?.description || 'Apri il link per visualizzare il contenuto completo.',
      image: preview?.image || post.preview_img || '',
      platform: preview?.platform || detectPlatformFromUrl(post.shared_url),
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
  const backgroundImage = articlePreview?.image || post.preview_img || (hasMedia && post.media?.[0]?.url);
  const isTextOnly = !hasMedia && !hasLink;

  return (
    <>
      <div 
        className="h-[100dvh] w-full snap-start relative flex flex-col p-6 overflow-hidden"
        onClick={handleDoubleTap}
      >
        {/* Background Layer */}
        {isTextOnly ? (
          <div className="absolute inset-0 bg-[#1F3347]">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10" />
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
        <div className="relative z-10 w-full h-full flex flex-col justify-between pt-14 pb-24">
          
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
              <div className={cn(
                "flex items-center gap-1.5 bg-black/30 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-full shadow-xl",
                trustScore.band === 'ALTO' && "text-emerald-400",
                trustScore.band === 'MEDIO' && "text-amber-400",
                trustScore.band === 'BASSO' && "text-red-400"
              )}>
                {trustScore.band === "ALTO" && <ShieldCheck className="w-4 h-4" />}
                {trustScore.band === "MEDIO" && <ShieldAlert className="w-4 h-4" />}
                {trustScore.band === "BASSO" && <AlertTriangle className="w-4 h-4" />}
                <span className="text-[10px] font-bold tracking-wider">TRUST {trustScore.band}</span>
              </div>
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
            
            {/* Link Preview Title */}
            {hasLink && (
              <>
                <div className="w-12 h-1 bg-white/30 rounded-full mb-6" />
                <h1 className="text-3xl font-bold text-white leading-tight mb-4 drop-shadow-xl">
                  {articlePreview?.title || post.shared_title || getHostnameFromUrl(post.shared_url)}
                </h1>
                <div className="flex items-center gap-2 text-white/70 mb-4">
                  <span className="text-xs uppercase font-bold tracking-widest">
                    {getHostnameFromUrl(post.shared_url)}
                  </span>
                </div>
              </>
            )}

            {/* Text Content */}
            {isTextOnly && (
              <Quote className="text-white/20 w-12 h-12 rotate-180 mb-4" />
            )}
            <h2 className={cn(
              "text-white leading-snug tracking-wide drop-shadow-md",
              isTextOnly ? "text-2xl font-medium" : "text-lg font-normal text-white/90"
            )}>
              <MentionText content={post.content.length > 280 ? post.content.slice(0, 280) + '...' : post.content} />
            </h2>

            {/* Media */}
            {hasMedia && (
              <div className="mt-6">
                <MediaGallery 
                  media={post.media!}
                  onClick={(_, index) => setSelectedMediaIndex(index)}
                />
              </div>
            )}

            {/* Quoted Post */}
            {quotedPost && (
              <div className="mt-4">
                <QuotedPostCard 
                  quotedPost={quotedPost} 
                  parentSources={post.shared_url ? [post.shared_url, ...(post.sources || [])] : (post.sources || [])} 
                />
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-col gap-5">
            <div className="flex items-end justify-between gap-4">
              
              {/* Primary Gate Button */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleShareClick(e);
                }}
                className="flex-1 h-14 bg-white hover:bg-gray-50 text-[#1F3347] font-bold rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                👁️ <span className="text-base">Metti a fuoco</span>
              </button>

              {/* Reactions */}
              <div className="flex items-center gap-4 bg-black/20 backdrop-blur-xl p-2 pr-4 rounded-2xl border border-white/5">
                
                {/* Like */}
                <div 
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleHeart(e);
                  }}
                >
                  <div className="p-2 rounded-full group-hover:bg-white/10 transition-colors">
                    <Heart 
                      className={cn(
                        "w-6 h-6 transition-all",
                        post.user_reactions.has_hearted ? "text-red-500 fill-red-500" : "text-white"
                      )}
                      fill={post.user_reactions.has_hearted ? "currentColor" : "none"}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-white">{post.reactions.hearts}</span>
                </div>

                {/* Comments */}
                <div 
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowComments(true);
                  }}
                >
                  <div className="p-2 rounded-full group-hover:bg-white/10 transition-colors">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[10px] font-bold text-white">{post.reactions.comments}</span>
                </div>

                {/* Bookmark */}
                <div 
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                  onClick={handleBookmark}
                >
                  <div className="p-2 rounded-full group-hover:bg-white/10 transition-colors">
                    <Bookmark 
                      className={cn(
                        "w-6 h-6 transition-all",
                        post.user_reactions.has_bookmarked ? "text-blue-400 fill-blue-400" : "text-white"
                      )}
                      fill={post.user_reactions.has_bookmarked ? "currentColor" : "none"}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-white">Salva</span>
                </div>

              </div>
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

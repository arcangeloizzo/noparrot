import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HeartIcon, MessageCircleIcon, BookmarkIcon, MoreHorizontal, EyeOff, Share2 } from "lucide-react";
import { TrustBadge } from "@/components/ui/trust-badge";
import { fetchTrustScore } from "@/lib/comprehension-gate";
import { cn } from "@/lib/utils";
import { MockPost } from "@/data/mockData";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommentReplySheet } from "./CommentReplySheet";
import { generateQA, validateAnswers, fetchArticlePreview } from "@/lib/ai-helpers";
import { QuizModal } from "@/components/ui/quiz-modal";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ShareSheet } from "@/components/share/ShareSheet";
import { PeoplePicker } from "@/components/share/PeoplePicker";
import { useCreateThread } from "@/hooks/useMessageThreads";
import { useSendMessage } from "@/hooks/useMessages";
import { runGateBeforeAction } from "@/lib/runGateBeforeAction";
import { haptics } from "@/lib/haptics";
import { ComposerModal } from "@/components/composer/ComposerModal";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { CategoryChip } from "@/components/ui/category-chip";

interface FeedCardProps {
  post: MockPost;
  onOpenReader?: () => void;
  onRemove?: () => void;
}

const getTimeAgo = (timestamp: number) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

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
  onRemove 
}: FeedCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createThread = useCreateThread();
  const sendMessage = useSendMessage();
  
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked);
  const [trustScore, setTrustScore] = useState<any>(null);
  const [loadingTrust, setLoadingTrust] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  
  const [showCommentReply, setShowCommentReply] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizData, setQuizData] = useState<any>(null);
  const [articlePreview, setArticlePreview] = useState<any>(null);
  const [shouldBlinkShare, setShouldBlinkShare] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [quotedPostId, setQuotedPostId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate avatar with initials if no image
  const getAvatarContent = () => {
    if (post.avatar) {
      return <img src={post.avatar} alt={post.authorName} className="w-full h-full object-cover" />;
    }
    
    const initials = post.authorName.split(' ').map(n => n[0]).join('').toUpperCase();
    const hashCode = post.authorName.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const colors = ['#1D9BF0', '#E41E52', '#FFD464', '#BFE9E9'];
    const color = colors[Math.abs(hashCode) % colors.length];
    
    return (
      <div 
        className="w-full h-full flex items-center justify-center text-white text-sm font-semibold"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
    );
  };

  const formatTimeAgo = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}g`;
  };

  // Load trust score and article preview for posts with sources
  useEffect(() => {
    if (post.url && !trustScore && !loadingTrust) {
      setLoadingTrust(true);
      fetchTrustScore({
        postText: post.userComment || "",
        sources: [post.url],
        userMeta: { verified: post.authorName.includes("Verified") }
      })
      .then(setTrustScore)
      .catch(console.error)
      .finally(() => setLoadingTrust(false));
    }
    
    // Always fetch article preview for better display
    if (post.url && !articlePreview) {
      fetchArticlePreview(post.url).then(preview => {
        if (preview) {
          console.log('[FeedCard] Loaded preview:', preview);
          setArticlePreview(preview);
        }
      });
    }
  }, [post.url, trustScore, loadingTrust, articlePreview]);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
      toast.error('Login richiesto', {
        description: 'Devi essere autenticato per condividere'
      });
      return;
    }

    setShouldBlinkShare(true);
    haptics.light();
    setTimeout(() => setShouldBlinkShare(false), 300);

    // Mostra SEMPRE lo ShareSheet per scegliere tra feed/amici
    setShowShareSheet(true);
  };

  const handleShareToFeed = async () => {
    setShowShareSheet(false);
    
    if (!post.url) {
      // Nessun link: apri composer diretto
      setShowComposer(true);
      setQuotedPostId(post.id);
      return;
    }

    // Ha un link: Gate necessario
    await runGateBeforeAction({
      linkUrl: post.url,
      onSuccess: () => {
        setShowComposer(true);
        setQuotedPostId(post.id);
      },
      onCancel: () => {},
      setIsProcessing,
      setQuizData,
      setShowQuiz
    });
  };

  const handleShareToFriend = () => {
    setShowShareSheet(false);
    setShowPeoplePicker(true);
  };

  const handleSendToFriends = async (userIds: string[]) => {
    if (!user || userIds.length === 0) return;

    setSelectedUserIds(userIds);
    setShowPeoplePicker(false);

    // Se il post ha un link, richiedi Gate prima di inviare
    if (post.url) {
      setIsProcessing(true);
      
      await runGateBeforeAction({
        linkUrl: post.url,
        onSuccess: async () => {
          await sendMessagesToUsers(userIds);
        },
        onCancel: () => {
          setIsProcessing(false);
          toast.error('Invio annullato');
        },
        setIsProcessing,
        setQuizData,
        setShowQuiz
      });
    } else {
      // Nessun link, invia direttamente
      await sendMessagesToUsers(userIds);
    }
  };

  const sendMessagesToUsers = async (userIds: string[]) => {
    try {
      let successCount = 0;
      
      for (const recipientId of userIds) {
        try {
          // Crea o trova thread
          const result = await createThread.mutateAsync([recipientId]);

          // Invia messaggio
          const messageContent = post.url 
            ? `${post.userComment}\n\n${post.url}`
            : post.userComment;

          await sendMessage.mutateAsync({
            threadId: result.thread_id,
            content: messageContent,
            linkUrl: post.url || undefined
          });

          successCount++;
        } catch (error) {
          console.error(`Errore invio a utente ${recipientId}:`, error);
        }
      }

      if (successCount === userIds.length) {
        toast.success('Messaggio inviato!', {
          description: `Inviato a ${successCount} ${successCount === 1 ? 'persona' : 'persone'}`
        });
      } else if (successCount > 0) {
        toast.warning('Invio parziale', {
          description: `Inviato a ${successCount}/${userIds.length} persone`
        });
      } else {
        toast.error('Errore', {
          description: 'Impossibile inviare i messaggi'
        });
      }
    } catch (error) {
      console.error('Errore invio messaggi:', error);
      toast.error('Errore', {
        description: 'Impossibile inviare i messaggi'
      });
    } finally {
      setIsProcessing(false);
      setSelectedUserIds([]);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    setTouchEnd(e.targetTouches[0].clientX);
    const offset = touchStart - e.targetTouches[0].clientX;
    if (offset > 0) {
      setSwipeOffset(Math.min(offset, 80));
    }
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    
    if (isLeftSwipe && onOpenReader) {
      onOpenReader();
    }
    
    setSwipeOffset(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Debug log
  console.log('[FeedCard] Rendering with cognitive-capsule class');

  return (
    <>
      <article 
        className="cognitive-capsule" 
        data-read="false"
        data-reading="false"
        data-understood="false"
        style={{
          transform: `translateX(-${swipeOffset}px)`,
          transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
      <div className="cognitive-capsule-content">
      <div className="flex gap-3">
        {/* Avatar */}
        <div 
          className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/profile/${post.author_id}`);
          }}
        >
          {getAvatarContent()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0" onClick={() => navigate(`/post/${post.id}`)}>
          {/* User Info */}
          <div className="flex items-center gap-1 mb-1">
            <span 
              className="cognitive-text-primary font-semibold text-[15px] hover:underline cursor-pointer" 
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${post.author_id}`);
              }}
            >
              {post.authorName}
            </span>
            <span className="cognitive-text-secondary text-[15px]">·</span>
            <span className="cognitive-text-secondary text-[15px]">{formatTimeAgo(post.minutesAgo)}</span>
            
            {/* More Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="ml-auto p-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRemove?.(); }}>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Nascondi questo post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Comment */}
          <p className="cognitive-text-primary text-[15px] leading-5 mb-3 whitespace-pre-wrap">
            {post.userComment}
          </p>

          {/* Category Chip */}
          {post.category && (
            <div className="mb-3">
              <CategoryChip category={post.category} />
            </div>
          )}

          {/* Article Preview */}
          {post.url && (
            <div 
              className="cognitive-article-preview border border-border rounded-2xl overflow-hidden mb-3"
              onClick={(e) => e.stopPropagation()}
            >
              {(articlePreview?.image || articlePreview?.previewImg || post.previewImg) && (
                <div className="w-full aspect-video bg-muted relative">
                  <img 
                    src={articlePreview?.image || articlePreview?.previewImg || post.previewImg} 
                    alt="Article preview" 
                    className="w-full h-full object-cover"
                  />
                  {articlePreview?.platform === 'youtube' && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                        <div className="w-0 h-0 border-t-8 border-t-transparent border-l-12 border-l-white border-b-8 border-b-transparent ml-1"></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="p-3">
                {/* Social Media Platform Badges */}
                {articlePreview?.platform === 'twitter' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center">
                      <span className="text-xs font-bold text-white">𝕏</span>
                    </div>
                    <span className="text-sm font-semibold">
                      {articlePreview.author_username ? `@${articlePreview.author_username}` : 'Twitter/X'}
                    </span>
                  </div>
                )}
                {articlePreview?.platform === 'linkedin' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-[#0A66C2] flex items-center justify-center">
                      <span className="text-xs font-bold text-white">in</span>
                    </div>
                    <span className="text-sm font-semibold text-[#0A66C2]">LinkedIn</span>
                    {articlePreview.author && (
                      <span className="text-xs text-muted-foreground">• {articlePreview.author}</span>
                    )}
                  </div>
                )}
                {articlePreview?.platform === 'instagram' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#FCAF45] via-[#E1306C] to-[#833AB4] flex items-center justify-center">
                      <span className="text-xs font-bold text-white">📷</span>
                    </div>
                    <span className="text-sm font-semibold">Instagram</span>
                  </div>
                )}
                {articlePreview?.platform === 'threads' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center">
                      <span className="text-xs font-bold text-white">🧵</span>
                    </div>
                    <span className="text-sm font-semibold">Threads</span>
                  </div>
                )}
                {articlePreview?.platform === 'youtube' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
                      <span className="text-xs font-semibold text-white">▶</span>
                    </div>
                    <span className="text-sm font-semibold text-red-600">YouTube</span>
                    {articlePreview.transcriptSource === 'youtube_captions' && (
                      <span className="text-xs px-2 py-0.5 bg-trust-high/10 text-trust-high rounded-full">
                        📝 Con trascrizione
                      </span>
                    )}
                  </div>
                )}
                <p className="cognitive-meta text-xs mb-1">
                  {getHostnameFromUrl(post.url)}
                </p>
                <h3 className="cognitive-article-title text-sm font-medium line-clamp-2 mb-1">
                  {post.sharedTitle || articlePreview?.title || 'Articolo condiviso'}
                </h3>
                {articlePreview?.content && articlePreview.platform === 'twitter' ? (
                  <p className="cognitive-text-secondary text-sm line-clamp-3">
                    {articlePreview.content}
                  </p>
                ) : (
                  <p className="cognitive-text-secondary text-sm line-clamp-3">
                    {articlePreview?.summary || articlePreview?.excerpt}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Trust Score */}
          {(trustScore || post.url) && (
            <div className="mb-3" onClick={(e) => e.stopPropagation()}>
              {trustScore ? (
                <TrustBadge
                  band={trustScore.band}
                  score={trustScore.score}
                  reasons={trustScore.reasons}
                  size="md"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                />
              ) : loadingTrust ? (
                <div className="flex items-center gap-2 opacity-60">
                  <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
                  <div className="w-16 h-3 bg-muted animate-pulse rounded" />
                </div>
              ) : (
                <TrustBadge size="sm" className="opacity-60 hover:opacity-100 transition-opacity" />
              )}
            </div>
          )}

          {/* Actions Bar */}
          <div className="cognitive-actions flex items-center justify-between max-w-md -ml-2">
            <button 
              onClick={(e) => { 
                e.stopPropagation();
                navigate(`/post/${post.id}`);
              }}
              className="cognitive-action-btn"
            >
              <MessageCircleIcon className="w-5 h-5" />
              <span className="text-sm">
                {post.reactions.comments}
              </span>
            </button>

            <button 
              onClick={handleShare}
              className={cn(
                "cognitive-action-btn",
                shouldBlinkShare && "animate-blink-parrot"
              )}
            >
              <Share2 className="w-5 h-5" />
              <span className="text-sm">
                {Math.floor(post.reactions.heart / 10)}
              </span>
            </button>

            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                setIsLiked(!isLiked);
                haptics.light();
              }}
              className={cn("cognitive-action-btn", isLiked && "active")}
            >
              <HeartIcon 
                className={cn(
                  "w-5 h-5 transition-all duration-200",
                  isLiked && "fill-current scale-110"
                )}
              />
              <span className="text-sm">
                {post.reactions.heart + (isLiked ? 1 : 0)}
              </span>
            </button>

            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                setIsBookmarked(!isBookmarked);
                haptics.light();
              }}
              className={cn("cognitive-action-btn", isBookmarked && "active")}
            >
              <BookmarkIcon 
                className={cn(
                  "w-5 h-5 transition-all duration-200",
                  isBookmarked && "fill-current scale-110"
                )}
              />
            </button>
          </div>

        </div>
      </div>
      </div>
    </article>

    <CommentReplySheet
      post={post as any}
      isOpen={showCommentReply}
      onClose={() => setShowCommentReply(false)}
    />
    
    {/* Composer Modal for quoting */}
    {showComposer && quotedPostId && (
      <ComposerModal
        isOpen={showComposer}
        onClose={() => {
          setShowComposer(false);
          setQuotedPostId(null);
        }}
        quotedPost={post}
      />
    )}

    {/* Quiz Modal for Share Gate */}
    {showQuiz && quizData && user && (
      <QuizModal
        questions={quizData.questions}
        provider="gemini"
        onSubmit={async (answers) => {
          const result = await validateAnswers({
            postId: quizData.postId,
            sourceUrl: quizData.sourceUrl,
            answers,
            gateType: 'share'
          });

          if (result.passed) {
            haptics.success();
            // Esegui callback onSuccess
            if (quizData.onSuccess) {
              quizData.onSuccess();
            }
            setShowQuiz(false);
            setQuizData(null);
          }

          return result;
        }}
        onCancel={() => {
          if (quizData.onCancel) {
            quizData.onCancel();
          }
          setShowQuiz(false);
          setQuizData(null);
        }}
      />
    )}

    {/* Loading Overlay */}
    {isProcessing && (
      <LoadingOverlay 
        message="Caricamento contenuto..."
        submessage="Preparazione del Comprehension Gate"
      />
    )}

    {/* ShareSheet */}
    <ShareSheet
      isOpen={showShareSheet}
      onClose={() => setShowShareSheet(false)}
      onShareToFeed={handleShareToFeed}
      onShareToFriend={handleShareToFriend}
    />

    {/* People Picker per condivisione */}
    <PeoplePicker
      isOpen={showPeoplePicker}
      onClose={() => setShowPeoplePicker(false)}
      onSend={handleSendToFriends}
    />
  </>
  );
};

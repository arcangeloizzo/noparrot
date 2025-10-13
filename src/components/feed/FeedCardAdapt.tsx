import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { HeartIcon, MessageCircleIcon, BookmarkIcon, MoreHorizontal, EyeOff, ExternalLink } from "lucide-react";
import { TrustBadge } from "@/components/ui/trust-badge";
import { fetchTrustScore } from "@/lib/comprehension-gate";
import { cn, getDisplayUsername } from "@/lib/utils";
import { Post } from "@/hooks/usePosts";
import { useToggleReaction } from "@/hooks/usePosts";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommentsSheet } from "./CommentsSheet";
import { SourceReaderGate } from "../composer/SourceReaderGate";
import { QuizModal } from "@/components/ui/quiz-modal";
import { PostTestActionsModal } from "./PostTestActionsModal";
import { QuotedPostCard } from "./QuotedPostCard";
import { generateQA, fetchArticlePreview } from "@/lib/ai-helpers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

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
  const [showComments, setShowComments] = useState(false);
  const [commentMode, setCommentMode] = useState<'view' | 'reply'>('view');
  
  // Swipe gesture states
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  
  // Gate states
  const [showReader, setShowReader] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [readerSource, setReaderSource] = useState<any>(null);
  const [quizData, setQuizData] = useState<any>(null);

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

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const currentTouch = e.targetTouches[0].clientX;
    setTouchEnd(currentTouch);
    const offset = touchStart - currentTouch;
    if (offset > 0) {
      setSwipeOffset(Math.min(offset, 80));
    }
  };

  const handleTouchEnd = async () => {
    if (!touchStart || touchEnd === null) {
      setSwipeOffset(0);
      return;
    }

    const distance = touchStart - touchEnd;
    
    // Swipe left detected on post with source
    if (distance > 50 && post.shared_url) {
      await startComprehensionGate();
    }
    
    // Reset
    setSwipeOffset(0);
    setTouchStart(null);
    setTouchEnd(null);
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

    // Show Reader
    setReaderSource({
      url: post.shared_url,
      title: preview.title || post.shared_title || '',
      content: preview.excerpt || preview.summary || '',
      ...preview
    });
    setShowReader(true);
  };

  const handleReaderComplete = async () => {
    setShowReader(false);
    
    if (!readerSource || !user) return;

    toast({
      title: 'Generazione Q&A...',
      description: 'Creazione del test di comprensione'
    });

    const result = await generateQA({
      contentId: post.id,
      title: readerSource.title,
      summary: readerSource.content,
      sourceUrl: readerSource.url,
    });

    if (result.error || !result.questions) {
      toast({
        title: 'Errore',
        description: result.error || 'Impossibile generare Q&A',
        variant: 'destructive'
      });
      return;
    }

    setQuizData({
      questions: result.questions,
      sourceUrl: readerSource.url
    });
    setShowQuiz(true);
  };

  const handleQuizSubmit = async (answers: Record<string, string>) => {
    if (!user || !quizData) return { passed: false, score: 0, total: 0, wrongIndexes: [] };

    try {
      const { data, error } = await supabase.functions.invoke('validate-answers', {
        body: {
          postId: post.id,
          sourceUrl: quizData.sourceUrl,
          answers,
          userId: user.id,
          gateType: 'share'
        }
      });

      if (error) throw error;

      if (data.passed) {
        setShowQuiz(false);
        setQuizData(null);
        setShowActionsModal(true);
      } else {
        toast({
          title: 'Test Non Superato',
          description: `Punteggio: ${data.score}/${data.total}`,
          variant: 'destructive'
        });
      }

      setShowQuiz(false);
      setQuizData(null);
      
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

  return (
    <>
      <div 
        className="p-4 hover:bg-muted/30 transition-colors cursor-pointer relative"
        style={{ transform: `translateX(-${swipeOffset}px)` }}
        onClick={() => {
          setCommentMode('view');
          setShowComments(true);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div 
              className="w-10 h-10 rounded-full overflow-hidden bg-muted cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${post.author.id}`);
              }}
            >
              {getAvatarContent()}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
              <span 
                className="font-semibold text-foreground hover:underline text-sm cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${post.author.id}`);
                }}
              >
                {post.author.full_name || getDisplayUsername(post.author.username)}
              </span>
              <span className="text-muted-foreground text-sm">
                @{getDisplayUsername(post.author.username)}
              </span>
              <span className="text-muted-foreground text-sm">·</span>
              <span className="text-muted-foreground text-sm">
                {timeAgo}
              </span>

              {/* Actions Menu */}
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="p-1.5 hover:bg-primary/10 rounded-full transition-colors text-muted-foreground hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      onRemove?.();
                    }}>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Nascondi post
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* User Comment */}
            <div className="mb-3 text-foreground text-[15px] leading-normal whitespace-pre-wrap break-words">
              {post.content}
            </div>

            {/* Quoted Post removed temporarily - will fix query */}

            {/* Article Preview Card */}
            {post.shared_url && (
              <div 
                className="mb-3 border border-border rounded-2xl overflow-hidden hover:bg-accent/10 hover:border-accent/50 transition-all cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                }}
              >
                {post.preview_img && (
                  <div className="aspect-video w-full overflow-hidden bg-muted">
                    <img 
                      src={post.preview_img}
                      alt={post.shared_title || ''}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>{getHostnameFromUrl(post.shared_url)}</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="font-semibold text-sm text-foreground line-clamp-2 group-hover:text-accent transition-colors">
                    {post.shared_title}
                  </div>
                </div>
              </div>
            )}

            {/* Trust Badge */}
            {post.trust_level && (
              <div className="mb-3 flex items-center gap-2">
                <TrustBadge 
                  band={post.trust_level}
                  score={post.trust_level === 'ALTO' ? 85 : post.trust_level === 'MEDIO' ? 60 : 35}
                  size="sm"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-6 text-muted-foreground mt-3">
              <button 
                className="flex items-center gap-2 hover:text-primary transition-colors group"
                onClick={handleHeart}
              >
                <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                  <HeartIcon 
                    className={cn(
                      "w-[18px] h-[18px] transition-all",
                      post.user_reactions.has_hearted && "fill-primary stroke-primary"
                    )}
                  />
                </div>
                <span className="text-sm">{post.reactions.hearts}</span>
              </button>

              <button 
                className="flex items-center gap-2 hover:text-primary transition-colors group"
                onClick={(e) => {
                  e.stopPropagation();
                  setCommentMode('reply');
                  setShowComments(true);
                }}
              >
                <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                  <MessageCircleIcon className="w-[18px] h-[18px]" />
                </div>
                <span className="text-sm">{post.reactions.comments}</span>
              </button>

              <button 
                className="flex items-center gap-2 hover:text-primary transition-colors group ml-auto"
                onClick={handleBookmark}
              >
                <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                  <BookmarkIcon 
                    className={cn(
                      "w-[18px] h-[18px] transition-all",
                      post.user_reactions.has_bookmarked && "fill-primary stroke-primary"
                    )}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <CommentsSheet
        post={post}
        isOpen={showComments}
        onClose={() => {
          setShowComments(false);
          setCommentMode('view');
        }}
        mode={commentMode}
      />

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

      {/* Post Test Actions Modal - Rendered via Portal */}
      {showActionsModal && createPortal(
        <PostTestActionsModal
          post={post}
          isOpen={showActionsModal}
          onClose={() => setShowActionsModal(false)}
          onShare={() => {
            setShowActionsModal(false);
            onQuoteShare?.(post);
          }}
        />,
        document.body
      )}
    </>
  );
};

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { HeartIcon, MessageCircleIcon, BookmarkIcon, MoreHorizontal, EyeOff, ExternalLink } from "lucide-react";
import { TrustBadge } from "@/components/ui/trust-badge";
import { fetchTrustScore } from "@/lib/comprehension-gate";
import { cn, getDisplayUsername } from "@/lib/utils";
import { Post, useQuotedPost } from "@/hooks/usePosts";
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
import { PostHeader } from "./PostHeader";
import { MediaGallery } from "@/components/media/MediaGallery";
import { MediaViewer } from "@/components/media/MediaViewer";
import { uniqueSources } from "@/lib/url";

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
  const [showComments, setShowComments] = useState(false);
  const [commentMode, setCommentMode] = useState<'view' | 'reply'>('view');
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  
  // Article preview state
  const [articlePreview, setArticlePreview] = useState<any>(null);
  
  // Remove swipe gesture states - no longer needed
  
  // Gate states
  const [showReader, setShowReader] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [readerSource, setReaderSource] = useState<any>(null);
  const [quizData, setQuizData] = useState<any>(null);
  
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

  // Share button handler
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

    // Se ha shared_url → apri reader
    if (post.shared_url) {
      await startComprehensionGate();
      return;
    }

    // Altrimenti controlla word count
    const wordCount = post.content.trim().split(/\s+/).length;
    
    if (wordCount < 150) {
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

    // Show Reader with FULL content
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
          userId: user.id,
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
        onQuoteShare?.({
          ...post,
          _originalSources: Array.isArray(post.sources) ? post.sources : []
        });
      } else {
        console.warn('Test failed, NOT opening composer');
        toast({
          title: 'Test Non Superato',
          description: `Punteggio: ${data.score}/${data.total} (${((data.score / data.total) * 100).toFixed(0)}%). Serve almeno 66%!`,
          variant: 'destructive'
        });
        setShowQuiz(false);
        setQuizData(null);
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
      <div 
        className="px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer relative max-w-[600px] mx-auto"
        onClick={() => {
          navigate(`/post/${post.id}`);
        }}
      >
        <div className="flex gap-3">
          {/* Avatar a sinistra */}
          <div 
            className="flex-shrink-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${post.author.id}`);
            }}
          >
            <div className="w-10 h-10 rounded-full overflow-hidden">
              {getAvatarContent()}
            </div>
          </div>
          
          {/* Content a destra, allineato con l'avatar */}
          <div className="flex-1 min-w-0">
            {/* Header SENZA avatar */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div 
                className="flex-1 min-w-0 cursor-pointer" 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${post.author.id}`);
                }}
              >
                <PostHeader
                  displayName={post.author.full_name || getDisplayUsername(post.author.username)}
                  username={getDisplayUsername(post.author.username)}
                  timestamp={timeAgo}
                  label={post.stance === 'Condiviso' ? 'Condiviso' : post.stance === 'Confutato' ? 'Confutato' : undefined}
                  avatarUrl={null}
                />
              </div>

              {/* Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="p-1.5 hover:bg-primary/10 rounded-full transition-colors text-muted-foreground hover:text-primary flex-shrink-0"
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

            {/* User Comment */}
            <div className="mb-2 text-foreground text-[15px] leading-5 whitespace-pre-wrap break-words">
              {post.content}
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

            {/* Article Preview Card */}
            {post.shared_url && (
              <div 
                className="mb-3 border border-border rounded-2xl overflow-hidden hover:bg-accent/10 hover:border-accent/50 transition-all cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                }}
              >
                {(articlePreview?.image || post.preview_img) && (
                  <div className="aspect-video w-full overflow-hidden bg-muted">
                    <img 
                      src={articlePreview?.image || post.preview_img}
                      alt={articlePreview?.title || post.shared_title || ''}
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
                    {articlePreview?.title || post.shared_title || 'Post condiviso'}
                  </div>
                </div>
              </div>
            )}

            {/* Trust Badge - Mostra solo per post con fonte */}
            {trustScore && post.shared_url && (
              <div 
                className="mb-3 flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <TrustBadge 
                  band={trustScore.band}
                  score={trustScore.score}
                  reasons={trustScore.reasons}
                  size="sm"
                />
              </div>
            )}

            {/* Actions - Like, Comments, Share, Save */}
            <div className="flex items-center justify-between -ml-2">
              <div className="flex items-center gap-4">
                <button 
                  className="flex items-center gap-1.5 p-2 rounded-full hover:bg-primary/10 hover:text-primary transition-colors group"
                  onClick={handleHeart}
                >
                  <HeartIcon 
                    className={cn(
                      "w-[18px] h-[18px] transition-all",
                      post.user_reactions.has_hearted && "fill-primary stroke-primary"
                    )}
                  />
                  <span className="text-xs">{post.reactions.hearts}</span>
                </button>

                <button 
                  className="flex items-center gap-1.5 p-2 rounded-full hover:bg-primary/10 hover:text-primary transition-colors group"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCommentMode('reply');
                    setShowComments(true);
                  }}
                >
                  <MessageCircleIcon className="w-[18px] h-[18px]" />
                  <span className="text-xs">{post.reactions.comments}</span>
                </button>

                <button 
                  className="p-2 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                  onClick={handleShareClick}
                  title="Condividi"
                >
                  <img 
                    src="/lovable-uploads/f6970c06-9fd9-4430-b863-07384bbb05ce.png"
                    alt="Condividi"
                    className="w-[18px] h-[18px]"
                  />
                </button>
              </div>

              <button 
                className="p-2 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                onClick={handleBookmark}
              >
                <BookmarkIcon 
                  className={cn(
                    "w-[18px] h-[18px] transition-all",
                    post.user_reactions.has_bookmarked && "fill-primary stroke-primary"
                  )}
                />
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

      {/* Media Viewer - Rendered via Portal */}
      {selectedMediaIndex !== null && post.media && createPortal(
        <MediaViewer
          media={post.media}
          initialIndex={selectedMediaIndex}
          onClose={() => setSelectedMediaIndex(null)}
        />,
        document.body
      )}

    </>
  );
};

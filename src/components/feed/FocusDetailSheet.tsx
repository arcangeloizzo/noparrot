import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Share2, Trash2, Shield, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusComments, useAddFocusComment, useDeleteFocusComment } from "@/hooks/useFocusComments";
import { useFocusReactions, useToggleFocusReaction } from "@/hooks/useFocusReactions";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { SourceTag } from "./SourceTag";
import { SourcesDrawer } from "./SourcesDrawer";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { QuizModal } from "@/components/ui/quiz-modal";
import { toast as sonnerToast } from "sonner";
import { LOGO_BASE } from "@/config/brand";
import { haptics } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";

interface Source {
  icon: string;
  name: string;
  url?: string;
}

interface FocusDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'daily' | 'interest';
  category?: string;
  title: string;
  deepContent?: string;
  sources: Source[];
  imageUrl?: string;
  focusId: string;
  reactions: { likes: number; comments: number; shares: number };
  userReactions?: { hasLiked: boolean };
  onLike?: () => void;
  onComment?: () => void; // Apre scelta consapevole/rapido
  onShare?: () => void;
}

export const FocusDetailSheet = ({
  open,
  onOpenChange,
  type,
  category,
  title,
  deepContent,
  sources,
  imageUrl,
  focusId,
  reactions,
  userReactions,
  onLike,
  onComment,
  onShare,
}: FocusDetailSheetProps) => {
  const isDailyFocus = type === 'daily';
  const badgeBg = isDailyFocus ? 'bg-[#0A7AFF]' : 'bg-[#A98FF8]/20';
  const badgeText = isDailyFocus ? 'text-white' : 'text-[#A98FF8]';
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [sourcesDrawerOpen, setSourcesDrawerOpen] = useState(false);
  const [highlightedSourceIndex, setHighlightedSourceIndex] = useState<number | undefined>();
  const [commentMode, setCommentMode] = useState<'unread' | 'read'>('unread');
  const [userPassedGate, setUserPassedGate] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizData, setQuizData] = useState<any>(null);
  const [showCommentForm, setShowCommentForm] = useState(false);
  
  const { data: comments = [] } = useFocusComments(focusId, type);
  const addComment = useAddFocusComment();
  const deleteComment = useDeleteFocusComment();
  
  // Hook per le reazioni
  const { data: reactionsData } = useFocusReactions(focusId, type);
  const toggleReaction = useToggleFocusReaction();

  // Parse deep_content and render with SourceTag components
  const parseContentWithSources = (content: string) => {
    // Step 0: Add fallback [SOURCE:0] to paragraphs without sources
    const paragraphs = content.split('\n\n');
    const contentWithFallback = paragraphs
      .map(p => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        // Check if paragraph ends with [SOURCE:N]
        if (!/\[SOURCE:\d+\]$/.test(trimmed)) {
          return `${trimmed} [SOURCE:0]`;
        }
        return trimmed;
      })
      .join('\n\n');
    
    // Step 1: Aggregate consecutive [SOURCE:N] markers into [SOURCE:N,M,...]
    const aggregatedContent = contentWithFallback.replace(
      /(\[SOURCE:\d+\](?:\s*\[SOURCE:\d+\])+)/g,
      (match) => {
        // Extract all indices from consecutive markers
        const indices = [...match.matchAll(/\[SOURCE:(\d+)\]/g)]
          .map(m => parseInt(m[1]));
        return `[SOURCE:${indices.join(',')}]`;
      }
    );
    
    // Step 2: Split by [SOURCE:...] markers - accepts both [SOURCE:0] and [SOURCE:0,3,4]
    const parts = aggregatedContent.split(/(\[SOURCE:[\d,\s]+\])/g);
    
    return parts.map((part, idx) => {
      const sourceMatch = part.match(/\[SOURCE:([\d,\s]+)\]/);
      if (sourceMatch) {
        // Extract indices from comma-separated format
        const indices = sourceMatch[1]
          .replace(/SOURCE:/g, '')
          .split(',')
          .map(s => parseInt(s.trim()))
          .filter(n => !isNaN(n));
        
        return (
          <SourceTag 
            key={idx}
            sourceIndices={indices}
            sources={sources}
            onClick={() => {
              setHighlightedSourceIndex(indices[0]);
              setSourcesDrawerOpen(true);
            }}
          />
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const handleReadAndComment = async () => {
    if (!deepContent) return;

    setIsProcessing(true);
    sonnerToast.info('Generando il quiz di comprensione...');
    
    try {
      // Generate quiz questions for the focus content
      const { data: qaData, error: qaError } = await supabase.functions.invoke('generate-qa', {
        body: {
          contentId: focusId,
          title: title,
          summary: deepContent,
          type: 'article',
          sourceUrl: 'focus://internal',
          testMode: 'SOURCE_ONLY'
        }
      });

      if (qaError) {
        console.error('[FocusDetailSheet] QA generation error:', qaError);
        sonnerToast.error('Errore nella generazione del quiz');
        setIsProcessing(false);
        return;
      }

      if (!qaData?.questions || qaData.questions.length === 0) {
        console.error('[FocusDetailSheet] No questions generated');
        sonnerToast.error('Impossibile generare le domande');
        setIsProcessing(false);
        return;
      }

      console.log('[FocusDetailSheet] Quiz questions generated:', qaData.questions.length);
      
      // Show the quiz modal
      setQuizData({
        questions: qaData.questions,
        sourceUrl: 'focus://internal'
      });
      setShowQuiz(true);
      setIsProcessing(false);
      
    } catch (error) {
      console.error('[FocusDetailSheet] Error:', error);
      sonnerToast.error('Errore nella verifica');
      setIsProcessing(false);
    }
  };

  const handleModeChange = (value: 'unread' | 'read') => {
    if (value === 'read') {
      if (!userPassedGate) {
        handleReadAndComment();
      } else {
        setCommentMode('read');
        setShowCommentForm(true);
      }
    } else {
      setCommentMode('unread');
      setShowCommentForm(true);
    }
  };

  const handleSubmitComment = () => {
    if (!commentText.trim() || isProcessing) return;
    
    const isVerified = commentMode === 'read';
    
    addComment.mutate({
      focusId,
      focusType: type,
      content: commentText,
      parentId: replyTo?.id || null,
      level: replyTo ? 1 : 0,
      isVerified
    });
    
    setCommentText('');
    setReplyTo(null);
    setShowCommentForm(false);
  };

  const handleDeleteComment = (commentId: string) => {
    deleteComment.mutate({ commentId, focusId, focusType: type });
  };

  // Build comment tree
  const commentTree = comments.filter(c => !c.parent_id);
  const repliesMap = new Map<string, typeof comments>();
  comments.filter(c => c.parent_id).forEach(comment => {
    const parentId = comment.parent_id!;
    if (!repliesMap.has(parentId)) {
      repliesMap.set(parentId, []);
    }
    repliesMap.get(parentId)!.push(comment);
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} modal={!showQuiz}>
        <SheetContent 
          side="bottom" 
          className="h-[85vh] bg-[#0E141A] border-white/10 flex flex-col"
          hideClose={true}
        >
          {/* Header fisso con badge e X allineati orizzontalmente */}
          <div className="sticky top-0 z-10 bg-[#0E141A] pt-4 pb-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <Badge className={cn(badgeBg, badgeText, "font-semibold px-3 py-1 border-0")}>
                {isDailyFocus ? '🌍 DAILY FOCUS' : `🧠 PER TE: ${category?.toUpperCase() || 'GENERALE'}`}
              </Badge>
              
              {/* X custom più grande e cliccabile */}
              <button 
                onClick={() => onOpenChange(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                aria-label="Chiudi"
              >
                <X className="w-6 h-6 text-white/70" />
              </button>
            </div>
          </div>

          {/* Contenuto scrollabile */}
          <div className="flex-1 overflow-y-auto">
            {imageUrl && (
              <div className="w-full h-48 rounded-lg overflow-hidden mt-4">
                <img 
                  src={imageUrl} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <h2 className="text-white text-2xl font-bold text-left leading-tight mt-4 pb-4 border-b border-white/10">
              {title}
            </h2>
          
            <div className="py-6 space-y-6">
            {/* Deep Content with Source Tags */}
            <div>
              <h4 className="text-gray-400 text-sm font-semibold mb-3">Approfondimento</h4>
              <p className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap">
                {deepContent ? parseContentWithSources(deepContent) : 'Contenuto non disponibile.'}
              </p>
            </div>
            
            {/* Reaction Bar - MOVED HERE */}
            <div className="py-4 flex items-center gap-4 border-y border-white/10">
              <button
                onClick={() => {
                  if (!user) {
                    sonnerToast.error('Devi effettuare il login per mettere like');
                    return;
                  }
                  toggleReaction.mutate({ focusId, focusType: type });
                  haptics.light();
                }}
                className={cn(
                  "reaction-btn-heart",
                  reactionsData?.likedByMe && "liked"
                )}
              >
                <Heart 
                  className="w-5 h-5 transition-all"
                  fill={reactionsData?.likedByMe ? "currentColor" : "none"}
                  strokeWidth={reactionsData?.likedByMe ? 0 : 2}
                />
                <span className="text-sm">{reactionsData?.likes || reactions.likes || 0}</span>
              </button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('[FocusDetailSheet] Comment button clicked');
                  onComment?.();
                }}
                className="flex items-center gap-2 text-gray-400 hover:text-primary"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm">{reactions.comments}</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onShare}
                className="flex items-center gap-2 text-gray-400 hover:text-blue-500"
              >
                <Share2 className="w-5 h-5" />
                <span className="text-sm">{reactions.shares}</span>
              </Button>
            </div>

            {/* Comments Section - View only, add comments via CommentsSheet */}
            <div className="pt-6">
              <h4 className="text-gray-400 text-sm font-semibold mb-4">
                Commenti ({comments.length})
              </h4>

              {/* Comments List */}
              <div className="space-y-4">
                {commentTree.map((comment) => (
                  <div key={comment.id}>
                    <CommentItem 
                      comment={comment}
                      onReply={(id, username) => setReplyTo({ id, username })}
                      onDelete={handleDeleteComment}
                      currentUserId={user?.id}
                    />
                    {repliesMap.has(comment.id) && (
                      <div className="ml-6 mt-2 space-y-2 border-l-2 border-white/10 pl-4">
                        {repliesMap.get(comment.id)!.map((reply) => (
                          <CommentItem
                            key={reply.id}
                            comment={reply}
                            onReply={(id, username) => setReplyTo({ id, username })}
                            onDelete={handleDeleteComment}
                            currentUserId={user?.id}
                            isReply
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    Nessun commento. Sii il primo a commentare!
                  </p>
                )}
              </div>
            </div>
          </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sources Drawer */}
      <SourcesDrawer
        open={sourcesDrawerOpen}
        onOpenChange={setSourcesDrawerOpen}
        sources={sources}
        highlightIndex={highlightedSourceIndex}
      />
      
      {/* Quiz Modal for Focus Gate - use createPortal to escape Sheet context */}
      {showQuiz && quizData && !quizData.error && quizData.questions && createPortal(
        <QuizModal
          questions={quizData.questions}
          onSubmit={async (answers: Record<string, string>) => {
            try {
              // For Focus items, validate locally since questions are generated on-the-fly
              // and not stored in the database
              const questions = quizData.questions;
              let correctCount = 0;
              const wrongIndexes: string[] = [];
              
              questions.forEach((q: any, index: number) => {
                const userAnswer = answers[q.id];
                if (userAnswer === q.correctId) {
                  correctCount++;
                } else {
                  wrongIndexes.push(index.toString());
                }
              });
              
              const total = questions.length;
              const passed = correctCount >= Math.ceil(total * 0.6); // 60% threshold
              
              console.log('[FocusDetailSheet] Local validation:', { correctCount, total, passed, wrongIndexes });
              
              if (!passed) {
                sonnerToast.error('Non ancora chiaro. Riprova più tardi.');
                setShowQuiz(false);
                setQuizData(null);
                return { passed: false, score: correctCount, total, wrongIndexes };
              }

              haptics.success();
              sonnerToast.success('Hai fatto chiarezza. Il tuo commento sarà verificato.');
              setUserPassedGate(true);
              setCommentMode('read');
              setShowCommentForm(true);
              setShowQuiz(false);
              setQuizData(null);
              return { passed: true, score: correctCount, total, wrongIndexes: [] };
            } catch (err) {
              console.error('[FocusDetailSheet] Unexpected error:', err);
              sonnerToast.error("Errore durante la validazione");
              setShowQuiz(false);
              setQuizData(null);
              return { passed: false, wrongIndexes: [] };
            }
          }}
          onCancel={() => {
            sonnerToast.info("Quiz annullato.");
            setShowQuiz(false);
            setQuizData(null);
          }}
          provider="gemini"
        />,
        document.body
      )}
      
      {/* Error state for quiz loading failure */}
      {showQuiz && quizData?.error && createPortal(
        <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 pointer-events-auto" style={{ pointerEvents: 'auto' }}>
          <div className="bg-card rounded-2xl w-full max-w-md p-8 text-center shadow-2xl border border-border pointer-events-auto" onClick={(e) => e.stopPropagation()} style={{ pointerEvents: 'auto' }}>
            <h2 className="text-xl font-bold mb-4 text-foreground">Errore</h2>
            <p className="text-muted-foreground mb-6">{quizData.errorMessage || 'Impossibile caricare il quiz'}</p>
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                setShowQuiz(false);
                setQuizData(null);
              }} 
              variant="outline" 
              className="w-full pointer-events-auto"
              style={{ pointerEvents: 'auto' }}
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

interface CommentItemProps {
  comment: any;
  onReply: (id: string, username: string) => void;
  onDelete: (id: string) => void;
  currentUserId?: string;
  isReply?: boolean;
}

const CommentItem = ({ comment, onReply, onDelete, currentUserId, isReply }: CommentItemProps) => {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
          {comment.author.username[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm">
              @{comment.author.username}
            </span>
            {comment.is_verified && (
              <Shield className="w-3 h-3 text-primary fill-current" />
            )}
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(comment.created_at), { 
                addSuffix: true,
                locale: it 
              })}
            </span>
          </div>
          <p className="text-gray-200 text-sm mt-1">{comment.content}</p>
          <div className="flex items-center gap-3 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReply(comment.id, comment.author.username)}
              className="h-6 text-xs text-gray-400 hover:text-white"
            >
              <MessageCircle className="w-3 h-3 mr-1" />
              Rispondi
            </Button>
            {currentUserId === comment.author_id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(comment.id)}
                className="h-6 text-xs text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Elimina
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

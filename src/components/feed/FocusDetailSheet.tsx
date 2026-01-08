import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Trash2, X, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusComments, useAddFocusComment, useDeleteFocusComment } from "@/hooks/useFocusComments";
import { useFocusReactions, useToggleFocusReaction } from "@/hooks/useFocusReactions";
import { useFocusCommentReactions, useToggleFocusCommentReaction } from "@/hooks/useFocusCommentReactions";
import { useFocusBookmark, useToggleFocusBookmark } from "@/hooks/useFocusBookmarks";
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
import { Logo } from "@/components/ui/logo";

interface Source {
  icon: string;
  name: string;
  url?: string;
}

interface FocusDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type?: 'daily';
  category?: string;
  title: string;
  deepContent?: string;
  sources: Source[];
  imageUrl?: string;
  focusId: string;
  editorialNumber?: number;
  reactions: { likes: number; comments: number; shares: number };
  userReactions?: { hasLiked: boolean };
  onLike?: () => void;
  onShare?: () => void;
}

export const FocusDetailSheet = ({
  open,
  onOpenChange,
  type = 'daily',
  category,
  title,
  deepContent,
  sources,
  imageUrl,
  focusId,
  editorialNumber,
  reactions,
  userReactions,
  onLike,
  onShare,
}: FocusDetailSheetProps) => {
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [sourcesDrawerOpen, setSourcesDrawerOpen] = useState(false);
  const [highlightedSourceIndex, setHighlightedSourceIndex] = useState<number | undefined>();
  const [commentMode, setCommentMode] = useState<'unread' | 'read'>('unread');
  const [userPassedGate, setUserPassedGate] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizData, setQuizData] = useState<{ qaId?: string; questions: any[]; sourceUrl: string; forShare?: boolean; error?: boolean; errorMessage?: string } | null>(null);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  
  const { data: comments = [] } = useFocusComments(focusId, type);
  const addComment = useAddFocusComment();
  const deleteComment = useDeleteFocusComment();
  
  // Hook per le reazioni
  const { data: reactionsData } = useFocusReactions(focusId, type);
  const toggleReaction = useToggleFocusReaction();
  
  // Hook per il bookmark
  const { data: isBookmarked } = useFocusBookmark(focusId, type);
  const toggleBookmark = useToggleFocusBookmark();

  // Skip reader - genera quiz direttamente dal drawer (utente ha già letto)
  const handleShareFromDrawer = async () => {
    if (!deepContent) {
      onShare?.();
      return;
    }
    
    if (!user) {
      sonnerToast.error('Devi effettuare il login per condividere');
      return;
    }
    
    setIsProcessing(true);
    sonnerToast.info('Generando il quiz di comprensione...');
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-qa', {
        body: {
          title: title,
          summary: deepContent,
          sourceUrl: `editorial://${focusId}`,
          testMode: 'USER_ONLY',
          isPrePublish: true,
        }
      });

      if (error || !data?.questions?.length) {
        console.error('[FocusDetailSheet] Quiz generation error:', error);
        sonnerToast.error('Errore nella generazione del quiz');
        setIsProcessing(false);
        return;
      }

      setQuizData({
        qaId: data.qaId,
        questions: data.questions,
        sourceUrl: `editorial://${focusId}`,
        forShare: true,
      });
      setShowQuiz(true);
      setIsProcessing(false);
      
    } catch (error) {
      console.error('[FocusDetailSheet] Error:', error);
      sonnerToast.error('Errore nella verifica');
      setIsProcessing(false);
    }
  };

  // Parse deep_content and render with SourceTag components
  const parseContentWithSources = (content: string) => {
    const paragraphs = content.split('\n\n');
    const contentWithFallback = paragraphs
      .map(p => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        if (!/\[SOURCE:\d+\]$/.test(trimmed)) {
          return `${trimmed} [SOURCE:0]`;
        }
        return trimmed;
      })
      .join('\n\n');
    
    const aggregatedContent = contentWithFallback.replace(
      /(\[SOURCE:\d+\](?:\s*\[SOURCE:\d+\])+)/g,
      (match) => {
        const indices = [...match.matchAll(/\[SOURCE:(\d+)\]/g)]
          .map(m => parseInt(m[1]));
        return `[SOURCE:${indices.join(',')}]`;
      }
    );
    
    const parts = aggregatedContent.split(/(\[SOURCE:[\d,\s]+\])/g);
    
    return parts.map((part, idx) => {
      const sourceMatch = part.match(/\[SOURCE:([\d,\s]+)\]/);
      if (sourceMatch) {
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

      setQuizData({
        qaId: qaData.qaId,
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
          <div className="shrink-0 bg-[#0E141A] pt-4 pb-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <Badge className="bg-[#0A7AFF] text-white font-semibold px-3 py-1 border-0 font-mono">
                {editorialNumber ? `◉ IL PUNTO · #${editorialNumber}` : '◉ IL PUNTO'}
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
          <div className="flex-1 min-h-0 overflow-y-auto pb-20 force-scrollbar">
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
            
            {/* Action Bar */}
            <div className="py-4 flex items-center justify-between gap-3 border-y border-white/10">
              {/* Primary Share Button */}
              <button 
                onClick={handleShareFromDrawer}
                disabled={isProcessing}
                className="h-10 px-4 bg-white hover:bg-gray-50 text-[#1F3347] font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Logo variant="icon" size="sm" className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  {isProcessing ? 'Caricamento...' : 'Condividi'}
                </span>
              </button>

              {/* Reactions Bar */}
              <div className="flex items-center gap-1 bg-white/5 backdrop-blur-xl h-10 px-3 rounded-2xl border border-white/10">
                {/* Like */}
                <button 
                  onClick={() => {
                    if (!user) {
                      sonnerToast.error('Devi effettuare il login per mettere like');
                      return;
                    }
                    toggleReaction.mutate({ focusId, focusType: type });
                    haptics.light();
                  }}
                  className="flex items-center gap-1.5 h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <Heart 
                    className={cn(
                      "w-5 h-5 transition-all",
                      reactionsData?.likedByMe ? "text-red-500 fill-red-500" : "text-white"
                    )} 
                  />
                  <span className="text-xs font-bold text-white">
                    {reactionsData?.likes || reactions.likes || 0}
                  </span>
                </button>

                {/* Comments */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setCommentsExpanded(!commentsExpanded);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 h-full px-2 rounded-xl transition-colors",
                    commentsExpanded ? "bg-white/20" : "hover:bg-white/10"
                  )}
                >
                  <MessageCircle className={cn("w-5 h-5", commentsExpanded ? "text-primary" : "text-white")} />
                  <span className="text-xs font-bold text-white">{comments.length}</span>
                </button>

                {/* Bookmark */}
                <button 
                  onClick={() => {
                    if (!user) {
                      sonnerToast.error('Devi effettuare il login per salvare');
                      return;
                    }
                    toggleBookmark.mutate({ focusId, focusType: type });
                    haptics.light();
                  }}
                  className="flex items-center h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <Bookmark 
                    className={cn(
                      "w-5 h-5 transition-all",
                      isBookmarked ? "text-primary fill-primary" : "text-white"
                    )} 
                  />
                </button>
              </div>
            </div>

            {/* Inline Expandable Comments Section */}
            {commentsExpanded && (
              <div className="pt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                {/* Comment Mode Selection */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <Label className="font-semibold mb-3 block text-sm text-white">
                    Come vuoi commentare?
                  </Label>
                  <RadioGroup 
                    value={showCommentForm ? commentMode : ''} 
                    onValueChange={(val) => handleModeChange(val as 'unread' | 'read')}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="unread" id="unread" className="border-white/30" />
                      <Label htmlFor="unread" className="text-gray-300 text-sm cursor-pointer">
                        Commento spontaneo
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="read" id="read" className="border-white/30" />
                      <Label htmlFor="read" className="text-gray-300 text-sm cursor-pointer flex items-center gap-2">
                        <img
                          src={LOGO_BASE}
                          alt=""
                          className="w-4 h-4"
                          aria-hidden="true"
                        />
                        Dopo aver letto
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Comment Form */}
                {showCommentForm && (
                  <div className="flex gap-3 items-start animate-in fade-in duration-200">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {user?.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        placeholder={replyTo ? `Rispondi a @${replyTo.username}...` : "Scrivi un commento..."}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="min-h-[80px] bg-white/5 border-white/10 text-white placeholder:text-gray-500 resize-none"
                      />
                      <div className="flex justify-between items-center">
                        {replyTo && (
                          <button 
                            onClick={() => setReplyTo(null)}
                            className="text-xs text-gray-500 hover:text-gray-300"
                          >
                            Annulla risposta
                          </button>
                        )}
                        <Button
                          size="sm"
                          onClick={handleSubmitComment}
                          disabled={!commentText.trim() || addComment.isPending}
                          className="ml-auto"
                        >
                          {addComment.isPending ? 'Invio...' : 'Pubblica'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Comments List */}
                <div className="space-y-4">
                  {commentTree.length === 0 ? (
                    <p className="text-center text-gray-500 text-sm py-4">
                      Nessun commento ancora. Sii il primo!
                    </p>
                  ) : (
                    commentTree.map(comment => (
                      <CommentItem 
                        key={comment.id}
                        comment={comment}
                        replies={repliesMap.get(comment.id) || []}
                        onReply={(c) => {
                          setReplyTo({ id: c.id, username: c.author?.full_name || 'Utente' });
                          setShowCommentForm(true);
                        }}
                        onDelete={handleDeleteComment}
                        currentUserId={user?.id}
                        focusId={focusId}
                        focusType={type}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
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

      {/* Quiz Modal */}
      {showQuiz && quizData && (
        <QuizModal
          questions={quizData.questions}
          qaId={quizData.qaId}
          onSubmit={async (answers) => {
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-qa`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ qaId: quizData.qaId, answers })
            });
            return res.json();
          }}
          onCancel={() => {
            setShowQuiz(false);
            setQuizData(null);
          }}
          onComplete={(passed) => {
            if (passed) {
              setUserPassedGate(true);
              if (quizData.forShare) {
                onShare?.();
              } else {
                setCommentMode('read');
                setShowCommentForm(true);
              }
            } else {
              sonnerToast.error('Quiz non superato. Riprova dopo aver riletto.');
            }
            setShowQuiz(false);
            setQuizData(null);
          }}
        />
      )}
    </>
  );
};

// CommentItem component
interface CommentItemProps {
  comment: any;
  replies: any[];
  onReply: (comment: any) => void;
  onDelete: (commentId: string) => void;
  currentUserId?: string;
  focusId: string;
  focusType: 'daily';
}

const CommentItem = ({ comment, replies, onReply, onDelete, currentUserId, focusId, focusType }: CommentItemProps) => {
  const { data: reactionData } = useFocusCommentReactions(comment.id);
  const toggleReaction = useToggleFocusCommentReaction();
  const { user } = useAuth();

  const isOwner = currentUserId === comment.author_id;
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: it });

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
          {comment.author?.full_name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm">
              {comment.author?.full_name || 'Utente'}
            </span>
            {comment.is_verified && (
              <img src={LOGO_BASE} alt="Verificato" className="w-3.5 h-3.5" />
            )}
            <span className="text-xs text-gray-500">{timeAgo}</span>
          </div>
          <p className="text-gray-300 text-sm mt-1 break-words">{comment.content}</p>
          
          {/* Comment Actions */}
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => {
                if (!user) {
                  sonnerToast.error('Devi effettuare il login');
                  return;
                }
                toggleReaction.mutate({ focusCommentId: comment.id, isLiked: reactionData?.likedByMe || false });
              }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              <Heart 
                className={cn("w-3.5 h-3.5", reactionData?.likedByMe && "fill-red-400 text-red-400")} 
              />
              <span>{reactionData?.likesCount || 0}</span>
            </button>
            <button
              onClick={() => onReply(comment)}
              className="text-xs text-gray-500 hover:text-primary transition-colors"
            >
              Rispondi
            </button>
            {isOwner && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-11 space-y-3 border-l-2 border-white/10 pl-4">
          {replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              replies={[]}
              onReply={onReply}
              onDelete={onDelete}
              currentUserId={currentUserId}
              focusId={focusId}
              focusType={focusType}
            />
          ))}
        </div>
      )}
    </div>
  );
};

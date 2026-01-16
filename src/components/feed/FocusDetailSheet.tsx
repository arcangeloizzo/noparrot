import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Trash2, X, Bookmark, Layers, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusComments, useAddFocusComment, useDeleteFocusComment } from "@/hooks/useFocusComments";
import { useFocusReactions, useToggleFocusReaction } from "@/hooks/useFocusReactions";
import { useFocusCommentReactions, useToggleFocusCommentReaction } from "@/hooks/useFocusCommentReactions";
import { useFocusBookmark, useToggleFocusBookmark } from "@/hooks/useFocusBookmarks";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { SourcesDrawer } from "./SourcesDrawer";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { QuizModal } from "@/components/ui/quiz-modal";
import { toast as sonnerToast } from "sonner";
import { LOGO_BASE } from "@/config/brand";
import { haptics } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/ui/logo";
import { FocusDetailSkeleton, SourcesSkeleton } from "./skeletons";

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

// Render deep_content as clean continuous text WITHOUT [SOURCE:N] markers
const renderCleanContent = (content: string): string => {
  return content.replace(/\[SOURCE:[\d,\s]+\]/g, '').trim();
};

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
                ◉ IL PUNTO
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
              {/* Deep Content - show skeleton if not loaded */}
              {!deepContent ? (
                <FocusDetailSkeleton />
              ) : (
                <div>
                  <h4 className="text-gray-400 text-sm font-semibold mb-3">Approfondimento</h4>
                  <p className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap">
                    {renderCleanContent(deepContent)}
                  </p>
                </div>
              )}
              
              {/* Sources Section - show skeleton if sources not loaded */}
              {sources.length === 0 ? (
                <SourcesSkeleton />
              ) : (
                <div className="py-4 border-t border-white/10">
                  <h4 className="text-sm font-semibold text-white/70 mb-3">
                    Fonti consultate per questa sintesi
                  </h4>
                  <button
                    onClick={() => setSourcesDrawerOpen(true)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Layers className="w-5 h-5 text-[#0A7AFF]" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-white">
                          Vedi le {sources.length} fonti
                        </p>
                        <p className="text-xs text-white/50">
                          L'analisi incrocia contenuti da più testate
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/30" />
                  </button>
                </div>
              )}
            
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
                      <p className="text-sm text-gray-500 text-center py-4">
                        Nessun commento ancora. Sii il primo!
                      </p>
                    ) : (
                      commentTree.map((comment) => (
                        <CommentWithReplies
                          key={comment.id}
                          comment={comment}
                          replies={repliesMap.get(comment.id) || []}
                          currentUserId={user?.id}
                          onReply={(id, username) => {
                            setReplyTo({ id, username });
                            setShowCommentForm(true);
                          }}
                          onDelete={handleDeleteComment}
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
        sources={sources.map((s, i) => ({
          icon: s.icon || '📰',
          name: s.name || `Fonte ${i + 1}`,
          url: s.url || '',
          title: s.name || '',
          description: '',
        }))}
      />

      {/* Quiz Modal for share or comment gate */}
      {showQuiz && quizData && (
        <QuizModal
          questions={quizData.questions}
          qaId={quizData.qaId}
          onSubmit={async (answers) => {
            const qaId = quizData.qaId;
            const sourceUrl = quizData.sourceUrl;
            const gateType = quizData.forShare ? 'share' : 'comment';
            
            try {
              const { data, error } = await supabase.functions.invoke('submit-qa', {
                body: {
                  qaId,
                  postId: null,
                  sourceUrl: sourceUrl,
                  answers,
                  gateType
                }
              });

              if (error) {
                console.error('[FocusDetailSheet] Validation error:', error);
                return { passed: false, score: 0, total: quizData.questions.length, wrongIndexes: [] };
              }

              const passed = data?.passed || false;
              const score = data?.score || 0;
              const wrongIndexes = data?.wrongIndexes || [];
              
              return { passed, score, total: quizData.questions.length, wrongIndexes };
            } catch (err) {
              console.error('[FocusDetailSheet] Unexpected error:', err);
              return { passed: false, score: 0, total: quizData.questions.length, wrongIndexes: [] };
            }
          }}
          onCancel={() => {
            setShowQuiz(false);
            setQuizData(null);
            setIsProcessing(false);
          }}
          onComplete={(passed) => {
            setShowQuiz(false);
            setQuizData(null);
            
            if (passed) {
              if (quizData.forShare) {
                // Share flow completed
                onShare?.();
              } else {
                // Comment gate passed
                setUserPassedGate(true);
                setCommentMode('read');
                setShowCommentForm(true);
              }
            }
            setIsProcessing(false);
          }}
        />
      )}
    </>
  );
};

// Comment component with reactions
interface CommentWithRepliesProps {
  comment: any;
  replies: any[];
  currentUserId?: string;
  onReply: (id: string, username: string) => void;
  onDelete: (id: string) => void;
}

const CommentWithReplies = ({
  comment,
  replies,
  currentUserId,
  onReply,
  onDelete,
}: CommentWithRepliesProps) => {
  const { data: reactionData } = useFocusCommentReactions(comment.id);
  const toggleReaction = useToggleFocusCommentReaction();
  const { user } = useAuth();
  
  const profile = comment.profiles || {};
  const username = profile.username || profile.full_name || 'Utente';
  const avatarUrl = profile.avatar_url;
  const isOwner = currentUserId === comment.author_id;

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/50 to-primary/30 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            username[0]?.toUpperCase() || '?'
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-white">@{username}</span>
            {comment.is_verified && (
              <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded-full font-medium">
                ✓ letto
              </span>
            )}
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: it })}
            </span>
          </div>
          
          <p className="text-sm text-gray-300 leading-relaxed">
            {comment.content}
          </p>

          {/* Actions */}
          {/* Actions */}
          <div className="flex items-center gap-4 mt-2">
            <button 
              onClick={() => {
                if (!user) {
                  sonnerToast.error('Devi effettuare il login');
                  return;
                }
                toggleReaction.mutate({ focusCommentId: comment.id, isLiked: reactionData?.likedByMe || false });
                haptics.light();
              }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
            >
              <Heart 
                className={cn(
                  "w-3.5 h-3.5",
                  reactionData?.likedByMe ? "text-red-500 fill-red-500" : ""
                )} 
              />
              <span>{reactionData?.likesCount || 0}</span>
            </button>
            
            <button 
              onClick={() => onReply(comment.id, username)}
              className="text-xs text-gray-500 hover:text-white transition-colors"
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
          {replies.map((reply) => (
            <CommentWithReplies
              key={reply.id}
              comment={reply}
              replies={[]}
              currentUserId={currentUserId}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

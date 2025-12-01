import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Share2, Trash2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusComments, useAddFocusComment, useDeleteFocusComment } from "@/hooks/useFocusComments";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { SourceTag } from "./SourceTag";
import { SourcesDrawer } from "./SourcesDrawer";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { runGateBeforeAction } from "@/lib/runGateBeforeAction";
import { QuizModal } from "@/components/ui/quiz-modal";
import { toast as sonnerToast } from "sonner";
import { LOGO_BASE } from "@/config/brand";

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
    sonnerToast.info('Verificando la comprensione...');
    
    // Simply mark as verified without gate for now (sources are aggregated news)
    setTimeout(() => {
      sonnerToast.success('Hai fatto chiarezza.');
      setUserPassedGate(true);
      setCommentMode('read');
      setShowCommentForm(true);
      setIsProcessing(false);
    }, 500);
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
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="bottom" 
          className="h-[85vh] bg-[#0E141A] border-white/10 flex flex-col"
        >
          {/* Header fisso con badge - la X è già absolute quindi resta sempre visibile */}
          <div className="sticky top-0 z-10 bg-[#0E141A] pt-4 pb-3 border-b border-white/10">
            <Badge className={cn(badgeBg, badgeText, "font-semibold px-3 py-1 border-0 w-fit")}>
              {isDailyFocus ? '🌍 DAILY FOCUS' : `🧠 PER TE: ${category?.toUpperCase() || 'GENERALE'}`}
            </Badge>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={onLike}
                className={cn(
                  "flex items-center gap-2 text-gray-400 hover:text-red-500",
                  userReactions?.hasLiked && "text-red-500"
                )}
              >
                <Heart className={cn("w-5 h-5", userReactions?.hasLiked && "fill-current")} />
                <span className="text-sm">{reactions.likes}</span>
              </Button>
              
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

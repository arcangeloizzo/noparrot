import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, MessageCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusComments, useAddFocusComment, useDeleteFocusComment } from "@/hooks/useFocusComments";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

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
  summary: string;
  sources: Source[];
  imageUrl?: string;
  focusId: string;
}

export const FocusDetailSheet = ({
  open,
  onOpenChange,
  type,
  category,
  title,
  summary,
  sources,
  imageUrl,
  focusId,
}: FocusDetailSheetProps) => {
  const isDailyFocus = type === 'daily';
  const badgeBg = isDailyFocus ? 'bg-[#0A7AFF]' : 'bg-[#A98FF8]/20';
  const badgeText = isDailyFocus ? 'text-white' : 'text-[#A98FF8]';
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  
  const { data: comments = [] } = useFocusComments(focusId, type);
  const addComment = useAddFocusComment();
  const deleteComment = useDeleteFocusComment();

  const handleSubmitComment = () => {
    if (!commentText.trim()) return;
    
    addComment.mutate({
      focusId,
      focusType: type,
      content: commentText,
      parentId: replyTo?.id || null,
      level: replyTo ? 1 : 0
    });
    
    setCommentText('');
    setReplyTo(null);
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] bg-[#0E141A] border-white/10 overflow-y-auto"
      >
        <SheetHeader className="space-y-4 pb-6 border-b border-white/10">
          <Badge className={cn(badgeBg, badgeText, "font-semibold px-3 py-1 border-0 w-fit")}>
            {isDailyFocus ? '🌍 DAILY FOCUS' : `🧠 PER TE: ${category?.toUpperCase() || 'GENERALE'}`}
          </Badge>
          
          {imageUrl && (
            <div className="w-full h-48 rounded-lg overflow-hidden">
              <img 
                src={imageUrl} 
                alt="" 
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <SheetTitle className="text-white text-2xl font-bold text-left leading-tight">
            {title}
          </SheetTitle>
        </SheetHeader>
        
        <div className="py-6 space-y-6">
          <div>
            <h4 className="text-gray-400 text-sm font-semibold mb-2">Sintesi</h4>
            <p className="text-gray-200 text-base leading-relaxed">{summary}</p>
          </div>
          
          <div>
            <h4 className="text-gray-400 text-sm font-semibold mb-3">
              Fonti ({sources.length})
            </h4>
            <div className="space-y-2">
              {sources.map((source, idx) => (
                <a
                  key={idx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg transition-colors",
                    "bg-white/5 hover:bg-white/10",
                    !source.url && "opacity-50 pointer-events-none"
                  )}
                >
                  <span className="text-2xl">{source.icon}</span>
                  <span className="text-white font-medium flex-1">{source.name}</span>
                  {source.url && (
                    <ExternalLink className="w-5 h-5 text-gray-400" />
                  )}
                </a>
              ))}
            </div>
          </div>

          {/* Comments Section */}
          <div className="border-t border-white/10 pt-6">
            <h4 className="text-gray-400 text-sm font-semibold mb-4">
              Commenti ({comments.length})
            </h4>
            
            {/* Comment Composer */}
            {user && (
              <div className="mb-6 space-y-2">
                {replyTo && (
                  <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
                    <span className="text-sm text-gray-400">
                      Rispondi a @{replyTo.username}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReplyTo(null)}
                      className="h-6 text-gray-400"
                    >
                      Annulla
                    </Button>
                  </div>
                )}
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Aggiungi un commento..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  rows={3}
                />
                <Button
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || addComment.isPending}
                  className="w-full"
                >
                  {addComment.isPending ? 'Pubblicazione...' : 'Pubblica'}
                </Button>
              </div>
            )}

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
      </SheetContent>
    </Sheet>
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
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm">
              @{comment.author.username}
            </span>
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

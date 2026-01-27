import { X, Share, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Post } from "@/hooks/usePosts";
import { haptics } from "@/lib/haptics";

interface PostTestActionsModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  onShare: () => void;
}

export const PostTestActionsModal = ({ post, isOpen, onClose, onShare }: PostTestActionsModalProps) => {
  if (!isOpen) return null;

  const handleShare = () => {
    haptics.light();
    onShare();
    onClose();
  };

  const handleSendToFriend = () => {
    haptics.light();
    console.log('Send to friend for post:', post.id);
    // TODO: Implement send to friend functionality
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl w-[90vw] max-w-sm border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-lg text-foreground">Azioni</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              haptics.light();
              onClose();
            }}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Success Message */}
        <div className="p-4 border-b border-border">
          <div className="bg-success/10 border border-success/20 rounded-lg p-3">
            <p className="text-sm text-success">
              ✅ <strong>Test completato!</strong> Ora puoi scegliere cosa fare con questo contenuto.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 space-y-3">
          <Button
            onClick={handleShare}
            className="w-full flex items-center gap-3 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Share className="h-4 w-4" />
            Condividi
          </Button>
          
          <Button
            onClick={handleSendToFriend}
            variant="outline"
            className="w-full flex items-center gap-3"
          >
            <Send className="h-4 w-4" />
            Invia ad un amico
          </Button>
        </div>
      </div>
    </div>
  );
};
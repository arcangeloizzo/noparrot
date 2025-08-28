import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MockPost } from "@/data/mockData";

interface ArticleReaderProps {
  post: MockPost;
  isOpen: boolean;
  onClose: () => void;
  onProceedToTest: () => void;
}

export const ArticleReader = ({ post, isOpen, onClose, onProceedToTest }: ArticleReaderProps) => {
  const [timeLeft, setTimeLeft] = useState(10);
  const [canProceed, setCanProceed] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(10);
      setCanProceed(false);
      setHasScrolledToBottom(false);
      return;
    }

    // Timer countdown
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setCanProceed(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
      setCanProceed(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-sm w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-lg">Articolo</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Timer/Progress */}
        {!canProceed && (
          <div className="p-4 bg-blue-50 border-b">
            <div className="flex items-center justify-between text-sm">
              <span>Tempo rimanente: {timeLeft}s</span>
              <span className="text-muted-foreground">
                o scorri fino alla fine
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-primary-blue h-2 rounded-full transition-all duration-1000"
                style={{ width: `${((10 - timeLeft) / 10) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Article Content */}
        <div 
          className="flex-1 p-4 overflow-y-auto"
          onScroll={handleScroll}
        >
          <h3 className="font-semibold text-lg mb-3">
            {post.sharedTitle || "Articolo condiviso"}
          </h3>
          
          {post.previewImg && (
            <img 
              src={post.previewImg} 
              alt="Anteprima articolo" 
              className="w-full aspect-video object-cover rounded-lg mb-4"
            />
          )}

          <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod 
              tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim 
              veniam, quis nostrud exercitation ullamco laboris.
            </p>
            <p>
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum 
              dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non 
              proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
            <p>
              Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium 
              doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore 
              veritatis et quasi architecto beatae vitae dicta sunt explicabo.
            </p>
            <p>
              Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, 
              sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
            </p>
            <p>
              At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis 
              praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias.
            </p>
            <p>
              Finale dell'articolo. Ora puoi procedere con il test di comprensione.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4 border-t">
          <Button
            onClick={onProceedToTest}
            disabled={!canProceed}
            className="w-full"
          >
            {canProceed ? "Procedi al Test" : `Attendi ${timeLeft}s`}
          </Button>
        </div>
      </div>
    </div>
  );
};
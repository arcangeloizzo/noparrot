import { useState, useEffect } from "react";
import { X, Share, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MockPost } from "@/data/mockData";

interface ArticleReaderProps {
  post: MockPost;
  isOpen: boolean;
  onClose: () => void;
  onStartQuiz: (action: string) => void;
}

export const ArticleReader = ({ post, isOpen, onClose, onStartQuiz }: ArticleReaderProps) => {
  const [timeLeft, setTimeLeft] = useState(10);
  const [canProceed, setCanProceed] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasCompletedReading, setHasCompletedReading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(10);
      setCanProceed(false);
      setHasScrolledToBottom(false);
      setHasCompletedReading(false);
      return;
    }

    // Timer countdown
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setCanProceed(true);
          setHasCompletedReading(true);
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
      setHasCompletedReading(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl w-[90vw] h-[84vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="font-semibold text-lg text-white">Articolo</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Timer/Progress */}
        {!canProceed && (
          <div className="p-4 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white">Tempo rimanente: {timeLeft}s</span>
              <span className="text-gray-300">
                o scorri fino alla fine
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
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
          <h3 className="font-semibold text-lg mb-3 text-white">
            {post.sharedTitle || "Articolo condiviso"}
          </h3>
          
          {post.previewImg && (
            <img 
              src={post.previewImg} 
              alt="Anteprima articolo" 
              className="w-full aspect-video object-cover rounded-lg mb-4"
            />
          )}

          <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
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

        {/* Action Buttons */}
        <div className="p-4 border-t border-gray-700 space-y-3">
          {canProceed ? (
            <>
              <Button
                onClick={() => onStartQuiz("Condividi")}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
              >
                <Share className="h-4 w-4" />
                Condividi
              </Button>
              
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => onStartQuiz("Confuta")}
                  variant="outline"
                  className="flex items-center gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <MessageSquare className="h-4 w-4" />
                  Confuta
                </Button>
                
                <Button
                  onClick={() => onStartQuiz("Invia ad un amico")}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Invia
                </Button>
              </div>
            </>
          ) : (
            <Button
              disabled
              className="w-full bg-gray-700 text-gray-400 cursor-not-allowed"
            >
              Attendi {timeLeft}s o scorri fino alla fine
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
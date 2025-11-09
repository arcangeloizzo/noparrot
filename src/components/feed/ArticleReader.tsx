import { useState, useEffect } from "react";
import { X, Share, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Post } from "@/hooks/usePosts";

interface ArticleReaderProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  onStartQuiz: (action: string) => void;
  articleContent?: string;
}

export const ArticleReader = ({ post, isOpen, onClose, onStartQuiz }: ArticleReaderProps & { articleContent?: string }) => {
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
      // Unlock body scroll (FASE 1 - CSS puro)
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      return;
    }

    // Lock body scroll when reader is open (FASE 1 - CSS puro)
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

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

    return () => {
      clearInterval(timer);
      // Unlock body scroll on unmount
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
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
            {post.shared_title || "Articolo condiviso"}
          </h3>
          
          {post.preview_img && (
            <img 
              src={post.preview_img} 
              alt="Anteprima articolo" 
              className="w-full aspect-video object-cover rounded-lg mb-4"
            />
          )}

            <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
              {/* Mostra il contenuto completo dall'articolo */}
              <p className="mt-2 font-medium whitespace-pre-wrap">
                {post.article_content || post.content}
              </p>
              
              {post.shared_url && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <a 
                    href={post.shared_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm"
                  >
                    Leggi articolo completo →
                  </a>
                </div>
              )}
            </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-gray-700 space-y-3">
          {canProceed ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => onStartQuiz("Condividi")}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90"
              >
                <Share className="h-4 w-4" />
                Condividi
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
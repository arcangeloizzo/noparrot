import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Plus, ImageIcon, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSendMessage } from "@/hooks/useMessages";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { MediaPreviewTray } from "@/components/media/MediaPreviewTray";
import { extractFirstUrl } from "@/lib/shouldRequireGate";
import { runGateBeforeAction } from "@/lib/runGateBeforeAction";
import { QuizModal } from "@/components/ui/quiz-modal";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface MessageComposerProps {
  threadId: string | null;
  onSendWithoutThread?: (content: string, mediaIds?: string[]) => void;
}

export const MessageComposer = ({ threadId, onSendWithoutThread }: MessageComposerProps) => {
  const [content, setContent] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizData, setQuizData] = useState<any>(null);
  const [debouncedContent, setDebouncedContent] = useState("");
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendMessage = useSendMessage();
  const { uploadMedia, uploadedMedia, removeMedia, clearMedia, isUploading } = useMediaUpload();

  // Debounce content per rilevamento URL (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedContent(content);
    }, 500);
    return () => clearTimeout(timer);
  }, [content]);

  // Estrai URL solo da contenuto debounced
  const linkUrl = useMemo(() => extractFirstUrl(debouncedContent), [debouncedContent]);

  const handleMediaUpload = useCallback(async (type: 'image' | 'video') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'image' ? 'image/*' : 'video/*';
    input.multiple = true;
    input.onchange = async (e: any) => {
      const files = Array.from(e.target.files || []) as File[];
      if (files.length > 0) {
        await uploadMedia(files, type);
      }
    };
    input.click();
    setShowMediaMenu(false);
  }, [uploadMedia]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [content]);

  const handleSend = useCallback(async () => {
    if ((!content.trim() && uploadedMedia.length === 0) || isProcessing || isUploading) return;

    haptics.light();
    const currentLinkUrl = extractFirstUrl(content);

    const doSend = () => {
      if (!threadId && onSendWithoutThread) {
        onSendWithoutThread(content.trim(), uploadedMedia.map(m => m.id));
        setContent("");
        clearMedia();
      } else if (threadId) {
        sendMessage.mutate(
          {
            threadId,
            content: content.trim(),
            linkUrl: currentLinkUrl || undefined,
            mediaIds: uploadedMedia.map(m => m.id)
          },
          {
            onSuccess: () => {
              setContent("");
              clearMedia();
            }
          }
        );
      }
    };

    if (currentLinkUrl) {
      await runGateBeforeAction({
        linkUrl: currentLinkUrl,
        onSuccess: doSend,
        onCancel: () => {
          setIsProcessing(false);
        },
        setIsProcessing,
        setQuizData,
        setShowQuiz
      });
    } else {
      doSend();
    }
  }, [content, uploadedMedia, isProcessing, isUploading, threadId, onSendWithoutThread, sendMessage, clearMedia]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const canSend = (content.trim() || uploadedMedia.length > 0) && !isProcessing && !isUploading;

  return (
    <>
      <div className="border-t border-white/10 bg-gradient-to-t from-background to-background/95 p-3">
        {uploadedMedia.length > 0 && (
          <div className="mb-3">
            <MediaPreviewTray
              media={uploadedMedia}
              onRemove={removeMedia}
            />
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Media Menu Button */}
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "flex-shrink-0 rounded-full w-10 h-10",
                "bg-white/5 hover:bg-white/10 border border-white/10",
                "transition-all duration-200",
                showMediaMenu && "bg-primary/20 border-primary/30"
              )}
              onClick={() => {
                haptics.light();
                setShowMediaMenu(!showMediaMenu);
              }}
              disabled={isUploading || isProcessing}
            >
              {showMediaMenu ? (
                <X className="h-5 w-5 text-primary" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
            </Button>

            {/* Media Options Popup */}
            {showMediaMenu && (
              <div className={cn(
                "absolute bottom-12 left-0 flex gap-2 p-2",
                "bg-card/95 backdrop-blur-xl rounded-2xl",
                "border border-white/10 shadow-xl",
                "animate-scale-in"
              )}>
                <button
                  onClick={() => handleMediaUpload('image')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl",
                    "bg-gradient-to-r from-purple-500/20 to-pink-400/20",
                    "hover:scale-105 active:scale-95 transition-transform",
                    "border border-white/10"
                  )}
                >
                  <ImageIcon className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium">Foto</span>
                </button>
                <button
                  onClick={() => handleMediaUpload('video')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl",
                    "bg-gradient-to-r from-rose-500/20 to-orange-400/20",
                    "hover:scale-105 active:scale-95 transition-transform",
                    "border border-white/10"
                  )}
                >
                  <Video className="w-4 h-4 text-rose-400" />
                  <span className="text-sm font-medium">Video</span>
                </button>
              </div>
            )}
          </div>

          {/* Input Field - Pill Shape */}
          <div className={cn(
            "flex-1 relative bg-white/5 rounded-3xl",
            "border border-white/10 focus-within:border-primary/40",
            "transition-all duration-200"
          )}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Scrivi un messaggio..."
              className={cn(
                "w-full bg-transparent px-4 py-2.5 text-[15px]",
                "resize-none outline-none",
                "placeholder:text-muted-foreground/60",
                "min-h-[40px] max-h-[120px]"
              )}
              rows={1}
              disabled={isProcessing || isUploading}
            />
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            size="icon"
            disabled={!canSend}
            className={cn(
              "flex-shrink-0 rounded-full w-10 h-10",
              "bg-gradient-to-r from-primary to-primary/80",
              "hover:shadow-lg hover:shadow-primary/30 hover:scale-110",
              "active:scale-90 transition-all duration-200",
              "disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none"
            )}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showQuiz && quizData && !quizData.error && (
        <QuizModal
          questions={quizData.questions}
          onSubmit={async (answers: Record<string, string>) => {
            quizData.onSuccess();
            setShowQuiz(false);
            setQuizData(null);
            return { passed: true, wrongIndexes: [] };
          }}
          onCancel={() => {
            quizData.onCancel();
            setShowQuiz(false);
            setQuizData(null);
          }}
          provider="gemini"
        />
      )}

      {showQuiz && quizData?.error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="bg-card border border-white/10 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl">
            <p className="text-foreground font-semibold mb-2">Errore</p>
            <p className="text-muted-foreground text-sm mb-4">{quizData.errorMessage}</p>
            <Button 
              onClick={() => {
                quizData.onCancel();
                setShowQuiz(false);
                setQuizData(null);
              }}
              className="w-full rounded-xl"
            >
              Chiudi
            </Button>
          </div>
        </div>
      )}

      {isProcessing && (
        <LoadingOverlay 
          message="Verifica contenuto..."
          submessage="Preparazione del Comprehension Gate"
        />
      )}
    </>
  );
};

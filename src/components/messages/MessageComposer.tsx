import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Camera, ImageIcon } from "lucide-react";
import { useSendMessage } from "@/hooks/useMessages";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { MediaPreviewTray } from "@/components/media/MediaPreviewTray";
import { extractFirstUrl } from "@/lib/shouldRequireGate";
import { runGateBeforeAction } from "@/lib/runGateBeforeAction";
import { QuizModal } from "@/components/ui/quiz-modal";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";

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

  const handleMediaUpload = useCallback(async (type: 'image' | 'video', capture = false) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'image' ? 'image/*' : 'video/*';
    if (capture) {
      input.capture = 'environment';
    }
    input.multiple = !capture;
    input.onchange = async (e: any) => {
      const files = Array.from(e.target.files || []) as File[];
      if (files.length > 0) {
        await uploadMedia(files, type);
      }
    };
    input.click();
  }, [uploadMedia]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
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
      <div className="border-t border-white/10 bg-background p-3">
        {uploadedMedia.length > 0 && (
          <div className="mb-3">
            <MediaPreviewTray
              media={uploadedMedia}
              onRemove={removeMedia}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Camera Button - Blue circle for direct capture */}
          <button
            onClick={() => {
              haptics.light();
              handleMediaUpload('image', true);
            }}
            disabled={isUploading || isProcessing}
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-full",
              "bg-primary hover:bg-primary/90",
              "flex items-center justify-center",
              "transition-all duration-200",
              "disabled:opacity-50"
            )}
          >
            <Camera className="h-5 w-5 text-primary-foreground" />
          </button>

          {/* Input Field - Pill with gallery icon inside */}
          <div className={cn(
            "flex-1 flex items-center gap-2",
            "bg-zinc-800/80 rounded-3xl",
            "border border-white/10 focus-within:border-primary/40",
            "px-4 py-2",
            "transition-all duration-200"
          )}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Messaggio..."
              className={cn(
                "flex-1 bg-transparent text-[15px]",
                "resize-none outline-none",
                "placeholder:text-white/40",
                "min-h-[24px] max-h-[100px]"
              )}
              rows={1}
              disabled={isProcessing || isUploading}
            />
          </div>

          {/* Media Gallery Button */}
          <button
            onClick={() => {
              haptics.light();
              handleMediaUpload('image');
            }}
            disabled={isUploading || isProcessing}
            className={cn(
              "flex-shrink-0 p-2.5 rounded-full",
              "hover:bg-white/10 transition-colors",
              "disabled:opacity-50"
            )}
          >
            <ImageIcon className="h-5 w-5 text-white/70" />
          </button>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              "flex-shrink-0 p-2.5 rounded-full",
              "transition-all duration-200",
              canSend 
                ? "text-primary hover:bg-primary/10" 
                : "text-white/30"
            )}
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>

      {showQuiz && quizData && !quizData.error && (
        <QuizModal
          questions={quizData.questions}
          qaId={quizData.qaId}
          onSubmit={async (answers: Record<string, string>) => {
            // SECURITY HARDENED: All validation via submit-qa edge function
            try {
              const { data, error } = await supabase.functions.invoke('submit-qa', {
                body: {
                  qaId: quizData.qaId, // Server-generated qaId
                  sourceUrl: quizData.sourceUrl,
                  answers,
                  gateType: 'message'
                }
              });

              if (error) {
                console.error('[MessageComposer] Validation error:', error);
                return { passed: false, wrongIndexes: [] };
              }

              if (data?.passed) {
                quizData.onSuccess();
                setShowQuiz(false);
                setQuizData(null);
              }

              return { 
                passed: data?.passed || false, 
                score: data?.score || 0,
                total: data?.total || quizData.questions.length,
                wrongIndexes: data?.wrongIndexes || [] 
              };
            } catch (err) {
              console.error('[MessageComposer] Unexpected error:', err);
              return { passed: false, wrongIndexes: [] };
            }
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
            <button 
              onClick={() => {
                quizData.onCancel();
                setShowQuiz(false);
                setQuizData(null);
              }}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium"
            >
              Chiudi
            </button>
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

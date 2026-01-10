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
      <div className="border-t border-white/5 bg-background/95 backdrop-blur-sm px-3 py-2.5">
        {uploadedMedia.length > 0 && (
          <div className="mb-2.5">
            <MediaPreviewTray
              media={uploadedMedia}
              onRemove={removeMedia}
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Camera Button - Blue filled circle (IG style) */}
          <button
            onClick={() => {
              haptics.light();
              handleMediaUpload('image', true);
            }}
            disabled={isUploading || isProcessing}
            className={cn(
              "flex-shrink-0 w-11 h-11 rounded-full",
              "bg-primary hover:bg-primary/90",
              "flex items-center justify-center",
              "transition-all duration-200 active:scale-95",
              "disabled:opacity-50 shadow-lg shadow-primary/20"
            )}
          >
            <Camera className="h-[22px] w-[22px] text-primary-foreground" />
          </button>

          {/* Input Field - Dark pill (IG style) */}
          <div className={cn(
            "flex-1 flex items-center",
            "bg-zinc-800/90 rounded-full",
            "border border-white/[0.08]",
            "px-4 py-2.5",
            "transition-all duration-200",
            "focus-within:border-white/20"
          )}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Messaggio..."
              className={cn(
                "flex-1 bg-transparent text-[15px] leading-[1.4]",
                "resize-none outline-none",
                "placeholder:text-white/35",
                "min-h-[22px] max-h-[100px]"
              )}
              rows={1}
              disabled={isProcessing || isUploading}
            />

            {/* Icons inside the pill on the right */}
            <div className="flex items-center gap-1 ml-2">
              {/* Media Gallery Button */}
              <button
                onClick={() => {
                  haptics.light();
                  handleMediaUpload('image');
                }}
                disabled={isUploading || isProcessing}
                className={cn(
                  "p-1.5 rounded-full",
                  "hover:bg-white/10 transition-colors active:scale-95",
                  "disabled:opacity-50"
                )}
              >
                <ImageIcon className="h-[22px] w-[22px] text-white/60" />
              </button>
            </div>
          </div>

          {/* Send Button - outside pill */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              "flex-shrink-0 p-2 rounded-full",
              "transition-all duration-200 active:scale-95",
              canSend 
                ? "text-primary" 
                : "text-white/25"
            )}
          >
            <Send className="h-6 w-6" />
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

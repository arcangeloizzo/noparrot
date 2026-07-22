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
import { addBreadcrumb } from "@/lib/crashBreadcrumbs";

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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedContent(content), 500);
    return () => clearTimeout(t);
  }, [content]);
  useMemo(() => extractFirstUrl(debouncedContent), [debouncedContent]);

  const handleMediaUpload = useCallback(async (type: "image" | "video", capture = false) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = type === "image" ? "image/*" : "video/*";
    if (capture) input.capture = "environment";
    input.multiple = !capture;
    input.onchange = async (e: any) => {
      const files = Array.from(e.target.files || []) as File[];
      if (files.length > 0) await uploadMedia(files, type);
    };
    input.click();
  }, [uploadMedia]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
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
            mediaIds: uploadedMedia.map(m => m.id),
          },
          { onSuccess: () => { setContent(""); clearMedia(); } }
        );
      }
    };

    if (currentLinkUrl) {
      await runGateBeforeAction({
        linkUrl: currentLinkUrl,
        onSuccess: doSend,
        onCancel: () => setIsProcessing(false),
        setIsProcessing,
        setQuizData,
        setShowQuiz,
      });
    } else {
      doSend();
    }
  }, [content, uploadedMedia, isProcessing, isUploading, threadId, onSendWithoutThread, sendMessage, clearMedia]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const hasText = content.trim().length > 0;
  const canSend = (hasText || uploadedMedia.length > 0) && !isProcessing && !isUploading;

  return (
    <>
      <div
        style={{
          background: "rgba(14,21,34,0.92)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 10,
          paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)",
        }}
      >
        {uploadedMedia.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <MediaPreviewTray media={uploadedMedia} onRemove={removeMedia} />
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Ghost camera */}
          <button
            onClick={() => { haptics.light(); handleMediaUpload("image", true); }}
            disabled={isUploading || isProcessing}
            aria-label="Fotocamera"
            className="flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
            style={{
              width: 36, height: 36, borderRadius: 18,
              background: "transparent", color: "var(--txt-2)",
            }}
          >
            <Camera className="h-[20px] w-[20px]" />
          </button>

          {/* Glass pill input */}
          <div
            className="flex-1 flex items-center"
            style={{
              minHeight: 46,
              borderRadius: 23,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              padding: "6px 10px 6px 18px",
            }}
          >
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Messaggio…"
              rows={1}
              disabled={isProcessing || isUploading}
              className={cn(
                "flex-1 bg-transparent resize-none outline-none",
              )}
              style={{
                fontSize: 15,
                lineHeight: 1.4,
                color: "var(--txt)",
                minHeight: 22,
                maxHeight: 100,
                paddingTop: 6,
                paddingBottom: 6,
              }}
            />
            <button
              onClick={() => { haptics.light(); handleMediaUpload("image"); }}
              disabled={isUploading || isProcessing}
              aria-label="Galleria"
              className="flex items-center justify-center active:scale-95 transition-transform"
              style={{
                width: 36, height: 36, borderRadius: 18,
                background: "transparent", color: "var(--txt-3)",
              }}
            >
              <ImageIcon className="h-[20px] w-[20px]" />
            </button>
          </div>

          {/* Send — blue circle only when there is content */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Invia"
            className="flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
            style={{
              width: 36, height: 36, borderRadius: 18,
              background: canSend ? "#0A7AFF" : "transparent",
              color: canSend ? "#FFFFFF" : "var(--txt-3)",
              boxShadow: canSend ? "0 6px 18px rgba(10,122,255,0.35)" : "none",
            }}
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {showQuiz && quizData && !quizData.error && (
        <QuizModal
          questions={quizData.questions}
          qaId={quizData.qaId}
          onSubmit={async (answers: Record<string, string>) => {
            try {
              const { data, error } = await supabase.functions.invoke("submit-qa", {
                body: { qaId: quizData.qaId, sourceUrl: quizData.sourceUrl, answers, gateType: "message" },
              });
              if (error) return { passed: false, wrongIndexes: [] };
              if (data?.passed) {
                quizData.onSuccess();
                addBreadcrumb("quiz_closed", { via: "passed" });
                setShowQuiz(false); setQuizData(null);
              }
              return {
                passed: data?.passed || false,
                score: data?.score || 0,
                total: data?.total || quizData.questions.length,
                wrongIndexes: data?.wrongIndexes || [],
              };
            } catch {
              addBreadcrumb("quiz_closed", { via: "error" });
              return { passed: false, wrongIndexes: [] };
            }
          }}
          onCancel={() => {
            quizData.onCancel();
            addBreadcrumb("quiz_closed", { via: "cancelled" });
            setShowQuiz(false); setQuizData(null);
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
                addBreadcrumb("quiz_closed", { via: "error_dismissed" });
                setShowQuiz(false); setQuizData(null);
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
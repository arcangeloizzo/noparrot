import { useState, useRef, useEffect } from "react";
import { Send, Image as ImageIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSendMessage } from "@/hooks/useMessages";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { MediaPreviewTray } from "@/components/media/MediaPreviewTray";
import { extractFirstUrl } from "@/lib/shouldRequireGate";
import { runGateBeforeAction } from "@/lib/runGateBeforeAction";
import { QuizModal } from "@/components/ui/quiz-modal";
import { toast } from "sonner";

interface MessageComposerProps {
  threadId: string;
}

export const MessageComposer = ({ threadId }: MessageComposerProps) => {
  const [content, setContent] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizData, setQuizData] = useState<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendMessage = useSendMessage();
  const { uploadMedia, uploadedMedia, removeMedia, clearMedia, isUploading } = useMediaUpload();

  const handleMediaUpload = async (type: 'image' | 'video') => {
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
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleSend = async () => {
    if ((!content.trim() && uploadedMedia.length === 0) || isProcessing || isUploading) return;

    const linkUrl = extractFirstUrl(content);

    const doSend = () => {
      sendMessage.mutate(
        {
          threadId,
          content: content.trim(),
          linkUrl: linkUrl || undefined,
          mediaIds: uploadedMedia.map(m => m.id)
        },
        {
          onSuccess: () => {
            setContent("");
            clearMedia();
          }
        }
      );
    };

    if (linkUrl) {
      // Gate richiesto
      await runGateBeforeAction({
        linkUrl,
        onSuccess: doSend,
        onCancel: () => toast.error('Invio annullato'),
        setIsProcessing,
        setQuizData,
        setShowQuiz
      });
    } else {
      // Invio diretto
      doSend();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div className="border-t border-border bg-background p-3">
        {uploadedMedia.length > 0 && (
          <div className="mb-2">
            <MediaPreviewTray
              media={uploadedMedia}
              onRemove={removeMedia}
            />
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="flex-shrink-0"
              onClick={() => handleMediaUpload('image')}
              disabled={isUploading || isProcessing}
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="flex-shrink-0"
              onClick={() => handleMediaUpload('video')}
              disabled={isUploading || isProcessing}
            >
              <Video className="h-5 w-5" />
            </Button>
          </div>

          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Scrivi un messaggio..."
            className="flex-1 min-h-[40px] max-h-32 resize-none"
            rows={1}
            disabled={isProcessing || isUploading}
          />

          <Button
            onClick={handleSend}
            size="icon"
            disabled={(!content.trim() && uploadedMedia.length === 0) || isProcessing || isUploading}
            className="flex-shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {showQuiz && quizData && (
        <QuizModal
          questions={quizData.questions}
          onSubmit={async (answers: Record<string, string>) => {
            // Qui non validamo, lasciamo passare sempre
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
    </>
  );
};

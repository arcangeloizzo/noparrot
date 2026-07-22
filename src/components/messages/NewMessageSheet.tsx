import { useState } from "react";
import { X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageComposer } from "./MessageComposer";
import { useCreateThread } from "@/hooks/useMessageThreads";
import { useSendMessage } from "@/hooks/useMessages";
import { useNavigate } from "react-router-dom";
import { extractFirstUrl } from "@/lib/shouldRequireGate";
import { runGateBeforeAction } from "@/lib/runGateBeforeAction";
import { QuizModal } from "@/components/ui/quiz-modal";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface NewMessageSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: Array<{ id: string; username: string; full_name?: string; avatar_url?: string | null }>;
}

export const NewMessageSheet = ({ isOpen, onClose, selectedUsers }: NewMessageSheetProps) => {
  const navigate = useNavigate();
  const createThread = useCreateThread();
  const sendMessage = useSendMessage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizData, setQuizData] = useState<any>(null);

  const handleSendMessage = async (messageContent: string, mediaIds?: string[]) => {
    if (!messageContent.trim() || selectedUsers.length === 0) return;
    const linkUrl = extractFirstUrl(messageContent);

    const doSend = async () => {
      try {
        const participantIds = selectedUsers.map(u => u.id);
        const result = await createThread.mutateAsync(participantIds);
        await sendMessage.mutateAsync({
          threadId: result.thread_id,
          content: messageContent.trim(),
          linkUrl: linkUrl || undefined,
          mediaIds,
        });
        navigate(`/messages/${result.thread_id}`);
        onClose();
      } catch (error) {
        toast.error("Errore", {
          description: error instanceof Error ? error.message : "Impossibile creare la conversazione",
        });
      }
    };

    if (linkUrl) {
      setIsProcessing(true);
      await runGateBeforeAction({
        linkUrl,
        onSuccess: doSend,
        onCancel: () => setIsProcessing(false),
        setIsProcessing,
        setQuizData,
        setShowQuiz,
      });
    } else {
      await doSend();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{
          background: "var(--base)",
          color: "var(--txt)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10"
          style={{
            background: "linear-gradient(180deg, var(--base) 0%, rgba(14,21,34,0.9) 55%, rgba(14,21,34,0) 100%)",
          }}
        >
          <div className="flex items-center gap-3 px-4" style={{ height: 56 }}>
            <button
              onClick={onClose}
              aria-label="Chiudi"
              className="flex items-center justify-center rounded-full"
              style={{ width: 36, height: 36, color: "var(--txt-2)" }}
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="shell-title" style={{ fontSize: 20 }}>Nuovo messaggio</h2>
          </div>

          <div className="px-4 pb-3">
            <div className="mono-eyebrow" style={{ marginBottom: 8 }}>A</div>
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-2"
                  style={{
                    padding: "6px 12px 6px 6px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.09)",
                  }}
                >
                  <Avatar style={{ width: 22, height: 22 }}>
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback style={{ fontSize: 10, background: "rgba(255,255,255,0.08)" }}>
                      {user.username?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                    {user.full_name || user.username}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Empty stage */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
            <p style={{ fontSize: 15, color: "var(--txt-3)" }}>
              Scrivi il primo messaggio 👋
            </p>
          </div>
        </div>

        {/* Composer */}
        <MessageComposer threadId={null} onSendWithoutThread={handleSendMessage} />
      </div>

      {showQuiz && quizData && !quizData.error && (
        <QuizModal
          questions={quizData.questions}
          qaId={quizData.qaId}
          onSubmit={async (answers: Record<string, string>) => {
            try {
              const { data, error } = await supabase.functions.invoke("submit-qa", {
                body: {
                  qaId: quizData.qaId,
                  sourceUrl: quizData.sourceUrl,
                  answers,
                  gateType: "message",
                },
              });
              if (error) return { passed: false, wrongIndexes: [] };
              if (data?.passed) {
                quizData.onSuccess();
                setShowQuiz(false); setQuizData(null);
              }
              return {
                passed: data?.passed || false,
                score: data?.score || 0,
                total: data?.total || quizData.questions.length,
                wrongIndexes: data?.wrongIndexes || [],
              };
            } catch {
              return { passed: false, wrongIndexes: [] };
            }
          }}
          onCancel={() => {
            quizData.onCancel();
            setShowQuiz(false); setQuizData(null);
          }}
          provider="gemini"
        />
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
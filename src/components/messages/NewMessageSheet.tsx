import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface NewMessageSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: Array<{ id: string; username: string; full_name?: string; avatar_url?: string | null }>;
}

export const NewMessageSheet = ({ isOpen, onClose, selectedUsers }: NewMessageSheetProps) => {
  const navigate = useNavigate();
  const createThread = useCreateThread();
  const sendMessage = useSendMessage();
  const [content, setContent] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizData, setQuizData] = useState<any>(null);

  const handleSendMessage = async (messageContent: string, mediaIds?: string[]) => {
    if (!messageContent.trim() || selectedUsers.length === 0) return;

    const linkUrl = extractFirstUrl(messageContent);

    const doSend = async () => {
      try {
        console.log('[NewMessageSheet] Creating thread with participants:', selectedUsers.map(u => u.id));
        
        // Crea thread con tutti gli utenti selezionati
        const participantIds = selectedUsers.map(u => u.id);
        const result = await createThread.mutateAsync(participantIds);

        console.log('[NewMessageSheet] Thread created:', result);

        // Invia il primo messaggio
        await sendMessage.mutateAsync({
          threadId: result.thread_id,
          content: messageContent.trim(),
          linkUrl: linkUrl || undefined,
          mediaIds
        });

        console.log('[NewMessageSheet] Message sent successfully');

        // Naviga al thread appena creato
        navigate(`/messages/${result.thread_id}`);
        onClose();
      } catch (error) {
        console.error('[NewMessageSheet] Error creating conversation:', error);
        toast.error('Errore', {
          description: error instanceof Error ? error.message : 'Impossibile creare la conversazione'
        });
      }
    };

    if (linkUrl) {
      // Gate richiesto
      setIsProcessing(true);
      await runGateBeforeAction({
        linkUrl,
        onSuccess: doSend,
        onCancel: () => {
          setIsProcessing(false);
        },
        setIsProcessing,
        setQuizData,
        setShowQuiz
      });
    } else {
      // Invio diretto
      await doSend();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background">
          <div className="flex items-center gap-3 px-4 h-14">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
            <h2 className="font-semibold flex-1">Nuova conversazione</h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                const textarea = document.querySelector('textarea[placeholder="Scrivi un messaggio..."]') as HTMLTextAreaElement;
                if (textarea) {
                  textarea.focus();
                }
              }}
              className="text-primary font-semibold"
            >
              Inizia
            </Button>
          </div>

          {/* Destinatari */}
          <div className="px-4 pb-3">
            <div className="text-xs text-muted-foreground mb-2">A:</div>
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {user.username?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">
                    {user.full_name || user.username}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content area - Spacer per MessageComposer */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="p-4">
            <p className="text-sm text-muted-foreground text-center">
              Inizia la conversazione 👋
            </p>
          </div>
        </div>

        {/* Message Composer - usando il componente completo */}
        <div className="border-t border-border bg-background">
          <MessageComposer 
            threadId={null}
            onSendWithoutThread={handleSendMessage}
          />
        </div>
      </div>

      {showQuiz && quizData && (
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

      {isProcessing && (
        <LoadingOverlay 
          message="Verifica contenuto..."
          submessage="Preparazione del Comprehension Gate"
        />
      )}
    </>
  );
};


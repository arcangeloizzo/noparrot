import { ArrowLeft, MessageSquarePlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThreadList } from "@/components/messages/ThreadList";
import { useMessageThreads, useCreateThread } from "@/hooks/useMessageThreads";
import { PeoplePicker } from "@/components/share/PeoplePicker";
import { useState } from "react";

export default function Messages() {
  const navigate = useNavigate();
  const { data: threads, isLoading } = useMessageThreads();
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const createThread = useCreateThread();

  const handleStartConversation = async (selectedUserIds: string[]) => {
    if (selectedUserIds.length === 0) return;
    
    const result = await createThread.mutateAsync(selectedUserIds);
    setShowPeoplePicker(false);
    navigate(`/messages/${result.thread_id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Messaggi</h1>
        </div>
      </div>

      {/* Lista thread */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      ) : threads && threads.length > 0 ? (
        <ThreadList threads={threads} />
      ) : (
        <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
          <p className="text-lg font-semibold mb-2">Nessun messaggio</p>
          <p className="text-muted-foreground text-sm">
            Inizia una conversazione condividendo un post con un amico!
          </p>
        </div>
      )}

      {/* FAB Nuova conversazione */}
      <Button
        size="icon"
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-10"
        onClick={() => setShowPeoplePicker(true)}
      >
        <MessageSquarePlus className="h-6 w-6" />
      </Button>

      {/* People Picker */}
      <PeoplePicker
        isOpen={showPeoplePicker}
        onClose={() => setShowPeoplePicker(false)}
        onSend={handleStartConversation}
      />
    </div>
  );
}

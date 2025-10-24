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
    
    try {
      const result = await createThread.mutateAsync(selectedUserIds);
      setShowPeoplePicker(false);
      navigate(`/messages/${result.thread_id}`);
    } catch (error) {
      console.error('Thread creation error:', error);
      // Error handling is already done in the mutation
    }
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

      {/* FAB Nuova conversazione - Enhanced */}
      <button
        onClick={() => {
          setShowPeoplePicker(true);
        }}
        className="fixed w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg z-10 transition-all duration-200 hover:scale-110 active:scale-95"
        style={{ 
          right: 'max(16px, env(safe-area-inset-right))',
          bottom: 'calc(80px + env(safe-area-inset-bottom))',
          boxShadow: '0 8px 24px rgba(0,0,0,.32)'
        }}
        aria-label="Nuova conversazione"
      >
        <MessageSquarePlus className="h-7 w-7" />
      </button>

      {/* People Picker */}
      <PeoplePicker
        isOpen={showPeoplePicker}
        onClose={() => setShowPeoplePicker(false)}
        onSend={handleStartConversation}
      />
    </div>
  );
}

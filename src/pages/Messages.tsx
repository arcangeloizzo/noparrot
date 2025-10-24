import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThreadList } from "@/components/messages/ThreadList";
import { useMessageThreads } from "@/hooks/useMessageThreads";

export default function Messages() {
  const navigate = useNavigate();
  const { data: threads, isLoading } = useMessageThreads();

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
    </div>
  );
}

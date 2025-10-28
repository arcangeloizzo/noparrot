import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageBubble } from "@/components/messages/MessageBubble";
import { MessageComposer } from "@/components/messages/MessageComposer";
import { useMessages } from "@/hooks/useMessages";
import { useMessageThreads, useMarkThreadAsRead } from "@/hooks/useMessageThreads";
import { useAuth } from "@/contexts/AuthContext";

export default function MessageThread() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useMessages(threadId);
  const { data: threads } = useMessageThreads();
  const markAsRead = useMarkThreadAsRead();

  // Trova il thread corrente
  const currentThread = threads?.find(t => t.id === threadId);
  const otherParticipants = currentThread?.participants?.filter(
    (p: any) => p.user_id !== user?.id
  ) || [];
  const isGroupChat = otherParticipants.length > 1;
  const displayProfile = otherParticipants[0]?.profile;

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when opening thread
  useEffect(() => {
    if (threadId) {
      markAsRead.mutate(threadId);
    }
  }, [threadId]);

  if (!threadId) {
    navigate('/messages');
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/messages')}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {displayProfile && (
            <>
              <Avatar className="h-9 w-9">
                <AvatarImage src={displayProfile.avatar_url || undefined} />
                <AvatarFallback>
                  {displayProfile.username?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              {isGroupChat ? (
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {otherParticipants.map(p => p.profile?.full_name || p.profile?.username).join(', ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {otherParticipants.length} partecipanti
                  </p>
                </div>
              ) : (
                <button 
                  onClick={() => navigate(`/user/${displayProfile.id}`)}
                  className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                >
                  <p className="font-semibold truncate">
                    {displayProfile.full_name || displayProfile.username}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    @{displayProfile.username}
                  </p>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Caricamento...</p>
          </div>
        ) : messages && messages.length > 0 ? (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Nessun messaggio ancora</p>
          </div>
        )}
      </div>

      {/* Composer */}
      <MessageComposer threadId={threadId} />
    </div>
  );
}

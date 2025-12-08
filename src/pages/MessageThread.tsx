import { useEffect, useRef, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageBubble } from "@/components/messages/MessageBubble";
import { MessageComposer } from "@/components/messages/MessageComposer";
import { useMessages } from "@/hooks/useMessages";
import { useMessageThreads, useMarkThreadAsRead } from "@/hooks/useMessageThreads";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import { it } from "date-fns/locale";

export default function MessageThread() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

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

  // Calcola online status
  const isOnline = useMemo(() => {
    if (!displayProfile?.last_seen_at) return false;
    const lastSeen = new Date(displayProfile.last_seen_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastSeen.getTime()) / 1000 / 60;
    return diffMinutes < 5;
  }, [displayProfile?.last_seen_at]);

  const lastSeenText = useMemo(() => {
    if (!displayProfile?.last_seen_at) return null;
    if (isOnline) return "Attivo/a ora";
    const lastSeen = new Date(displayProfile.last_seen_at);
    const diffMinutes = Math.floor((new Date().getTime() - lastSeen.getTime()) / 1000 / 60);
    if (diffMinutes < 60) return `Attivo/a ${diffMinutes} min fa`;
    return `Attivo/a ${formatDistanceToNow(lastSeen, { locale: it })} fa`;
  }, [displayProfile?.last_seen_at, isOnline]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    if (!messages) return [];
    
    const groups: { date: string; messages: typeof messages }[] = [];
    let currentDate = '';
    
    messages.forEach(msg => {
      const msgDate = new Date(msg.created_at);
      let dateLabel = '';
      
      if (isToday(msgDate)) {
        dateLabel = 'Oggi';
      } else if (isYesterday(msgDate)) {
        dateLabel = 'Ieri';
      } else {
        dateLabel = format(msgDate, 'd MMMM yyyy', { locale: it });
      }
      
      if (dateLabel !== currentDate) {
        currentDate = dateLabel;
        groups.push({ date: dateLabel, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });
    
    return groups;
  }, [messages]);

  // Scroll to bottom - using ResizeObserver for reliable scroll after content loads
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const scrollToBottom = (behavior: ScrollBehavior = 'instant') => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    };

    // Initial scroll
    scrollToBottom(isFirstLoad.current ? 'instant' : 'smooth');

    // Use ResizeObserver to scroll when content changes size (images loading)
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        scrollToBottom(isFirstLoad.current ? 'instant' : 'smooth');
      });
      
      resizeObserver.observe(containerRef.current);
      
      // Also retry a few times for safety
      const timer1 = setTimeout(() => scrollToBottom(isFirstLoad.current ? 'instant' : 'smooth'), 200);
      const timer2 = setTimeout(() => {
        scrollToBottom(isFirstLoad.current ? 'instant' : 'smooth');
        isFirstLoad.current = false;
      }, 800);

      return () => {
        resizeObserver.disconnect();
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
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
      {/* Header Instagram-style */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 h-16">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/messages')}
            className="flex-shrink-0 -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {displayProfile && (
            <>
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={displayProfile.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {displayProfile.username?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                {isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-trust-high rounded-full border-2 border-background" />
                )}
              </div>
              
              {isGroupChat ? (
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-sm">
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
                  <p className="font-semibold truncate text-sm">
                    {displayProfile.full_name || displayProfile.username}
                  </p>
                  {lastSeenText && (
                    <p className="text-xs text-muted-foreground">
                      {lastSeenText}
                    </p>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 bg-muted/30">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : groupedMessages.length > 0 ? (
          <>
            {groupedMessages.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-4">
                  <span className="text-xs text-muted-foreground bg-background/80 px-3 py-1 rounded-full">
                    {group.date}
                  </span>
                </div>
                
                {group.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-3">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-sm">Nessun messaggio ancora</p>
            <p className="text-xs mt-1">Inizia la conversazione!</p>
          </div>
        )}
      </div>

      {/* Composer */}
      <MessageComposer threadId={threadId} />
    </div>
  );
}

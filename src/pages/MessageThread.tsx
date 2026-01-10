import { useEffect, useRef, useMemo, useLayoutEffect, useState, useCallback } from "react";
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
import { cn } from "@/lib/utils";

export default function MessageThread() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const prevMessageCountRef = useRef(0);

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

  // Header intelligente per gruppi
  const getGroupDisplayName = useMemo(() => {
    if (!isGroupChat) return null;

    const names = otherParticipants
      .slice(0, 2)
      .map((p: any) => p.profile?.full_name || p.profile?.username)
      .filter(Boolean);

    const remaining = otherParticipants.length - 2;

    if (remaining > 0) {
      return `${names.join(', ')} e altri ${remaining}`;
    }
    return names.join(', ');
  }, [otherParticipants, isGroupChat]);

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
    if (isOnline) return 'Attivo/a ora';
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

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    // Prefer endRef scrollIntoView (handles async height changes better than scrollTop)
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);


  // Robust initial scroll: keep auto-scrolling while media loads for a short window
  useLayoutEffect(() => {
    if (isLoading || !messages || messages.length === 0) return;
    if (isReady) return;

    // 1) Immediate + a few RAFs (iOS/webview friendly)
    scrollToBottom('auto');
    requestAnimationFrame(() => {
      scrollToBottom('auto');
      requestAnimationFrame(() => scrollToBottom('auto'));
    });

    // 2) ResizeObserver window (handles images/videos expanding)
    const el = contentRef.current;
    if (!el) return;

    let settleTimer: number | undefined;
    const MAX_WINDOW_MS = 3500;
    const startedAt = Date.now();

    const settle = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        setIsReady(true);
        prevMessageCountRef.current = messages.length;
      }, 250);
    };

    const observer = new ResizeObserver(() => {
      // Only auto-scroll during the initial window
      if (Date.now() - startedAt < MAX_WINDOW_MS) {
        scrollToBottom('auto');
        settle();
      }
    });

    observer.observe(el);
    settle();

    const hardStop = window.setTimeout(() => {
      setIsReady(true);
      prevMessageCountRef.current = messages.length;
    }, MAX_WINDOW_MS);

    return () => {
      window.clearTimeout(hardStop);
      window.clearTimeout(settleTimer);
      observer.disconnect();
    };
  }, [isLoading, messages, isReady, scrollToBottom]);

  // Scroll for new messages
  useEffect(() => {
    if (!isReady) return;
    if (!messages) return;

    if (messages.length > prevMessageCountRef.current) {
      scrollToBottom('auto');
      prevMessageCountRef.current = messages.length;
    }
  }, [messages?.length, isReady, scrollToBottom]);


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
                    {getGroupDisplayName}
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

      {/* Messages - con will-change per performance */}
      <div 
        ref={containerRef} 
        className={cn(
          "flex-1 overflow-y-auto px-4 py-4 bg-muted/30",
          "will-change-scroll overscroll-y-contain"
        )}
        style={{ willChange: 'scroll-position' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : groupedMessages.length > 0 ? (
          <div ref={contentRef}>
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
            <div ref={messagesEndRef} className="h-1" />
          </div>
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

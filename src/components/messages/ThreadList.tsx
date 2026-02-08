import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { MessageThread } from "@/hooks/useMessageThreads";
import { memo } from "react";

interface ThreadListProps {
  threads: MessageThread[];
  onlineUsers: Set<string>;
}

// Helper function to get display username
const getDisplayUsername = (username: string | null | undefined): string => {
  if (!username) return 'utente';
  if (username.includes('@')) {
    return username.split('@')[0];
  }
  return username;
};

// Format timestamp to compact form (e.g., "2h", "3g", "1s")
const formatCompactTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 1) return 'ora';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}g`;
  return `${diffWeeks}s`;
};

const ThreadItem = memo(({ 
  thread, 
  userId, 
  isOnline,
  index 
}: { 
  thread: MessageThread; 
  userId: string;
  isOnline: boolean;
  index: number;
}) => {
  const otherParticipants = thread.participants?.filter((p: any) => p.user_id !== userId) || [];
  const isGroupChat = otherParticipants.length > 1;
  const displayProfile = otherParticipants[0]?.profile;
  const otherUserId = otherParticipants[0]?.user_id;

  if (!displayProfile) return null;

  const isUnread = (thread.unread_count || 0) > 0;
  const unreadCount = thread.unread_count || 0;

  const displayName = isGroupChat 
    ? otherParticipants.map(p => getDisplayUsername(p.profile?.username) || p.profile?.full_name).join(', ')
    : (displayProfile.full_name || getDisplayUsername(displayProfile.username));

  return (
    <Link
      to={`/messages/${thread.id}`}
      className="flex items-center gap-4 p-4 hover:bg-accent/30 active:bg-accent/50 transition-colors duration-200"
    >
      {/* Avatar with online indicator */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-14 w-14 ring-2 ring-background">
          <AvatarImage src={displayProfile.avatar_url || undefined} loading="lazy" />
          <AvatarFallback className="text-lg font-medium bg-accent">
            {displayProfile.username?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-background rounded-full" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`font-semibold truncate ${isUnread ? 'text-foreground' : 'text-foreground/80'}`}>
            {displayName}
          </span>
          {isUnread && (
            <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
          )}
        </div>

        {thread.last_message && (
          <div className="flex items-center gap-2">
            <p className={`text-sm truncate flex-1 ${isUnread ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
              {thread.last_message.sender_id === userId ? 'Tu: ' : ''}
              {thread.last_message.content}
            </p>
          </div>
        )}
      </div>

      {/* Right side: time and unread badge */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {thread.last_message && (
          <span className="text-xs text-muted-foreground">
            {formatCompactTime(new Date(thread.last_message.created_at))}
          </span>
        )}
        {unreadCount > 1 && (
          <span className="bg-primary text-primary-foreground text-xs font-semibold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
            {unreadCount}
          </span>
        )}
      </div>
    </Link>
  );
});

ThreadItem.displayName = 'ThreadItem';

export const ThreadList = ({ threads, onlineUsers }: ThreadListProps) => {
  const { user } = useAuth();

  if (threads.length === 0) {
    return null;
  }

  return (
    <div className="divide-y divide-border/50">
      {threads.map((thread, index) => {
        const otherParticipants = thread.participants?.filter((p: any) => p.user_id !== user?.id) || [];
        const otherUserId = otherParticipants[0]?.user_id;
        const isOnline = otherUserId ? onlineUsers.has(otherUserId) : false;

        return (
          <ThreadItem 
            key={thread.id} 
            thread={thread} 
            userId={user?.id || ''} 
            isOnline={isOnline}
            index={index}
          />
        );
      })}
    </div>
  );
};

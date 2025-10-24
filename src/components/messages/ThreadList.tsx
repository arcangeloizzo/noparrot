import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { MessageThread } from "@/hooks/useMessageThreads";

interface ThreadListProps {
  threads: MessageThread[];
}

export const ThreadList = ({ threads }: ThreadListProps) => {
  const { user } = useAuth();

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p>Nessuna conversazione</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {threads.map((thread) => {
        // Trova l'altro utente (non il current user)
        const otherParticipant = thread.participants?.find(
          (p: any) => p.user_id !== user?.id
        );
        const otherProfile = otherParticipant?.profile;

        if (!otherProfile) return null;

        const isUnread = (thread.unread_count || 0) > 0;

        return (
          <Link
            key={thread.id}
            to={`/messages/${thread.id}`}
            className="flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors"
          >
            <Avatar className="h-12 w-12">
              <AvatarImage src={otherProfile.avatar_url || undefined} />
              <AvatarFallback>
                {otherProfile.username?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className={`font-semibold truncate ${isUnread ? 'text-foreground' : 'text-foreground/80'}`}>
                  {otherProfile.full_name || otherProfile.username}
                </span>
                {thread.last_message && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(thread.last_message.created_at), {
                      addSuffix: true,
                      locale: it
                    })}
                  </span>
                )}
              </div>

              {thread.last_message && (
                <p className={`text-sm truncate ${isUnread ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {thread.last_message.sender_id === user?.id ? 'Tu: ' : ''}
                  {thread.last_message.content}
                </p>
              )}
            </div>

            {isUnread && (
              <div className="flex-shrink-0 bg-primary text-primary-foreground text-xs font-semibold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                {thread.unread_count}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
};

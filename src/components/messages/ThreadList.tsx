import { useNavigate } from "react-router-dom";
import { ProgressiveImage } from "@/components/feed/ProgressiveImage";
import { useAuth } from "@/contexts/AuthContext";
import { MessageThread } from "@/hooks/useMessageThreads";
import { memo } from "react";
import { Row } from "@/components/shell/Row";

interface ThreadListProps {
  threads: MessageThread[];
  onlineUsers: Set<string>;
}

const getDisplayUsername = (username: string | null | undefined): string => {
  if (!username) return 'utente';
  if (username.includes('@')) {
    return username.split('@')[0];
  }
  return username;
};

const formatCompactTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 1) return 'ORA';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}g`;
  return `${diffWeeks}s`;
};

const AVATAR = 50;
const AVATAR_SMALL = 34;

function AvatarCircle({
  src,
  fallback,
  size = AVATAR,
  online,
  priority,
}: {
  src?: string | null;
  fallback: string;
  size?: number;
  online?: boolean;
  priority?: boolean;
}) {
  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <div
        className="rounded-full overflow-hidden bg-white/[0.06] flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span
          className="absolute z-0 font-semibold"
          style={{ fontSize: size * 0.34, color: "var(--txt-2)" }}
        >
          {fallback}
        </span>
        <ProgressiveImage
          src={src || undefined}
          className="w-full h-full object-cover relative z-10"
          priority={priority}
          dominantColor="transparent"
          sizePx={size}
        />
      </div>
      {online && (
        <span
          className="absolute rounded-full"
          style={{
            width: 13,
            height: 13,
            right: -1,
            bottom: -1,
            background: "#22C55E",
            border: "2.5px solid var(--base)",
            zIndex: 20,
          }}
        />
      )}
    </div>
  );
}

function StackedGroupAvatar({
  participants,
}: {
  participants: MessageThread["participants"];
}) {
  const [a, b] = participants.slice(0, 2);
  const initial = (p: any) =>
    (p?.profile?.username || p?.profile?.full_name || "?")[0]?.toUpperCase() ??
    "?";

  return (
    <div className="relative flex-shrink-0" style={{ width: AVATAR, height: AVATAR }}>
      <div className="absolute" style={{ top: 0, left: 0 }}>
        <AvatarCircle
          src={a?.profile?.avatar_url}
          fallback={initial(a)}
          size={AVATAR_SMALL}
        />
      </div>
      <div
        className="absolute rounded-full"
        style={{
          bottom: 0,
          right: 0,
          padding: 2,
          background: "var(--base)",
          borderRadius: "50%",
        }}
      >
        <AvatarCircle
          src={b?.profile?.avatar_url}
          fallback={initial(b)}
          size={AVATAR_SMALL}
        />
      </div>
    </div>
  );
}

const ThreadItem = memo(({ 
  thread, 
  userId, 
  isOnline,
  index,
  onNavigate,
}: { 
  thread: MessageThread; 
  userId: string;
  isOnline: boolean;
  index: number;
  onNavigate: (id: string) => void;
}) => {
  const otherParticipants = thread.participants?.filter((p: any) => p.user_id !== userId) || [];
  const isGroupChat = otherParticipants.length > 1;
  const displayProfile = otherParticipants[0]?.profile;

  if (!displayProfile) return null;

  const isUnread = (thread.unread_count || 0) > 0;
  const unreadCount = thread.unread_count || 0;

  const displayName = isGroupChat 
    ? otherParticipants
        .slice(0, 2)
        .map(p => p.profile?.full_name?.split(" ")[0] || getDisplayUsername(p.profile?.username))
        .join(", ")
    : (displayProfile.full_name || getDisplayUsername(displayProfile.username));
  const initial = (displayProfile.username || "?")[0]?.toUpperCase() ?? "?";
  const lastMsgIsMine = thread.last_message?.sender_id === userId;

  return (
    <Row
      as="button"
      unread={isUnread}
      onClick={() => onNavigate(thread.id)}
      ariaLabel={`Apri conversazione con ${displayName}`}
    >
      {isGroupChat ? (
        <StackedGroupAvatar participants={otherParticipants} />
      ) : (
        <AvatarCircle
          src={displayProfile.avatar_url}
          fallback={initial}
          size={AVATAR}
          online={isOnline}
          priority={index < 8}
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="row-title truncate" style={{ fontWeight: isUnread ? 600 : 500 }}>
          {displayName}
        </div>
        {thread.last_message ? (
          <div className="row-preview" style={{ color: isUnread ? "var(--txt)" : "var(--txt-2)" }}>
            {lastMsgIsMine && (
              <span style={{ color: "var(--txt-4)", marginRight: 4 }}>Tu:</span>
            )}
            {thread.last_message.content}
          </div>
        ) : (
          <div className="row-preview" style={{ color: "var(--txt-4)", fontStyle: "italic" }}>
            Nessun messaggio
          </div>
        )}
      </div>

      <div className="flex flex-col items-end justify-center gap-1.5 flex-shrink-0" style={{ minWidth: 42 }}>
        {thread.last_message && (
          <span className="row-time">
            {formatCompactTime(new Date(thread.last_message.created_at))}
          </span>
        )}
        {unreadCount > 0 && (
          <span
            className="inline-flex items-center justify-center px-1.5 rounded-full"
            style={{
              minWidth: 19,
              height: 19,
              background: "var(--blue)",
              color: "#fff",
              fontFamily: "var(--mono)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>
    </Row>
  );
});

ThreadItem.displayName = 'ThreadItem';

export const ThreadList = ({ threads, onlineUsers }: ThreadListProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (threads.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col" style={{ paddingTop: 4 }}>
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
            onNavigate={(id) => navigate(`/messages/${id}`)}
          />
        );
      })}
    </div>
  );
};

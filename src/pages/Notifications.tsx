import { useMemo, useState } from "react";
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from "@/hooks/useNotifications";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, isToday, isYesterday, subDays } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Heart,
  MessageCircle,
  UserPlus,
  AtSign,
  Repeat,
  Bell,
  Mail,
  CheckCheck,
  Zap,
} from "lucide-react";
import { Row } from "@/components/shell/Row";

interface Notification {
  id: string;
  type: string;
  read: boolean | null;
  created_at: string | null;
  post_id: string | null;
  comment_id: string | null;
  message_id: string | null;
  actor_id: string;
  actor: {
    id: string;
    full_name: string | null;
    username: string;
    avatar_url: string | null;
  };
  post?: {
    content: string;
  } | null;
  comment?: {
    content: string;
  } | null;
  message?: {
    id: string;
    thread_id: string;
  } | null;
}

// Badge tipo evento (20px) — sovrapposto in basso a destra dell'avatar
const EVENT_BADGES: Record<string, { icon: any; bg: string; fg: string }> = {
  like:               { icon: Heart,        bg: "#E41E52", fg: "#fff" },
  message_like:       { icon: Heart,        bg: "#E41E52", fg: "#fff" },
  comment:            { icon: MessageCircle,bg: "#0A7AFF", fg: "#fff" },
  follow:             { icon: UserPlus,     bg: "#22C55E", fg: "#fff" },
  new_user:           { icon: UserPlus,     bg: "#22C55E", fg: "#fff" },
  mention:            { icon: AtSign,       bg: "#FFD464", fg: "#0E1522" },
  reshare:            { icon: Repeat,       bg: "#A78BFA", fg: "#fff" },
  message:            { icon: Mail,         bg: "#0A7AFF", fg: "#fff" },
  challenge_response: { icon: Zap,          bg: "#E41E52", fg: "#fff" },
};

const EventBadge = ({ type }: { type: string }) => {
  const cfg = EVENT_BADGES[type] ?? { icon: Bell, bg: "rgba(255,255,255,0.14)", fg: "#fff" };
  const Icon = cfg.icon;
  return (
    <span
      className="absolute rounded-full flex items-center justify-center"
      style={{
        width: 20,
        height: 20,
        bottom: -2,
        right: -2,
        background: cfg.bg,
        color: cfg.fg,
        border: "2px solid var(--base)",
        zIndex: 2,
      }}
    >
      <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
    </span>
  );
};

// Filtri notifiche
type NotifFilter = "all" | "mentions" | "comprensioni" | "reactions";

const FILTER_TYPES: Record<NotifFilter, string[]> = {
  all: [],
  mentions: ["mention"],
  comprensioni: ["comment", "reshare", "challenge_response"],
  reactions: ["like", "message_like"],
};

const getNotificationText = (notification: Notification): string => {
  switch (notification.type) {
    case "like":
      return notification.comment_id 
        ? "ha messo like al tuo commento" 
        : "ha messo like al tuo post";
    case "comment":
      return "ha commentato il tuo post";
    case "follow":
      return "ha iniziato a seguirti";
    case "mention":
      return notification.comment_id 
        ? "ti ha menzionato in un commento" 
        : "ti ha menzionato in un post";
    case "reshare":
      return "ha condiviso il tuo post";
    case "message_like":
      return "ha messo like al tuo messaggio";
    case "new_user":
      return "si è registrato su NoParrot";
    case "challenge_response":
      return "ha risposto alla tua challenge";
    default:
      return "ha interagito con te";
  }
};

// Raggruppa notifiche per data
const groupNotificationsByDate = (notifications: Notification[]) => {
  const weekAgo = subDays(new Date(), 7);
  
  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const thisWeek: Notification[] = [];
  const older: Notification[] = [];
  
  notifications.forEach(n => {
    if (!n.created_at) {
      older.push(n);
      return;
    }
    const date = new Date(n.created_at);
    if (isToday(date)) {
      today.push(n);
    } else if (isYesterday(date)) {
      yesterday.push(n);
    } else if (date > weekAgo) {
      thisWeek.push(n);
    } else {
      older.push(n);
    }
  });
  
  return { today, yesterday, thisWeek, older };
};

// Header sezione temporale — eyebrow mono con hairline
const SectionHeader = ({ title }: { title: string }) => (
  <div
    className="flex items-center gap-3"
    style={{ padding: "18px var(--pad) 10px" }}
  >
    <span className="mono-eyebrow">{title}</span>
    <span className="hairline" />
  </div>
);

const NotificationItem = ({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) => {
  const isUnread = !notification.read;

  const previewContent =
    notification.type === "comment" && notification.comment
      ? notification.comment.content
      : notification.post?.content;

  const displayName =
    notification.actor?.full_name ||
    notification.actor?.username?.replace(/@gmail\.com$/, "") ||
    "Utente";

  return (
    <Row as="button" unread={isUnread} onClick={onClick}>
      {/* Avatar 34px con badge evento */}
      <div className="relative flex-shrink-0" style={{ width: 34, height: 34 }}>
        <Avatar className="w-full h-full">
          <AvatarImage src={notification.actor?.avatar_url || undefined} />
          <AvatarFallback
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "var(--txt-2)",
              fontSize: 13,
            }}
          >
            {notification.actor?.full_name?.charAt(0) ||
              notification.actor?.username?.charAt(0) ||
              "?"}
          </AvatarFallback>
        </Avatar>
        <EventBadge type={notification.type} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
        <p
          className="row-title"
          style={{
            fontSize: 13.5,
            lineHeight: 1.35,
            color: isUnread ? "var(--txt)" : "var(--txt-2)",
          }}
        >
          <strong style={{ fontWeight: 600, color: "var(--txt)" }}>{displayName}</strong>{" "}
          <span style={{ color: "var(--txt-3)" }}>
            {getNotificationText(notification)}
          </span>
        </p>

        {previewContent && notification.type !== "follow" && (
          <div
            className="line-clamp-2"
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.045)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              fontSize: 12.5,
              lineHeight: 1.35,
              color: "var(--txt-2)",
              fontStyle: "normal",
            }}
          >
            {previewContent}
          </div>
        )}

        <span
          className="row-time"
          style={{ marginTop: 2, letterSpacing: "0.06em" }}
        >
          {notification.created_at
            ? formatDistanceToNow(new Date(notification.created_at), {
                addSuffix: true,
                locale: it,
              }).toUpperCase()
            : ""}
        </span>
      </div>
    </Row>
  );
};

export const Notifications = () => {
  const navigate = useNavigate();
  const { data: notifications, isLoading } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const [filter, setFilter] = useState<NotifFilter>("all");

  const handleNotificationClick = (notification: Notification) => {
    // Segna come letta
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }

    // Naviga al contenuto
    if (notification.type === "new_user" && notification.actor_id) {
      navigate(`/profile/${notification.actor_id}`);
    } else if (notification.type === "follow" && notification.actor_id) {
      navigate(`/profile/${notification.actor_id}`);
    } else if (notification.type === "challenge_response" && notification.post_id) {
      navigate(`/post/${notification.post_id}`);
    } else if (notification.type === "message_like") {
      const threadId = notification.message?.thread_id;
      if (threadId) {
        const scrollTo = notification.message_id ? `?scrollTo=${notification.message_id}` : "";
        navigate(`/messages/${threadId}${scrollTo}`);
      } else {
        navigate(`/messages`);
      }
    } else if (notification.post_id) {
      const scrollTo = notification.comment_id ? `?scrollTo=${notification.comment_id}` : "";
      navigate(`/post/${notification.post_id}${scrollTo}`);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  // Conta notifiche non lette
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  const filtered = useMemo(() => {
    if (!notifications) return [] as Notification[];
    if (filter === "all") return notifications as Notification[];
    const types = FILTER_TYPES[filter];
    return (notifications as Notification[]).filter((n) => types.includes(n.type));
  }, [notifications, filter]);

  const grouped = filtered.length > 0 ? groupNotificationsByDate(filtered) : null;

  const handleNavTabChange = (tab: string) => {
    if (tab === 'home') navigate('/');
    else if (tab === 'search') navigate('/search');
    else if (tab === 'saved') navigate('/saved');
  };

  const filterConfig: { id: NotifFilter; label: string }[] = [
    { id: "all", label: "Tutte" },
    { id: "mentions", label: "Menzioni" },
    { id: "comprensioni", label: "Comprensioni" },
    { id: "reactions", label: "Reazioni" },
  ];

  const renderSection = (title: string, items?: Notification[]) => {
    if (!items || items.length === 0) return null;
    return (
      <div key={title}>
        <SectionHeader title={title} />
        <div className="flex flex-col">
          {items.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onClick={() => handleNotificationClick(n)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="shell-page">
      <header className="shell-header">
        <div className="flex items-start justify-between gap-3">
          <h1 className="shell-title">Notifiche</h1>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
              className="pill-filter"
              style={{ color: "var(--blue-l)" }}
              aria-label="Segna tutte come lette"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Leggi tutto
            </button>
          )}
        </div>
      </header>

      {/* Filter rail */}
      <div className="filter-rail" style={{ paddingBottom: 12 }}>
        {filterConfig.map((f) => (
          <button
            key={f.id}
            type="button"
            className="pill-filter"
            data-active={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <main>
        {isLoading ? (
          <div className="flex flex-col" style={{ paddingTop: 4 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="row" style={{ pointerEvents: "none" }}>
                <Skeleton className="rounded-full flex-shrink-0" style={{ width: 34, height: 34 }} />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className="h-3.5 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div
              className="rounded-full flex items-center justify-center mb-5"
              style={{
                width: 72,
                height: 72,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Bell className="w-8 h-8" style={{ color: "var(--txt-3)" }} />
            </div>
            <p style={{ color: "var(--txt-2)", fontSize: 14 }}>
              {filter === "all" ? "Nessuna notifica ancora" : "Nulla per questo filtro"}
            </p>
            <p style={{ color: "var(--txt-3)", fontSize: 12.5, marginTop: 4 }}>
              Le tue notifiche appariranno qui
            </p>
          </div>
        ) : (
          <div>
            {renderSection("Oggi", grouped?.today)}
            {renderSection("Ieri", grouped?.yesterday)}
            {renderSection("Questa settimana", grouped?.thisWeek)}
            {renderSection("Precedenti", grouped?.older)}
          </div>
        )}
      </main>

      <BottomNavigation
        activeTab="notifications"
        onTabChange={handleNavTabChange}
      />
    </div>
  );
};

export default Notifications;

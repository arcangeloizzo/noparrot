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
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
}

// Icona per tipo notifica (Lucide, minimal, desaturate)
const getNotificationIcon = (type: string) => {
  const baseClass = "w-4 h-4";
  
  switch (type) {
    case "like":
    case "message_like":
      return <Heart className={cn(baseClass, "text-rose-400/70")} />;
    case "comment":
      return <MessageCircle className={cn(baseClass, "text-blue-400/70")} />;
    case "follow":
      return <UserPlus className={cn(baseClass, "text-emerald-400/70")} />;
    case "mention":
      return <AtSign className={cn(baseClass, "text-amber-400/70")} />;
    case "reshare":
      return <Repeat className={cn(baseClass, "text-violet-400/70")} />;
    case "message":
      return <Mail className={cn(baseClass, "text-sky-400/70")} />;
    case "new_user":
      return <UserPlus className={cn(baseClass, "text-green-500")} />;
    default:
      return <Bell className={cn(baseClass, "text-muted-foreground")} />;
  }
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

// Componente per header sezione temporale
const SectionHeader = ({ title }: { title: string }) => (
  <div className="px-4 py-3 sticky top-16 z-10 bg-background/80 backdrop-blur-sm border-b border-white/5">
    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
      {title}
    </span>
  </div>
);

// Componente singola notifica
const NotificationItem = ({ 
  notification, 
  onClick 
}: { 
  notification: Notification; 
  onClick: () => void;
}) => {
  const isUnread = !notification.read;
  
  // Get preview content
  const previewContent = notification.type === 'comment' && notification.comment
    ? notification.comment.content
    : notification.post?.content;
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 p-4 cursor-pointer transition-all",
        "border-b border-white/5 last:border-b-0",
        isUnread 
          ? "bg-white/[0.03]" 
          : "bg-transparent hover:bg-white/[0.02]"
      )}
    >
      {/* Avatar */}
      <Avatar className="w-10 h-10 flex-shrink-0">
        <AvatarImage src={notification.actor?.avatar_url || undefined} />
        <AvatarFallback className="bg-muted text-muted-foreground text-sm">
          {notification.actor?.full_name?.charAt(0) || notification.actor?.username?.charAt(0) || "?"}
        </AvatarFallback>
      </Avatar>
      
      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Nome e azione */}
            <p className={cn(
              "text-sm leading-relaxed",
              isUnread ? "text-foreground" : "text-muted-foreground"
            )}>
              <span className={cn(
                "font-semibold",
                isUnread ? "text-white" : "text-muted-foreground"
              )}>
                {notification.actor?.full_name || notification.actor?.username?.replace(/@gmail\.com$/, '') || "Utente"}
              </span>
              {" "}
              <span className="text-muted-foreground">
                {getNotificationText(notification)}
              </span>
            </p>
            
            {/* Preview contenuto post/commento */}
            {previewContent && notification.type !== 'follow' && (
              <p className={cn(
                "text-xs mt-1.5 line-clamp-2 rounded px-2 py-1.5",
                "bg-muted/30 text-muted-foreground/80"
              )}>
                "{previewContent}"
              </p>
            )}
          </div>
          
          {/* Blue dot per non letti */}
          {isUnread && (
            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
          )}
        </div>
        
        {/* Footer: tempo e icona */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground/60">
            {notification.created_at 
              ? formatDistanceToNow(new Date(notification.created_at), { 
                  addSuffix: true, 
                  locale: it 
                })
              : ""}
          </span>
          {getNotificationIcon(notification.type)}
        </div>
      </div>
    </div>
  );
};

export const Notifications = () => {
  const navigate = useNavigate();
  const { data: notifications, isLoading } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

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
    } else if (notification.type === "message_like" && notification.message_id) {
      navigate(`/messages`);
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

  // Raggruppa per data
  const grouped = notifications ? groupNotificationsByDate(notifications as Notification[]) : null;

  const handleNavTabChange = (tab: string) => {
    if (tab === 'home') navigate('/');
    else if (tab === 'search') navigate('/search');
    else if (tab === 'saved') navigate('/saved');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Custom Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between h-14 px-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          
          <h1 className="text-lg font-semibold text-foreground">Notifiche</h1>
          
          <div className="w-9" /> {/* Spacer for centering */}
        </div>
      </header>
      
      <main className="pt-14">
        {/* Header con azione "Segna tutte come lette" */}
        {unreadCount > 0 && (
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {unreadCount} non {unreadCount === 1 ? "letta" : "lette"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
              className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-8 px-3"
            >
              <CheckCheck className="w-4 h-4 mr-1.5" />
              Segna tutte come lette
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-0">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-4 border-b border-white/5">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !notifications?.length ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground text-center">
              Nessuna notifica ancora
            </p>
            <p className="text-sm text-muted-foreground/60 text-center mt-1">
              Le tue notifiche appariranno qui
            </p>
          </div>
        ) : (
          <div>
            {/* Oggi */}
            {grouped?.today && grouped.today.length > 0 && (
              <>
                <SectionHeader title="Oggi" />
                {grouped.today.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                  />
                ))}
              </>
            )}
            
            {/* Ieri */}
            {grouped?.yesterday && grouped.yesterday.length > 0 && (
              <>
                <SectionHeader title="Ieri" />
                {grouped.yesterday.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                  />
                ))}
              </>
            )}
            
            {/* Questa settimana */}
            {grouped?.thisWeek && grouped.thisWeek.length > 0 && (
              <>
                <SectionHeader title="Questa settimana" />
                {grouped.thisWeek.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                  />
                ))}
              </>
            )}
            
            {/* Più vecchie */}
            {grouped?.older && grouped.older.length > 0 && (
              <>
                <SectionHeader title="Precedenti" />
                {grouped.older.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                  />
                ))}
              </>
            )}
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

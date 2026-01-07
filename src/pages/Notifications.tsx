import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellIcon, HeartIcon, MessageCircleIcon, UserPlusIcon, AtSignIcon, CheckIcon, ArrowLeftIcon, RepeatIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { ProfileSideSheet } from "@/components/navigation/ProfileSideSheet";

// Colori per tipo di notifica
const notificationStyles = {
  like: {
    gradient: "bg-gradient-to-r from-brand-pink/10 to-transparent",
    border: "border-l-brand-pink",
    iconBg: "bg-brand-pink/10",
    avatarRing: "ring-brand-pink"
  },
  comment: {
    gradient: "bg-gradient-to-r from-primary-blue/10 to-transparent",
    border: "border-l-primary-blue",
    iconBg: "bg-primary-blue/10",
    avatarRing: "ring-primary-blue"
  },
  mention: {
    gradient: "bg-gradient-to-r from-brand-yellow/15 to-transparent",
    border: "border-l-brand-yellow",
    iconBg: "bg-brand-yellow/15",
    avatarRing: "ring-brand-yellow"
  },
  follow: {
    gradient: "bg-gradient-to-r from-trust-high/10 to-transparent",
    border: "border-l-trust-high",
    iconBg: "bg-trust-high/10",
    avatarRing: "ring-trust-high"
  },
  message_like: {
    gradient: "bg-gradient-to-r from-brand-pink/10 to-transparent",
    border: "border-l-brand-pink",
    iconBg: "bg-brand-pink/10",
    avatarRing: "ring-brand-pink"
  },
  reshare: {
    gradient: "bg-gradient-to-r from-trust-high/10 to-transparent",
    border: "border-l-trust-high",
    iconBg: "bg-trust-high/10",
    avatarRing: "ring-trust-high"
  }
};

export const Notifications = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"all" | "mentions">("all");
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const { data: notifications = [], isLoading } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const handleNavTabChange = (tab: string) => {
    if (tab === 'home') navigate('/');
    else if (tab === 'search') navigate('/search');
    else if (tab === 'saved') navigate('/saved');
    else if (tab === 'notifications') navigate('/notifications');
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = "w-5 h-5";
    switch (type) {
      case "like":
      case "message_like":
        return <HeartIcon className={cn(iconClass, "text-brand-pink")} filled />;
      case "comment":
        return <MessageCircleIcon className={cn(iconClass, "text-primary-blue")} />;
      case "follow":
        return <UserPlusIcon className={cn(iconClass, "text-trust-high")} />;
      case "mention":
        return <AtSignIcon className={cn(iconClass, "text-brand-yellow")} />;
      case "reshare":
        return <RepeatIcon className={cn(iconClass, "text-trust-high")} />;
      default:
        return <BellIcon className={cn(iconClass, "text-muted-foreground")} />;
    }
  };

  const getDisplayUsername = (username: string) => {
    // Rimuovi @gmail.com se presente
    return username.replace(/@gmail\.com$/, '');
  };

  const getAvatarContent = (avatarUrl: string | null, name: string, type: string, isUnread: boolean) => {
    const style = notificationStyles[type as keyof typeof notificationStyles] || notificationStyles.comment;
    
    if (avatarUrl) {
      return (
        <div className={cn(
          "relative",
          isUnread && `ring-2 ${style.avatarRing} rounded-full`
        )}>
          <img 
            src={avatarUrl} 
            alt={name}
            className="w-12 h-12 rounded-full object-cover"
          />
          {isUnread && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-primary-blue rounded-full border-2 border-background" />
          )}
        </div>
      );
    }

    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const hashCode = name.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const colors = ['hsl(var(--primary-blue))', 'hsl(var(--brand-pink))', 'hsl(var(--brand-yellow))', 'hsl(var(--trust-high))'];
    const color = colors[Math.abs(hashCode) % colors.length];
    
    return (
      <div className={cn(
        "relative",
        isUnread && `ring-2 ${style.avatarRing} rounded-full`
      )}>
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>
        {isUnread && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-primary-blue rounded-full border-2 border-background" />
        )}
      </div>
    );
  };

  const filteredNotifications = activeTab === "mentions" 
    ? notifications.filter(n => n.type === "mention")
    : notifications;

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }
    
    if (notification.type === 'follow' && notification.actor_id) {
      navigate(`/user/${notification.actor_id}`);
    } else if (notification.type === 'message_like' && notification.message_id) {
      // Navigate to messages (we could enhance to go to specific thread later)
      navigate('/messages');
    } else if (notification.post_id) {
      // Navigate to post, and if there's a comment_id, add anchor to scroll to it
      const url = notification.comment_id 
        ? `/post/${notification.post_id}?scrollTo=${notification.comment_id}`
        : `/post/${notification.post_id}`;
      navigate(url);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationText = (notification: typeof notifications[0]) => {
    switch (notification.type) {
      case 'like':
        return notification.comment_id 
          ? 'ha messo like al tuo commento' 
          : 'ha messo like al tuo post';
      case 'comment':
        return 'ha commentato il tuo post';
      case 'follow':
        return 'ha iniziato a seguirti';
      case 'mention':
        return notification.comment_id 
          ? 'ti ha menzionato in un commento' 
          : 'ti ha menzionato in un post';
      case 'message_like':
        return 'ha messo like al tuo messaggio';
      case 'reshare':
        return 'ha condiviso il tuo post';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mobile-container">
        {/* Header */}
        <div className="sticky top-0 bg-background/80 backdrop-blur-xl z-10 border-b border-border/30">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate(-1)}
                  className="p-2 -ml-2 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <ArrowLeftIcon className="w-5 h-5 text-foreground" />
                </button>
                <div className="p-2 bg-primary-blue/10 rounded-xl">
                  <BellIcon className="w-6 h-6 text-primary-blue" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Notifiche</h1>
                  {unreadCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {unreadCount} non {unreadCount === 1 ? 'letta' : 'lette'}
                    </p>
                  )}
                </div>
              </div>
              
              <button 
                onClick={handleMarkAllAsRead}
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-all",
                  unreadCount > 0 
                    ? "bg-primary-blue/10 text-primary-blue hover:bg-primary-blue/20" 
                    : "text-muted-foreground cursor-not-allowed"
                )}
                disabled={markAllAsRead.isPending || unreadCount === 0}
              >
                <CheckIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Segna lette</span>
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex bg-muted/50 rounded-2xl p-1 gap-1">
              {[
                { id: "all", label: "Tutte", count: notifications.length },
                { id: "mentions", label: "Menzioni", count: notifications.filter(n => n.type === "mention").length },
              ].map(({ id, label, count }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2",
                    activeTab === id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                  {count > 0 && (
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full",
                      activeTab === id 
                        ? "bg-primary-blue/10 text-primary-blue" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-10 h-10 border-2 border-primary-blue/30 border-t-primary-blue rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Caricamento notifiche...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
            <div className="w-20 h-20 bg-muted/50 rounded-3xl flex items-center justify-center mb-4">
              {activeTab === "mentions" ? (
                <AtSignIcon className="w-10 h-10 text-muted-foreground/50" />
              ) : (
                <BellIcon className="w-10 h-10 text-muted-foreground/50" />
              )}
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {activeTab === "mentions" ? "Nessuna menzione" : "Nessuna notifica"}
            </h2>
            <p className="text-muted-foreground text-sm text-center max-w-xs">
              {activeTab === "mentions" 
                ? "Quando qualcuno ti menziona usando @username, lo vedrai qui"
                : "Quando qualcuno interagisce con te, vedrai le notifiche qui"
              }
            </p>
          </div>
        ) : (
          <div className="py-2 space-y-1.5 px-2">
            {filteredNotifications.map((notification, index) => {
              const style = notificationStyles[notification.type as keyof typeof notificationStyles] || notificationStyles.comment;
              
              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "p-3 rounded-2xl transition-all duration-200 cursor-pointer border-l-4 animate-fade-in",
                    style.gradient,
                    style.border,
                    !notification.read ? "shadow-sm" : "opacity-80 hover:opacity-100"
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {getAvatarContent(
                        notification.actor.avatar_url, 
                        notification.actor.full_name,
                        notification.type,
                        !notification.read
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {notification.actor.full_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              @{getDisplayUsername(notification.actor.username)}
                            </span>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {getNotificationText(notification)}
                          </p>

                          {/* Content preview */}
                          {notification.type === 'comment' && notification.comment ? (
                            <p className="text-sm text-foreground/80 mt-1.5 line-clamp-2 bg-background/50 rounded-lg p-2 border border-border/30">
                              "{notification.comment.content}"
                            </p>
                          ) : notification.post && notification.type !== 'follow' ? (
                            <p className="text-sm text-foreground/80 mt-1.5 line-clamp-2 bg-background/50 rounded-lg p-2 border border-border/30">
                              "{notification.post.content}"
                            </p>
                          ) : null}

                          <p className="text-xs text-muted-foreground mt-1.5">
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                              locale: it
                            })}
                          </p>
                        </div>
                        
                        {/* Icon */}
                        <div className={cn(
                          "flex-shrink-0 p-2 rounded-xl",
                          style.iconBg
                        )}>
                          {getNotificationIcon(notification.type)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation 
        activeTab="notifications"
        onTabChange={handleNavTabChange}
        onProfileClick={() => setShowProfileSheet(true)}
      />
      <ProfileSideSheet 
        isOpen={showProfileSheet}
        onClose={() => setShowProfileSheet(false)}
      />
    </div>
  );
};

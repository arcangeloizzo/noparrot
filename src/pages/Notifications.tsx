import { useState } from "react";
import { BellIcon, HeartIcon, MessageCircleIcon, UserPlusIcon, AtSignIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: "like" | "comment" | "follow" | "mention";
  user: string;
  avatar?: string;
  content?: string;
  timestamp: string;
  read: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "like",
    user: "Marco Rossi",
    content: "ha messo mi piace al tuo post sulla sostenibilità",
    timestamp: "2h",
    read: false
  },
  {
    id: "2", 
    type: "comment",
    user: "Anna Verdi",
    content: "ha commentato il tuo post: \"Interessante analisi, condivido la tua visione\"",
    timestamp: "4h",
    read: false
  },
  {
    id: "3",
    type: "follow",
    user: "Luca Bianchi",
    content: "ha iniziato a seguirti",
    timestamp: "6h",
    read: true
  },
  {
    id: "4",
    type: "mention",
    user: "Sofia Neri",
    content: "ti ha menzionato in un commento",
    timestamp: "1g",
    read: true
  },
  {
    id: "5",
    type: "like",
    user: "Andrea Gialli",
    content: "ha messo mi piace al tuo post",
    timestamp: "2g",
    read: true
  }
];

export const Notifications = () => {
  const [activeTab, setActiveTab] = useState<"all" | "mentions">("all");
  const [notifications, setNotifications] = useState(mockNotifications);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "like":
        return <HeartIcon className="w-5 h-5 text-brand-pink" filled />;
      case "comment":
        return <MessageCircleIcon className="w-5 h-5 text-primary-blue" />;
      case "follow":
        return <UserPlusIcon className="w-5 h-5 text-trust-high" />;
      case "mention":
        return <AtSignIcon className="w-5 h-5 text-brand-yellow" />;
      default:
        return <BellIcon className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getAvatarContent = (name: string) => {
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    const hashCode = name.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const colors = ['#0A7AFF', '#E41E52', '#FFD464', '#BFE9E9'];
    const color = colors[Math.abs(hashCode) % colors.length];
    
    return (
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
    );
  };

  const filteredNotifications = activeTab === "mentions" 
    ? notifications.filter(n => n.type === "mention")
    : notifications;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="mobile-container">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border/50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <BellIcon className="w-6 h-6 text-primary-blue" />
                <h1 className="text-xl font-semibold text-foreground">Notifiche</h1>
                {unreadCount > 0 && (
                  <span className="bg-brand-pink text-white text-xs px-2 py-1 rounded-full font-medium">
                    {unreadCount}
                  </span>
                )}
              </div>
              
              <button className="text-sm text-primary-blue font-medium">
                Segna tutto come letto
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex space-x-1 bg-muted rounded-full p-1">
              {[
                { id: "all", label: "Tutte" },
                { id: "mentions", label: "Menzioni" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors",
                    activeTab === id
                      ? "bg-primary-blue text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="divide-y divide-border/50">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => markAsRead(notification.id)}
              className={cn(
                "p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                !notification.read && "bg-primary-blue/5 border-l-4 border-l-primary-blue"
              )}
            >
              <div className="flex space-x-3">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {getAvatarContent(notification.user)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start space-x-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="font-medium text-sm text-foreground">
                          {notification.user}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {notification.timestamp}
                        </span>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-primary-blue rounded-full"></div>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {notification.content}
                      </p>
                    </div>
                    
                    <div className="flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredNotifications.length === 0 && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-3">
              <BellIcon className="w-12 h-12 text-muted-foreground mx-auto" />
              <h2 className="text-lg font-semibold text-foreground">
                {activeTab === "mentions" ? "Nessuna menzione" : "Nessuna notifica"}
              </h2>
              <p className="text-muted-foreground text-sm max-w-sm">
                {activeTab === "mentions" 
                  ? "Non hai ancora ricevuto menzioni"
                  : "Quando qualcuno interagisce con i tuoi post, vedrai le notifiche qui"
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
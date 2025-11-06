import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/ui/logo";
import { useNotifications } from "@/hooks/useNotifications";
import { useState, useEffect } from "react";

export const Header = () => {
  const { data: notifications = [] } = useNotifications();
  
  // Track when user last viewed notifications
  const [lastViewedAt, setLastViewedAt] = useState<string | null>(
    localStorage.getItem('notifications-last-viewed')
  );

  // Count notifications created after last viewed timestamp
  const unreadCount = notifications.filter(n => {
    if (!lastViewedAt) return !n.read;
    return new Date(n.created_at) > new Date(lastViewedAt);
  }).length;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-[600px] mx-auto px-4 h-14 flex items-center justify-center relative">
        {/* Logo centrale */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <Logo variant="extended" size="lg" className="h-10" />
        </div>

        {/* Icona notifiche a destra */}
        <div className="absolute right-0">
          <Link
            to="/notifications"
            className="relative flex items-center justify-center w-12 h-12 rounded-full hover:bg-accent/50 transition-colors"
            onClick={() => {
              const now = new Date().toISOString();
              localStorage.setItem('notifications-last-viewed', now);
              setLastViewedAt(now);
            }}
          >
            <Bell className="h-6 w-6" />
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-semibold rounded-full min-w-[22px] h-6 flex items-center justify-center px-2">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
};

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
    <header className="glass-brand sticky top-0 z-50 safe-top">
      <div className="mobile-container">
        <div className="flex items-center justify-center h-[4.375rem] px-4 relative">
          {/* Logo centrale */}
          <div className="logo-container">
            <Logo variant="extended" size="xl" className="h-14 transition-opacity hover:opacity-80" />
          </div>

          {/* Icona notifiche a destra (posizione assoluta) */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Link
              to="/notifications"
              className="relative flex items-center justify-center w-12 h-12 rounded-full transition-colors"
              style={{
                backgroundColor: 'rgba(71, 85, 105, 0)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(71, 85, 105, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(71, 85, 105, 0)';
              }}
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
      </div>
    </header>
  );
};

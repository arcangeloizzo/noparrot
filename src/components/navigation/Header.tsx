import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { LogoHorizontal } from "@/components/ui/LogoHorizontal";
import { useNotifications } from "@/hooks/useNotifications";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  variant?: "default" | "immersive";
}

export const Header = ({ variant = "default" }: HeaderProps) => {
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

  const isImmersive = variant === "immersive";

  return (
    <header className={cn(
      isImmersive 
        ? "fixed top-0 left-0 right-0 z-50 bg-transparent" 
        : "cognitive-header liquid-glass-navbar border-b-0"
    )}>
      <div className="container flex h-14 max-w-screen-xl items-center justify-center px-4 relative">
        {/* Logo centrale */}
        <LogoHorizontal className="h-7" />

        {/* Icona notifiche a destra (posizione assoluta) */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <Link
            to="/notifications"
            className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-muted/50 transition-colors"
            onClick={() => {
              const now = new Date().toISOString();
              localStorage.setItem('notifications-last-viewed', now);
              setLastViewedAt(now);
            }}
          >
            <Bell className="h-5 w-5 text-foreground icon-glow" />
            {unreadCount > 0 && (
              <div className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-semibold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
};

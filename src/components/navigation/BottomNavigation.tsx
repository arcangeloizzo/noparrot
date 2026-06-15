import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { HomeIcon, SearchIcon } from "@/components/ui/icons";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_PROFILE_AS_HOME } from "@/config/brand";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMessageThreads } from "@/hooks/useMessageThreads";
import { Logo } from "@/components/ui/logo";
import { haptics } from "@/lib/haptics";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onProfileClick?: () => void;
  onHomeRefresh?: () => void;
  onComposerClick?: () => void;
}

export const BottomNavigation = ({ 
  activeTab, 
  onTabChange, 
  onProfileClick, 
  onHomeRefresh,
  onComposerClick 
}: BottomNavigationProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: threads } = useMessageThreads();
  const [showRipple, setShowRipple] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // Force refresh contatore messaggi quando l'app torna in focus (iOS fix)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: ['message-threads'] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [queryClient]);

  // Riflesso liquido che segue il dito via --mx (§9)
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const handler = (e: PointerEvent) => {
      const rect = nav.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      nav.style.setProperty('--mx', `${Math.max(0, Math.min(100, x))}%`);
    };
    nav.addEventListener('pointermove', handler);
    return () => nav.removeEventListener('pointermove', handler);
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("avatar_url, full_name").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Calcola messaggi non letti totali
  const unreadCount = threads?.reduce((sum, thread) => sum + (thread.unread_count || 0), 0) || 0;

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getAvatarContent = () => {
    if (profile?.avatar_url) {
      return <img src={profile.avatar_url} alt="Avatar" className="w-7 h-7 rounded-full object-cover" />;
    }

    return (
      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
        {profile?.full_name ? getInitials(profile.full_name) : "?"}
      </div>
    );
  };

  // Tabs without "saved" - now 4 items + central FAB
  const tabs = [
    { id: "home", icon: HomeIcon, label: "Home" },
    { id: "search", icon: SearchIcon, label: "Search" },
    // FAB goes here in the middle (not a tab)
    { id: "messages", icon: Send, label: "Messages", isLucide: true },
    { id: "profile", icon: null, label: "Profile", isAvatar: true },
  ];

  const handleTabClick = (id: string) => {
    if (id === "profile") {
      navigate("/profile");
    } else if (id === "messages") {
      navigate("/messages");
    } else if (id === "home" && activeTab === "home") {
      onHomeRefresh?.();
    } else {
      onTabChange(id);
    }
  };

  // Central FAB click with liquid ripple effect
  const handleFabClick = useCallback(() => {
    haptics.medium();
    setShowRipple(true);
    
    // Open composer at 300ms (before ripple finishes at 500ms) for snappy feel
    setTimeout(() => {
      onComposerClick?.();
    }, 300);
    
    // Ripple completes at 500ms
    setTimeout(() => {
      setShowRipple(false);
    }, 500);
  }, [onComposerClick]);

  // Split tabs for left and right of FAB
  const leftTabs = tabs.slice(0, 2);  // Home, Search
  const rightTabs = tabs.slice(2);    // Messages, Profile

  return (
    <nav
      ref={navRef}
      className="liquid-nav"
      data-dragging="false"
      role="navigation"
      aria-label="Bottom navigation"
    >
      <div className="nav-ring" aria-hidden="true" />
      <div className="liquid-nav-items">
        {/* Left side tabs */}
        {leftTabs.map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabClick(id)}
            className="liquid-nav-item"
            data-active={activeTab === id}
          >
            {Icon && (
              <Icon className="w-6 h-6" />
            )}
          </button>
        ))}

        {/* Central FAB - rotating conic ring + logo */}
        <button
          onClick={handleFabClick}
          className="liquid-nav-fab"
          aria-label="Crea post"
          data-tutorial="composer"
        >
          <Logo 
            variant="white" 
            className="relative z-10"
          />
          {/* Liquid ripple effect */}
          {showRipple && <span className="fab-liquid-ripple" />}
        </button>

        {/* Right side tabs */}
        {rightTabs.map(({ id, icon: Icon, isAvatar, isLucide }) => (
          <button
            key={id}
            onClick={() => handleTabClick(id)}
            className="liquid-nav-item"
            data-active={activeTab === id}
            data-tutorial={id === "profile" ? "profile-nav" : undefined}
          >
            {isAvatar ? (
              <div className={cn(
                "ring-2 rounded-full",
                activeTab === "profile" ? "ring-foreground" : "ring-border"
              )}>
                {getAvatarContent()}
              </div>
            ) : Icon && (
              <div className="relative">
                <Icon className="w-6 h-6" />
                {id === "messages" && unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-semibold shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
              </div>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};
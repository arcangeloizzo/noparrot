import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HomeIcon, SearchIcon, BookmarkIcon, UserIcon } from "@/components/ui/icons";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_PROFILE_AS_HOME } from "@/config/brand";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMessageThreads } from "@/hooks/useMessageThreads";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onProfileClick?: () => void;
  onHomeRefresh?: () => void;
}

export const BottomNavigation = ({ activeTab, onTabChange, onProfileClick, onHomeRefresh }: BottomNavigationProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: threads } = useMessageThreads();

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

  const tabs = [
    { id: "home", icon: HomeIcon, label: "Home" },
    { id: "search", icon: SearchIcon, label: "Search" },
    { id: "saved", icon: BookmarkIcon, label: "Saved" },
    { id: "messages", icon: Send, label: "Messages", isLucide: true },
    { id: "profile", icon: null, label: "Profile", isAvatar: true },
  ];

  const handleTabClick = (id: string) => {
    if (id === "profile") {
      // Navigate directly to profile page instead of opening drawer
      navigate("/profile");
    } else if (id === "messages") {
      navigate("/messages");
    } else if (id === "home" && activeTab === "home") {
      onHomeRefresh?.();
    } else {
      onTabChange(id);
    }
  };

  return (
    <nav className="liquid-glass-navbar fixed bottom-0 left-0 right-0 z-40">
      <div className="flex justify-around items-center h-14 max-w-[600px] mx-auto">
        {tabs.map(({ id, icon: Icon, label, isAvatar, isLucide }) => (
          <button
            key={id}
            onClick={() => handleTabClick(id)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-4 h-full transition-all duration-200 relative",
              activeTab === id ? "text-white" : "text-gray-400 hover:text-white"
            )}
          >
            {isAvatar ? (
              <div className={cn(
                "ring-2 rounded-full",
                activeTab === "profile" ? "ring-white" : "ring-white/20"
              )}>
                {getAvatarContent()}
              </div>
            ) : Icon && (
              <div className="relative">
                <Icon className={cn(
                  "w-6 h-6 transition-all",
                  activeTab === id ? "icon-glow" : "hover:icon-glow"
                )} />
                {id === "messages" && unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-semibold shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
              </div>
            )}
            {!isAvatar && (
              <span className={cn(
                "text-[10px] font-medium transition-all",
                activeTab === id ? "text-white" : "text-gray-400"
              )}>
                {label}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};
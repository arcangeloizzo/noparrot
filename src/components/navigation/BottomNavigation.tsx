import { useEffect, useState } from "react";
import { HomeIcon, SearchIcon, BookmarkIcon, UserIcon } from "@/components/ui/icons";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_PROFILE_AS_HOME } from "@/config/brand";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMessageThreads } from "@/hooks/useMessageThreads";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onProfileClick?: () => void;
}

export const BottomNavigation = ({ activeTab, onTabChange, onProfileClick }: BottomNavigationProps) => {
  const { user } = useAuth();
  const { data: threads } = useMessageThreads();

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

  return (
    <nav className="cognitive-navbar">
      <div className="flex justify-around items-center h-14 max-w-[600px] mx-auto">
        {tabs.map(({ id, icon: Icon, label, isAvatar, isLucide }) => (
          <button
            key={id}
            onClick={() => {
              if (id === "profile") {
                onProfileClick?.();
              } else if (id === "messages") {
                window.location.href = "/messages";
              } else {
                onTabChange(id);
              }
            }}
            className={cn(
              "cognitive-navbar-item flex flex-col items-center justify-center gap-0.5 px-4 h-full transition-colors relative",
              activeTab === id && "active"
            )}
          >
            {isAvatar ? (
              getAvatarContent()
            ) : Icon && (
              <div className="relative">
                <Icon className="w-6 h-6" />
                {id === "messages" && unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-brand-pink text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-semibold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
              </div>
            )}
            {!isAvatar && <span className="text-[10px] font-medium">{label}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
};
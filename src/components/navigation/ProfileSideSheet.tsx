import { useState } from "react";
import { UserIcon, BookmarkIcon, InfoIcon, SearchIcon, HeartIcon, MessageCircleIcon, EyeOffIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfileSideSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileSideSheet = ({ isOpen, onClose }: ProfileSideSheetProps) => {
  const { user, signOut } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user
  });

  const handleLogout = async () => {
    await signOut();
    toast.success('Logout effettuato!');
    onClose();
  };

  if (!user || !profile) {
    return null;
  }

  const menuItems = [
    { icon: UserIcon, label: "Profilo", id: "profile" },
    { icon: HeartIcon, label: "Premium", id: "premium" },
    { icon: MessageCircleIcon, label: "XChat", badge: "BETA", id: "xchat" },
    { icon: UserIcon, label: "Community", id: "community" },
    { icon: BookmarkIcon, label: "Segnalibri", id: "bookmarks" },
    { icon: SearchIcon, label: "Liste", id: "lists" },
    { icon: InfoIcon, label: "Spazi", id: "spaces" },
    { icon: InfoIcon, label: "Impostazioni e privacy", id: "settings" },
    { icon: InfoIcon, label: "Centro assistenza", id: "help" },
    { icon: EyeOffIcon, label: "Modalità notturna", id: "darkmode" },
  ];

  const getAvatarContent = () => {
    return (
      <img 
        src={profile?.avatar_url || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=faces"} 
        alt="Profilo" 
        className="w-full h-full object-cover"
      />
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Side Sheet */}
      <div className={cn(
        "fixed top-0 bottom-0 right-0 w-80 bg-background border-l border-border z-50",
        "transform transition-transform duration-300 ease-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="h-full overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full overflow-hidden">
                {getAvatarContent()}
              </div>
              <div>
                <div className="font-semibold text-foreground">{profile?.full_name || profile?.username}</div>
                <div className="text-sm text-muted-foreground">@{profile?.username.split('@')[0]}</div>
              </div>
              <button onClick={handleLogout} className="ml-auto text-sm text-destructive hover:underline">Logout</button>
            </div>
            <div className="flex items-center space-x-4 mt-3 text-sm">
              <span><span className="font-semibold">178</span> <span className="text-muted-foreground">Following</span></span>
              <span><span className="font-semibold">93</span> <span className="text-muted-foreground">Follower</span></span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className="w-full flex items-center space-x-4 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
              >
                <item.icon className="w-6 h-6 text-foreground" />
                <span className="text-foreground font-medium">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-primary-blue text-white text-xs px-2 py-1 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
import { UserIcon, InfoIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface ProfileSideSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileSideSheet = ({ isOpen, onClose }: ProfileSideSheetProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    queryFn: async () => {
      if (!user) return { following: 0, followers: 0 };

      const [followingRes, followersRes] = await Promise.all([
        supabase.from("followers").select("id", { count: "exact" }).eq("follower_id", user.id),
        supabase.from("followers").select("id", { count: "exact" }).eq("following_id", user.id),
      ]);

      return {
        following: followingRes.count || 0,
        followers: followersRes.count || 0,
      };
    },
    enabled: !!user,
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
    { icon: UserIcon, label: "Profilo", id: "profile", enabled: true, onClick: () => { navigate("/profile"); onClose(); }, tooltip: undefined },
    { icon: InfoIcon, label: "Impostazioni e privacy", id: "settings", enabled: true, onClick: () => { navigate("/settings/privacy"); onClose(); }, tooltip: undefined },
  ];

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
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
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-lg font-semibold text-primary-foreground">
                  {getInitials(profile?.full_name || "")}
                </div>
              )}
              <div className="flex-1">
                <div className="font-semibold text-foreground">{profile?.full_name}</div>
                <div className="text-sm text-muted-foreground">@{profile?.username}</div>
              </div>
            </div>
            <div className="flex items-center space-x-4 mt-3 text-sm">
              <span><span className="font-semibold">{stats?.following || 0}</span> <span className="text-muted-foreground">Following</span></span>
              <span><span className="font-semibold">{stats?.followers || 0}</span> <span className="text-muted-foreground">Follower</span></span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                disabled={!item.enabled}
                className={cn(
                  "w-full flex items-center space-x-4 px-4 py-3 text-left",
                  item.enabled ? "hover:bg-muted/50 cursor-pointer" : "opacity-50 cursor-not-allowed"
                )}
                title={item.tooltip}
              >
                <item.icon className="w-6 h-6" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Logout */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
            <Button onClick={handleLogout} variant="ghost" className="w-full text-destructive hover:text-destructive">
              Logout
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
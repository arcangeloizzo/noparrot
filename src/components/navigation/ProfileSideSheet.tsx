import { UserIcon, InfoIcon, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
    { icon: UserIcon, label: "Profilo", description: "Il tuo viaggio di comprensione, in un'unica vista.", id: "profile", enabled: true, onClick: () => { navigate("/profile"); onClose(); } },
    { icon: BookOpen, label: "Percorsi completati", description: "Accedi ai contenuti che hai elaborato.", id: "completed", enabled: true, onClick: () => { navigate("/completed-paths"); onClose(); } },
    { icon: InfoIcon, label: "Impostazioni e privacy", id: "settings", enabled: true, onClick: () => { navigate("/settings/privacy"); onClose(); } },
  ];

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-md z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Side Sheet */}
      <div className={cn(
        "fixed top-0 bottom-0 right-0 w-80 bg-background/20 backdrop-blur-3xl border-l border-white/20 z-50",
        "shadow-[0_0_40px_rgba(0,0,0,0.3)]",
        "transform transition-transform duration-300 ease-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="h-full overflow-y-auto pb-24">
          {/* Header con testo introduttivo */}
          <div className="p-6 border-b border-border">
            
            <div className="flex items-center space-x-3 mb-4">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Avatar" 
                  className="w-16 h-16 rounded-full object-cover shadow-[0_0_20px_rgba(10,122,255,0.1)]" 
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-xl font-semibold text-primary-foreground shadow-[0_0_20px_rgba(10,122,255,0.1)]">
                  {getInitials(profile?.full_name || "")}
                </div>
              )}
              <div className="flex-1">
                <div className="text-lg font-semibold text-foreground">{profile?.full_name}</div>
                <div className="text-sm text-muted-foreground">@{profile?.username}</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 text-sm">
              <span><span className="font-semibold">{stats?.following || 0}</span> <span className="text-muted-foreground">Connessioni</span></span>
              <span><span className="font-semibold">{stats?.followers || 0}</span> <span className="text-muted-foreground">Ascoltatori</span></span>
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
                  "w-full flex items-start gap-3 px-6 py-4 text-left transition-colors",
                  item.enabled ? "hover:bg-muted/50 cursor-pointer" : "opacity-50 cursor-not-allowed"
                )}
              >
                <item.icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium mb-0.5">{item.label}</div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <Separator className="mx-4 my-2" />

          {/* Logout */}
          <div className="px-4 py-2">
            <Button 
              onClick={handleLogout} 
              variant="ghost" 
              className="w-full text-[#E76A6A] hover:text-[#E76A6A] hover:bg-[#E76A6A]/10"
            >
              Esci dall'app
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
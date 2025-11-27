import { UserIcon, InfoIcon, Compass } from "lucide-react";
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
    { icon: UserIcon, label: "Profilo", id: "profile", enabled: true, onClick: () => { navigate("/profile"); onClose(); } },
    { icon: Compass, label: "Percorso Cognitivo", id: "cognitive", enabled: true, onClick: () => { navigate("/profile#nebulosa"); onClose(); } },
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
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Side Sheet */}
      <div className={cn(
        "fixed top-0 bottom-0 right-0 w-80 bg-background border-l border-border z-50",
        "transform transition-transform duration-300 ease-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="h-full overflow-y-auto pb-24">
          {/* Header con testo introduttivo */}
          <div className="p-6 border-b border-border">
            <p className="text-xs text-[#9AA3AB] mb-4 tracking-wide uppercase">Il tuo spazio di quiete</p>
            
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

          {/* Blocco Mappa Cognitiva */}
          <div 
            className="p-4 mx-4 my-4 bg-[#141A1E] rounded-xl border border-[#2AD2C9]/20 cursor-pointer hover:bg-[#141A1E]/80 transition-colors"
            onClick={() => { navigate("/profile#nebulosa"); onClose(); }}
          >
            <div className="flex items-start space-x-3">
              <Compass className="w-5 h-5 text-[#2AD2C9] mt-0.5" />
              <div>
                <div className="font-medium text-foreground mb-1">Mappa Cognitiva</div>
                <div className="text-xs text-muted-foreground">Entra nel tuo viaggio di comprensione</div>
              </div>
            </div>
          </div>

          <Separator className="mx-4 my-2" />

          {/* Menu Items */}
          <div className="py-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                disabled={!item.enabled}
                className={cn(
                  "w-full flex items-center space-x-4 px-6 py-4 text-left transition-colors",
                  item.enabled ? "hover:bg-muted/50 cursor-pointer" : "opacity-50 cursor-not-allowed"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
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
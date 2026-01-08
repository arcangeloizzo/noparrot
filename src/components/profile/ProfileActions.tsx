import { useNavigate } from "react-router-dom";
import { Settings, Shield, LogOut, ChevronRight, UserPen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export const ProfileActions = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const actions = [
    {
      id: 'edit-profile',
      icon: UserPen,
      label: 'Modifica profilo',
      description: 'Nome, bio, avatar',
      onClick: () => navigate('/profile/edit'),
    },
    {
      id: 'settings',
      icon: Settings,
      label: 'Impostazioni',
      description: 'Preferenze e account',
      onClick: () => navigate('/settings/privacy'),
    },
    {
      id: 'privacy',
      icon: Shield,
      label: 'Privacy',
      description: 'Dati e consensi',
      onClick: () => navigate('/settings/privacy'),
    },
  ];

  return (
    <div className="space-y-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={action.onClick}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200",
              "bg-[#141A1E] border border-border/20 hover:border-border/40",
              "hover:bg-[#1A2127] active:scale-[0.99]"
            )}
          >
            <div className="flex-shrink-0 p-2 rounded-lg bg-white/5">
              <Icon className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        );
      })}

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className={cn(
          "w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 mt-4",
          "bg-red-500/10 border border-red-500/20 hover:border-red-500/40",
          "hover:bg-red-500/20 active:scale-[0.99]"
        )}
      >
        <div className="flex-shrink-0 p-2 rounded-lg bg-red-500/10">
          <LogOut className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-red-400">Esci</p>
          <p className="text-xs text-red-400/60">Disconnetti account</p>
        </div>
      </button>
    </div>
  );
};
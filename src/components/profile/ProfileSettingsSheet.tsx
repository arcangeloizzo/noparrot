import { useNavigate } from "react-router-dom";
import { Settings, LogOut, UserPen, XIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ProfileSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileSettingsSheet = ({ open, onOpenChange }: ProfileSettingsSheetProps) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    onOpenChange(false);
    await signOut();
    navigate("/auth");
  };

  const handleAction = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const actions = [
    {
      id: 'edit-profile',
      icon: UserPen,
      label: 'Modifica profilo',
      description: 'Nome, avatar, micro-tagline',
      onClick: () => handleAction('/profile/edit'),
    },
    {
      id: 'settings-privacy',
      icon: Settings,
      label: 'Impostazioni e Privacy',
      description: 'Preferenze, account e dati',
      onClick: () => handleAction('/settings/privacy'),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="bg-[#0E1419] border-t border-white/10 rounded-t-3xl px-4 pb-8 pt-4"
      >
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-foreground text-lg">Impostazioni</SheetTitle>
            <button 
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <XIcon className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </SheetHeader>

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
      </SheetContent>
    </Sheet>
  );
};

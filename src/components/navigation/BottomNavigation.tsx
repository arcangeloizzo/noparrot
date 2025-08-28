import { HomeIcon, SearchIcon, BookmarkIcon, BellIcon, UserIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { NAV_PROFILE_AS_HOME } from "@/config/brand";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onProfileClick?: () => void;
}

export const BottomNavigation = ({ activeTab, onTabChange, onProfileClick }: BottomNavigationProps) => {
  const getAvatarContent = () => {
    const initials = "AI";
    return (
      <div className="w-7 h-7 bg-primary-blue rounded-full flex items-center justify-center text-white text-xs font-semibold">
        {initials}
      </div>
    );
  };

  const tabs = [
    { id: "home", icon: HomeIcon, label: "Home" },
    { id: "search", icon: SearchIcon, label: "Search" },
    { id: "saved", icon: BookmarkIcon, label: "Saved" },
    { id: "notifications", icon: BellIcon, label: "Notifications" },
    { id: "profile", icon: null, label: "", isAvatar: true },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border/50 safe-bottom z-40">
      <div className="mobile-container">
        <div className="flex items-center justify-around py-2">
          {tabs.map(({ id, icon: Icon, label, isAvatar }) => (
            <button
              key={id}
              onClick={() => {
                if (id === "profile") {
                  onProfileClick?.();
                } else {
                  onTabChange(id);
                }
              }}
              className={cn(
                "flex flex-col items-center space-y-1 p-2 transition-colors relative",
                activeTab === id && !isAvatar
                  ? "text-primary-blue" 
                  : isAvatar ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isAvatar ? (
                <div className={cn(
                  "relative",
                  activeTab === "profile" && "ring-2 ring-primary-blue rounded-full"
                )}>
                  {getAvatarContent()}
                </div>
              ) : (
                Icon && <Icon className={cn("w-7 h-7", activeTab === id && "text-primary-blue")} />
              )}
              {label && <span className="text-xs font-medium">{label}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
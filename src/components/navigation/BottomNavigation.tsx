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
      <div className="w-6 h-6 bg-primary-blue rounded-full flex items-center justify-center text-white text-xs font-semibold">
        {initials}
      </div>
    );
  };

  const tabs = NAV_PROFILE_AS_HOME ? [
    { id: "home", icon: null, label: "Home", isAvatar: true },
    { id: "search", icon: SearchIcon, label: "Search" },
    { id: "saved", icon: BookmarkIcon, label: "Saved" },
    { id: "notifications", icon: BellIcon, label: "Notifications" },
    { id: "profile", icon: UserIcon, label: "Profile" },
  ] : [
    { id: "home", icon: HomeIcon, label: "Home" },
    { id: "search", icon: SearchIcon, label: "Search" },
    { id: "saved", icon: BookmarkIcon, label: "Saved" },
    { id: "notifications", icon: BellIcon, label: "Notifications" },
    { id: "profile", icon: UserIcon, label: "Profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border/50 safe-bottom">
      <div className="mobile-container">
        <div className="flex items-center justify-around py-2">
          {tabs.map(({ id, icon: Icon, label, isAvatar }) => (
            <button
              key={id}
              onClick={() => {
                if (NAV_PROFILE_AS_HOME && id === "home") {
                  onProfileClick?.();
                } else {
                  onTabChange(id);
                }
              }}
              className={cn(
                "flex flex-col items-center space-y-1 p-2 transition-colors relative",
                activeTab === id 
                  ? "text-primary-blue" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isAvatar ? (
                <div className={cn(
                  "relative",
                  activeTab === id && "ring-2 ring-primary-blue rounded-full"
                )}>
                  {getAvatarContent()}
                </div>
              ) : (
                Icon && <Icon className="w-6 h-6" />
              )}
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
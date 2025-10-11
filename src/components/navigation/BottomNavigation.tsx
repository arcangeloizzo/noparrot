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
      <div className="w-8 h-8 bg-primary-blue rounded-full flex items-center justify-center text-white text-sm font-semibold">
        {initials}
      </div>
    );
  };

  const tabs = [
    { id: "home", icon: HomeIcon, label: "Home" },
    { id: "search", icon: SearchIcon, label: "Search" },
    { id: "saved", icon: BookmarkIcon, label: "Saved" },
    { id: "notifications", icon: BellIcon, label: "Notifications" },
    { id: "profile", icon: null, label: "Profile", isAvatar: true },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full z-40 border-t border-border bg-background">
      <div className="flex justify-around items-center h-14 max-w-[600px] mx-auto">
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
              "flex flex-col items-center justify-center gap-0.5 px-4 h-full transition-colors",
              activeTab === id 
                ? "text-foreground" 
                : "text-muted-foreground"
            )}
          >
            {isAvatar ? (
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                <div className="text-xs font-semibold text-primary-foreground">
                  AI
                </div>
              </div>
            ) : (
              Icon && <Icon className="w-6 h-6" />
            )}
            {!isAvatar && <span className="text-[10px] font-medium">{label}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
};
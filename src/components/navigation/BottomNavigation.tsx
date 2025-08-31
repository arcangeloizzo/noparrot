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
    <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md z-40">
      {/* Floating glass background */}
      <div className="mx-4 mb-4 glass-card rounded-2xl px-4 py-3 shadow-2xl">
        <div className="flex justify-around items-center">
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
                "relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl nav-morph",
                activeTab === id 
                  ? "text-primary" 
                  : "text-muted-foreground"
              )}
            >
              {/* Active indicator */}
              {activeTab === id && (
                <div className="absolute inset-0 bg-primary/10 rounded-xl glow-primary animate-pulse" />
              )}
              
              {isAvatar ? (
                <div className={cn("w-5 h-5 rounded-full bg-primary flex items-center justify-center relative z-10 transition-all duration-300",
                  activeTab === "profile" ? "scale-110 glow-primary" : "hover:scale-105"
                )}>
                  <div className="text-xs font-bold text-primary-foreground">
                    AI
                  </div>
                </div>
              ) : (
                Icon && <Icon className={cn("w-5 h-5 relative z-10 transition-all duration-300", 
                  activeTab === id ? "scale-110 text-primary" : "hover:scale-105"
                )} />
              )}
              <span className="text-xs font-medium relative z-10">{label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Safe area padding */}
      <div className="pb-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
    </nav>
  );
};
import { Link } from "react-router-dom";
import { Bell, MessageCircle, Moon, Sun } from "lucide-react";
import { LogoHorizontal } from "@/components/ui/LogoHorizontal";
import { SearchBar } from "@/components/search/SearchBar";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { useState } from "react";

export const DesktopHeader = () => {
    const { user } = useAuth();
    const { data: profile } = useCurrentProfile();
    const { theme, setTheme } = useTheme();
    const { data: notifications = [] } = useNotifications();

    // Track unread notifications (same logic as mobile header)
    const [lastViewedAt, setLastViewedAt] = useState<string | null>(
        localStorage.getItem('notifications-last-viewed')
    );

    const unreadCount = notifications.filter(n => {
        if (!lastViewedAt) return !n.read;
        return new Date(n.created_at) > new Date(lastViewedAt);
    }).length;

    const handleNotificationsClick = () => {
        const now = new Date().toISOString();
        localStorage.setItem('notifications-last-viewed', now);
        setLastViewedAt(now);
    };

    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
    };

    const getInitials = (name: string) => {
        return name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
    };

    return (
        <header className="fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md border-b border-border z-50 px-6">
            <div className="max-w-[1400px] mx-auto h-full flex items-center justify-between gap-8">
                {/* Left: Logo & Profile */}
                <div className="flex items-center gap-6 w-[300px]">
                    <Link to="/" className="flex-shrink-0">
                        <LogoHorizontal className="h-8" />
                    </Link>

                    {user && (
                        <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <Avatar className="h-8 w-8 border border-border">
                                <AvatarImage src={profile?.avatar_url || ""} />
                                <AvatarFallback>{getInitials(profile?.full_name || "")}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium hidden xl:block truncate max-w-[120px]">
                                {profile?.full_name || "Utente"}
                            </span>
                        </Link>
                    )}
                </div>

                {/* Center: Search Bar */}
                <div className="flex-1 max-w-[600px]">
                    {/* Wrapping SearchBar to constrain width and center it */}
                    <div className="relative">
                        <SearchBar />
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center justify-end gap-2 w-[300px]">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleTheme}
                        className="text-muted-foreground hover:text-foreground"
                        title="Cambia tema"
                    >
                        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </Button>

                    <Link to="/messages">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground relative">
                            <MessageCircle className="h-5 w-5" />
                        </Button>
                    </Link>

                    <Link to="/notifications" onClick={handleNotificationsClick}>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground relative">
                            <Bell className="h-5 w-5" />
                            {unreadCount > 0 && (
                                <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-background" />
                            )}
                        </Button>
                    </Link>
                </div>
            </div>
        </header>
    );
};

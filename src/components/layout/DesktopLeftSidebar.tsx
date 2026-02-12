import { Link, useLocation } from "react-router-dom";
import { Home, User, Bookmark, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CognitiveNebulaCanvas } from "@/components/profile/CognitiveNebulaCanvas";
import { useCognitiveDensity } from "@/hooks/useCognitiveDensity";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export const DesktopLeftSidebar = () => {
    const location = useLocation();
    const { user } = useAuth();
    const { data: cognitiveDensity } = useCognitiveDensity(user?.id || "");

    const menuItems = [
        { icon: Home, label: "Home", path: "/" },
        { icon: User, label: "Diario", path: "/profile" },
        { icon: Bookmark, label: "Salvati", path: "/saved" },
        { icon: CheckCircle, label: "Completati", path: "/completed-paths" },
    ];

    return (
        <div className="flex flex-col gap-8">
            {/* Menu Navigazione */}
            <nav className="flex flex-col gap-2">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link key={item.path} to={item.path}>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start gap-3 h-12 text-lg font-medium",
                                    isActive ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <item.icon className={cn("w-6 h-6", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
                                {item.label}
                            </Button>
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t border-border/50 my-2" />

            {/* Nebulosa Cognitiva */}
            <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-4 px-2 uppercase tracking-wider">
                    La tua Nebulosa
                </h3>
                <div className="w-full h-[300px] relative">
                    <CognitiveNebulaCanvas data={cognitiveDensity || {}} />
                </div>
            </div>
        </div>
    );
};

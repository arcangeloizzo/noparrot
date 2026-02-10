import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { X, UserPlus, UserCheck } from "lucide-react";
import { getDisplayUsername } from "@/lib/utils";

interface ConnectionsSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    defaultTab?: "followers" | "following";
}

interface UserProfilePreview {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
}

export const ConnectionsSheet = ({
    open,
    onOpenChange,
    userId,
    defaultTab = "following"
}: ConnectionsSheetProps) => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<"followers" | "following">(defaultTab);

    // Update active tab when defaultTab changes or sheet opens
    useEffect(() => {
        if (open) {
            setActiveTab(defaultTab);
        }
    }, [open, defaultTab]);

    const { data: followers = [], isLoading: loadingFollowers } = useQuery({
        queryKey: ["connections-followers", userId],
        queryFn: async () => {
            // 1. Fetch relations first
            const { data: relations, error: relError } = await supabase
                .from("followers")
                .select("follower_id")
                .eq("following_id", userId);

            if (relError) throw relError;
            if (!relations?.length) return [];

            const ids = relations.map(r => r.follower_id);

            // 2. Fetch public profiles
            const { data: profiles, error: profError } = await supabase
                .from("public_profiles")
                .select("id, username, full_name, avatar_url, bio")
                .in("id", ids);

            if (profError) throw profError;
            return profiles as UserProfilePreview[];
        },
        enabled: open && !!userId,
    });

    const { data: following = [], isLoading: loadingFollowing } = useQuery({
        queryKey: ["connections-following", userId],
        queryFn: async () => {
            // 1. Fetch relations first
            const { data: relations, error: relError } = await supabase
                .from("followers")
                .select("following_id")
                .eq("follower_id", userId);

            if (relError) throw relError;
            if (!relations?.length) return [];

            const ids = relations.map(r => r.following_id);

            // 2. Fetch public profiles
            const { data: profiles, error: profError } = await supabase
                .from("public_profiles")
                .select("id, username, full_name, avatar_url, bio")
                .in("id", ids);

            if (profError) throw profError;
            return profiles as UserProfilePreview[];
        },
        enabled: open && !!userId,
    });

    const handleUserClick = (targetUserId: string) => {
        onOpenChange(false);
        if (targetUserId === currentUser?.id) {
            navigate("/profile");
        } else {
            navigate(`/profile/${targetUserId}`);
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const UserList = ({ users, emptyMessage }: { users: UserProfilePreview[], emptyMessage: string }) => {
        if (users.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <p className="text-sm">{emptyMessage}</p>
                </div>
            );
        }

        return (
            <div className="space-y-4 py-4">
                {users.map((user) => (
                    <div
                        key={user.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => handleUserClick(user.id)}
                    >
                        <Avatar className="h-10 w-10 border border-white/10">
                            <AvatarImage src={user.avatar_url || ""} />
                            <AvatarFallback className="bg-primary/20 text-primary">
                                {getInitials(getDisplayUsername(user.username))}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">
                                {user.full_name || getDisplayUsername(user.username)}
                            </p>
                            {user.username && (
                                <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                            )}
                        </div>
                        {/* Future: Add Follow/Unfollow button here */}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="h-[85vh] rounded-t-3xl px-0 pb-0 bg-background border-t border-white/10 outline-none">
                <DrawerHeader className="px-6 pb-2 pt-4 border-b border-white/5 space-y-4 text-left">
                    <div className="flex items-center justify-between">
                        <DrawerTitle className="text-lg font-bold">Connessioni</DrawerTitle>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="p-2 rounded-full hover:bg-muted/50 transition-colors"
                        >
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>

                    <Tabs
                        value={activeTab}
                        onValueChange={(val) => setActiveTab(val as "followers" | "following")}
                        className="w-full"
                    >
                        <TabsList className="w-full grid grid-cols-2 bg-muted/50 p-1 rounded-xl">
                            <TabsTrigger
                                value="following"
                                className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Seguiti <span className="ml-1.5 text-xs text-muted-foreground">{following?.length || 0}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="followers"
                                className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Follower <span className="ml-1.5 text-xs text-muted-foreground">{followers?.length || 0}</span>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </DrawerHeader>

                <ScrollArea className="h-full px-6 bg-background">
                    {activeTab === "following" ? (
                        loadingFollowing ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">Caricamento...</div>
                        ) : (
                            <UserList users={following} emptyMessage="Nessuna persona seguita ancora." />
                        )
                    ) : (
                        loadingFollowers ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">Caricamento...</div>
                        ) : (
                            <UserList users={followers} emptyMessage="Nessun follower ancora." />
                        )
                    )}
                    <div className="h-20" /> {/* Bottom padding for safe area */}
                </ScrollArea>
            </DrawerContent>
        </Drawer>
    );
};

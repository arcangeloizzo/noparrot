import * as React from "react";
import { useNavigate } from "react-router-dom";
import { cn, getDisplayUsername } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { usePollVoters } from "@/hooks/usePollVoters";
import { useIsFollowing, useToggleFollow } from "@/hooks/useFollow";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface PollVotersSheetProps {
  isOpen: boolean;
  onClose: () => void;
  pollId: string | undefined;
}

const ALL_TAB = 'all';

const FollowButton = ({ userId }: { userId: string }) => {
  const { user: currentUser } = useAuth();
  const { data: isFollowing } = useIsFollowing(currentUser?.id, userId);
  const toggleFollow = useToggleFollow();

  if (!currentUser || currentUser.id === userId) return null;

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      className="h-7 text-xs rounded-full px-3"
      onClick={(e) => {
        e.stopPropagation();
        toggleFollow.mutate({ followerId: currentUser.id, followingId: userId });
      }}
    >
      {isFollowing ? "Seguiti" : "Segui"}
    </Button>
  );
};

export const PollVotersSheet = ({ isOpen, onClose, pollId }: PollVotersSheetProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<string>(ALL_TAB);
  const { data, isLoading } = usePollVoters(pollId, isOpen);

  const optionIds = data ? Object.keys(data.optionLabels) : [];

  const displayedVoters = React.useMemo(() => {
    if (!data) return [];
    if (activeTab === ALL_TAB) return data.voters;
    return data.byOption[activeTab] || [];
  }, [data, activeTab]);

  const handleUserClick = (username: string) => {
    onClose();
    navigate(`/user/${username}`);
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[70vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-base font-semibold">
            Chi ha votato ({data?.totalCount ?? 0})
          </DrawerTitle>
        </DrawerHeader>

        {/* Tabs per opzione */}
        {optionIds.length > 1 && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4">
            <TabsList className="w-full h-auto flex-wrap gap-1 bg-transparent p-0 justify-start">
              <TabsTrigger
                value={ALL_TAB}
                className="text-xs rounded-full px-3 py-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Tutti ({data?.totalCount ?? 0})
              </TabsTrigger>
              {optionIds.map(optId => {
                const count = data?.byOption[optId]?.length ?? 0;
                if (count === 0) return null;
                return (
                  <TabsTrigger
                    key={optId}
                    value={optId}
                    className="text-xs rounded-full px-3 py-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    {data?.optionLabels[optId]} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        )}

        <ScrollArea className="flex-1 px-4 pb-4 mt-2" style={{ maxHeight: '50vh' }}>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayedVoters.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nessun voto</p>
          ) : (
            <div className="space-y-1">
              {displayedVoters.map((voter) => {
                if (!voter.user) return null;
                const u = voter.user;
                const displayName = getDisplayUsername(u.username, u.full_name);
                return (
                  <div
                    key={voter.id}
                    className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => handleUserClick(u.username)}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={u.avatar_url || ''} />
                      <AvatarFallback className="text-xs bg-muted">
                        {displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      {activeTab === ALL_TAB && (
                        <p className="text-xs text-muted-foreground truncate">
                          {voter.option_label}
                        </p>
                      )}
                    </div>
                    <FollowButton userId={u.id} />
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
};

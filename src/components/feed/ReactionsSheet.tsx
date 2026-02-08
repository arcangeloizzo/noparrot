import * as React from "react";
import { useNavigate } from "react-router-dom";
import { cn, getDisplayUsername } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { usePostReactors } from "@/hooks/usePostReactors";
import { useFocusReactors } from "@/hooks/useFocusReactors";
import { useIsFollowing, useToggleFollow } from "@/hooks/useFollow";
import { useAuth } from "@/contexts/AuthContext";
import { reactionToEmoji, type ReactionType, REACTIONS } from "@/components/ui/reaction-picker";
import { Skeleton } from "@/components/ui/skeleton";

interface ReactionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** For post reactions */
  postId?: string;
  /** For focus (editorial) reactions */
  focusId?: string;
  focusType?: 'daily' | 'interest';
}

interface ReactorUser {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface ReactorItem {
  id: string;
  user_id: string;
  reaction_type: ReactionType;
  user: ReactorUser | null;
}

const ALL_TAB = 'all';
const REACTION_TABS: (ReactionType | typeof ALL_TAB)[] = [ALL_TAB, 'heart', 'laugh', 'wow', 'sad', 'fire'];

/**
 * ReactionsSheet - Instagram-style bottom drawer showing who reacted
 * Features horizontal emoji filter tabs and user list with follow buttons
 */
export const ReactionsSheet = ({
  isOpen,
  onClose,
  postId,
  focusId,
  focusType = 'daily',
}: ReactionsSheetProps) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = React.useState<string>(ALL_TAB);

  // Determine which hook to use
  const isPost = !!postId;
  const isFocus = !!focusId;

  // Post reactors
  const { data: postData, isLoading: postLoading } = usePostReactors(
    postId, 
    isOpen && isPost
  );

  // Focus reactors
  const { data: focusData, isLoading: focusLoading } = useFocusReactors(
    focusId,
    focusType,
    isOpen && isFocus
  );

  const data = isPost ? postData : focusData;
  const isLoading = isPost ? postLoading : focusLoading;

  // Reset to 'all' when sheet opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(ALL_TAB);
    }
  }, [isOpen]);

  // Get filtered reactors based on active tab
  const filteredReactors: ReactorItem[] = React.useMemo(() => {
    if (!data) return [];
    if (activeTab === ALL_TAB) {
      return data.reactors as ReactorItem[];
    }
    return (data.byType[activeTab as ReactionType] || []) as ReactorItem[];
  }, [data, activeTab]);

  const handleUserClick = (userId: string) => {
    onClose();
    navigate(`/profile/${userId}`);
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh] bg-[#0E141A]">
        <DrawerHeader className="pb-2 border-b border-white/10">
          <DrawerTitle className="text-lg font-bold text-center">
            Mi piace
          </DrawerTitle>
        </DrawerHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tabs Header - Horizontal scroll with emoji + count */}
          <TabsList className="flex justify-start gap-2 px-4 py-3 overflow-x-auto no-scrollbar bg-transparent border-b border-white/5">
            {REACTION_TABS.map((tab) => {
              const count = tab === ALL_TAB 
                ? data?.totalCount || 0 
                : data?.counts[tab as ReactionType] || 0;
              
              // Hide tabs with 0 count (except "All" if there are reactions)
              if (tab !== ALL_TAB && count === 0) return null;
              if (tab === ALL_TAB && count === 0) return null;

              return (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap",
                    "data-[state=active]:bg-primary/15 data-[state=active]:text-primary",
                    "data-[state=inactive]:bg-white/5 data-[state=inactive]:text-muted-foreground",
                    "transition-colors"
                  )}
                >
                  {tab === ALL_TAB ? (
                    <span>Tutti</span>
                  ) : (
                    <span className="text-base">{reactionToEmoji(tab as ReactionType)}</span>
                  )}
                  <span className="text-xs opacity-80">{count}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Content - User list */}
          <TabsContent value={activeTab} className="mt-0 px-0">
            <ScrollArea className="h-[55vh] px-4">
              {isLoading ? (
                <div className="space-y-3 py-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-11 h-11 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-8 w-20 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : filteredReactors.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  Nessuna reazione
                </div>
              ) : (
                <div className="space-y-1 py-3">
                  {filteredReactors.map((reactor) => (
                    <ReactorRow
                      key={reactor.id}
                      reactor={reactor}
                      currentUserId={currentUser?.id}
                      onClick={() => reactor.user && handleUserClick(reactor.user.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
};

// Individual reactor row - Instagram style with follow button
interface ReactorRowProps {
  reactor: ReactorItem;
  currentUserId?: string;
  onClick: () => void;
}

const ReactorRow = ({ reactor, currentUserId, onClick }: ReactorRowProps) => {
  if (!reactor.user) return null;

  const { user } = reactor;
  const isCurrentUser = currentUserId === user.id;

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Avatar - Clean, no emoji badge */}
      <button onClick={onClick} className="shrink-0">
        <Avatar className="w-11 h-11">
          <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || user.username} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {(user.full_name || user.username).slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </button>

      {/* User info */}
      <button onClick={onClick} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-foreground truncate">
          {user.full_name || getDisplayUsername(user.username)}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          @{getDisplayUsername(user.username)}
        </p>
      </button>

      {/* Follow button - Only show for other users */}
      {!isCurrentUser && (
        <FollowButton targetUserId={user.id} />
      )}
    </div>
  );
};

// Separate component for follow button to use hooks properly
const FollowButton = ({ targetUserId }: { targetUserId: string }) => {
  const { data: isFollowing, isLoading } = useIsFollowing(targetUserId);
  const toggleFollow = useToggleFollow();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFollow.mutate({ 
      targetUserId, 
      isCurrentlyFollowing: !!isFollowing 
    });
  };

  if (isLoading) {
    return <Skeleton className="h-8 w-20 rounded-full" />;
  }

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      className={cn(
        "rounded-full h-8 px-4 text-xs font-semibold shrink-0",
        isFollowing 
          ? "border-white/20 text-foreground hover:bg-white/5" 
          : "bg-primary hover:bg-primary/90"
      )}
      onClick={handleClick}
      disabled={toggleFollow.isPending}
    >
      {isFollowing ? "Segui già" : "Segui"}
    </Button>
  );
};

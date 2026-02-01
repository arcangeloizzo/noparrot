import * as React from "react";
import { useNavigate } from "react-router-dom";
import { cn, getDisplayUsername } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { usePostReactors } from "@/hooks/usePostReactors";
import { useFocusReactors } from "@/hooks/useFocusReactors";
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
 * ReactionsSheet - Bottom drawer showing who reacted with filtering tabs
 */
export const ReactionsSheet = ({
  isOpen,
  onClose,
  postId,
  focusId,
  focusType = 'daily',
}: ReactionsSheetProps) => {
  const navigate = useNavigate();
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
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-lg font-bold">
            Reazioni {data && `(${data.totalCount})`}
          </DrawerTitle>
        </DrawerHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tabs Header - Horizontal scroll */}
          <TabsList className="flex justify-start gap-1 px-4 pb-2 overflow-x-auto no-scrollbar bg-transparent">
            {REACTION_TABS.map((tab) => {
              const count = tab === ALL_TAB 
                ? data?.totalCount || 0 
                : data?.counts[tab as ReactionType] || 0;
              
              if (tab !== ALL_TAB && count === 0) return null;

              return (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className={cn(
                    "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm",
                    "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
                    "data-[state=inactive]:bg-white/5 data-[state=inactive]:text-muted-foreground"
                  )}
                >
                  {tab === ALL_TAB ? (
                    <span>Tutti</span>
                  ) : (
                    <span>{reactionToEmoji(tab as ReactionType)}</span>
                  )}
                  <span className="text-xs opacity-70">({count})</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Content */}
          <TabsContent value={activeTab} className="mt-0 px-0">
            <ScrollArea className="h-[50vh] px-4">
              {isLoading ? (
                <div className="space-y-3 py-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredReactors.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Nessuna reazione
                </div>
              ) : (
                <div className="space-y-1 py-2">
                  {filteredReactors.map((reactor) => (
                    <ReactorRow
                      key={reactor.id}
                      reactor={reactor}
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

// Individual reactor row
interface ReactorRowProps {
  reactor: ReactorItem;
  onClick: () => void;
}

const ReactorRow = ({ reactor, onClick }: ReactorRowProps) => {
  if (!reactor.user) return null;

  const { user, reaction_type } = reactor;
  const displayName = user.full_name || getDisplayUsername(user.username);
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
    >
      {/* Avatar with reaction badge */}
      <div className="relative">
        <Avatar className="w-10 h-10">
          <AvatarImage src={user.avatar_url || undefined} alt={displayName} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        {/* Reaction badge on bottom-right corner */}
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 flex items-center justify-center text-xs bg-popover border border-border rounded-full shadow-sm">
          {reactionToEmoji(reaction_type)}
        </span>
      </div>

      {/* User info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {displayName}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          @{getDisplayUsername(user.username)}
        </p>
      </div>
    </button>
  );
};

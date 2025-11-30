import { useState, useEffect, useRef, useMemo } from "react";
import { Logo } from "@/components/ui/logo";
import { Header } from "@/components/navigation/Header";
import { FeedCard } from "@/components/feed/FeedCardAdapt";
import { ExternalFocusCard } from "@/components/feed/ExternalFocusCard";
import { FocusDetailSheet } from "@/components/feed/FocusDetailSheet";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { ProfileSideSheet } from "@/components/navigation/ProfileSideSheet";
import { FloatingActionButton } from "@/components/fab/FloatingActionButton";
import { ComposerModal } from "@/components/composer/ComposerModal";
import { SimilarContentOverlay } from "@/components/feed/SimilarContentOverlay";
import { CGProvider } from "@/lib/comprehension-gate";
import { Search } from "./Search";
import { Saved } from "./Saved";
import { Notifications } from "./Notifications";
import { usePosts, useToggleReaction, Post } from "@/hooks/usePosts";
import { useToast } from "@/hooks/use-toast";
import { NotificationPermissionBanner } from "@/components/notifications/NotificationPermissionBanner";
import { useQueryClient } from "@tanstack/react-query";
import { useDailyFocus } from "@/hooks/useDailyFocus";
import { useInterestFocus } from "@/hooks/useInterestFocus";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const Feed = () => {
  const { user } = useAuth();
  const { data: dbPosts = [], isLoading, refetch } = usePosts();
  const toggleReaction = useToggleReaction();
  const queryClient = useQueryClient();
  
  // Fetch real Daily Focus
  const { data: dailyFocus, isLoading: loadingDaily } = useDailyFocus();
  
  // Get user's profile to extract cognitive density
  const [userCategories, setUserCategories] = useState<string[]>([]);
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('cognitive_density')
        .eq('id', user.id)
        .single();
      
      if (profile?.cognitive_density) {
        // Estrai top 2 categorie
        const categories = Object.entries(profile.cognitive_density as Record<string, number>)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 2)
          .map(([cat]) => cat);
        
        setUserCategories(categories);
      }
    };
    
    fetchUserProfile();
  }, [user?.id]);
  
  // Fetch real Interest Focus based on user categories
  const { data: interestFocus = [], isLoading: loadingInterest } = useInterestFocus(userCategories);
  const [activeNavTab, setActiveNavTab] = useState("home");
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showSimilarContent, setShowSimilarContent] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [quotedPost, setQuotedPost] = useState<Post | null>(null);
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const pullDistance = useRef<number>(0);
  const [focusDetailOpen, setFocusDetailOpen] = useState(false);
  const [selectedFocus, setSelectedFocus] = useState<any>(null);
  const [focusCommentsOpen, setFocusCommentsOpen] = useState(false);
  const [selectedFocusForComments, setSelectedFocusForComments] = useState<any>(null);

  // Build mixed feed: Daily Focus + User Posts + Interest Focus every 6 posts
  const mixedFeed = useMemo(() => {
    const items: Array<{ type: 'daily' | 'interest' | 'post'; data: any; id: string }> = [];
    
    // 1. Daily Focus always at top (REAL DATA)
    if (dailyFocus) {
      items.push({ type: 'daily', data: dailyFocus, id: dailyFocus.id });
    }
    
    // 2. Intercalate user posts with Interest Focus every 6
    let interestIndex = 0;
    dbPosts.forEach((post, index) => {
      items.push({ type: 'post', data: post, id: post.id });
      
      // Insert Interest Focus after every 6 posts (REAL DATA)
      if ((index + 1) % 6 === 0 && interestFocus[interestIndex]) {
        items.push({ 
          type: 'interest', 
          data: interestFocus[interestIndex],
          id: interestFocus[interestIndex].id
        });
        interestIndex++;
      }
    });
    
    return items;
  }, [dailyFocus, dbPosts, interestFocus]);


  useEffect(() => {
    if (showSimilarContent) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showSimilarContent]);

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current && scrollContainerRef.current && scrollContainerRef.current.scrollTop === 0) {
      const currentY = e.touches[0].clientY;
      pullDistance.current = currentY - touchStartY.current;
      
      if (pullDistance.current > 0 && pullDistance.current < 100) {
        // Visual feedback could be added here
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance.current > 80 && !isRefreshing) {
      // Refresh dei dati
      setIsRefreshing(true);
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      await refetch();
      setIsRefreshing(false);
    }
    touchStartY.current = 0;
    pullDistance.current = 0;
  };

  const handleCreatePost = () => {
    setQuotedPost(null);
    setShowComposer(true);
  };

  const handleQuoteShare = (post: Post & { _originalSources?: string[] }) => {
    setQuotedPost(post);
    setShowComposer(true);
  };
  const handleLogoClick = () => {
    localStorage.removeItem("noparrot-onboarded");
    window.location.reload();
  };

  const handleShowSimilarContent = (post: Post) => {
    setSelectedPost(post);
    setShowSimilarContent(true);
  };

  const handleCloseSimilarContent = () => {
    setShowSimilarContent(false);
    setSelectedPost(null);
  };

  const handleRemovePost = (postId: string) => {
    // Post removed via database
  };

  // Navigation pages
  if (activeNavTab === "search") {
    return (
      <div className="pb-24">
        <Search />
        <BottomNavigation 
          activeTab={activeNavTab} 
          onTabChange={setActiveNavTab}
          onProfileClick={() => setShowProfileSheet(true)}
        />
        <ProfileSideSheet 
          isOpen={showProfileSheet}
          onClose={() => setShowProfileSheet(false)}
        />
      </div>
    );
  }

  if (activeNavTab === "saved") {
    return (
      <div className="pb-24">
        <Saved />
        <BottomNavigation 
          activeTab={activeNavTab} 
          onTabChange={setActiveNavTab}
          onProfileClick={() => setShowProfileSheet(true)}
        />
        <ProfileSideSheet 
          isOpen={showProfileSheet}
          onClose={() => setShowProfileSheet(false)}
        />
      </div>
    );
  }

  if (activeNavTab === "notifications") {
    return (
      <div className="pb-24">
        <Notifications />
        <BottomNavigation 
          activeTab={activeNavTab} 
          onTabChange={setActiveNavTab}
          onProfileClick={() => setShowProfileSheet(true)}
        />
        <ProfileSideSheet 
          isOpen={showProfileSheet}
          onClose={() => setShowProfileSheet(false)}
        />
      </div>
    );
  }

  if (isLoading || loadingDaily) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-muted-foreground">Caricamento feed...</div>
      </div>
    );
  }

  return (
    <div 
      ref={scrollContainerRef}
      className="min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom))] overflow-y-auto"
      style={{ background: 'transparent' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <NotificationPermissionBanner />
      <Header />
      
      {isRefreshing && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      )}
      
      <div className="mobile-container max-w-[600px] mx-auto px-4">

        {/* Mixed Feed - Daily Focus + User Posts + Interest Focus */}
        <div className="flex flex-col gap-6 py-4">
          {mixedFeed.map((item) => {
            if (item.type === 'daily' || item.type === 'interest') {
              return (
                <ExternalFocusCard
                  key={item.id}
                  type={item.type}
                  category={item.data.category}
                  title={item.data.title}
                  summary={item.data.summary}
                  sources={item.data.sources}
                  trustScore={item.data.trust_score}
                  reactions={item.data.reactions}
                  onClick={() => {
                    setSelectedFocus(item);
                    setFocusDetailOpen(true);
                  }}
                  onLike={() => {
                    toast({
                      title: "Like",
                      description: "Funzionalità like su Focus Card (da implementare)"
                    });
                  }}
                  onComment={() => {
                    toast({
                      title: "Commenti",
                      description: "Apertura commenti Focus Card (da implementare)"
                    });
                  }}
                  onShare={() => {
                    toast({
                      title: "Condividi",
                      description: "Conta rilanci nel feed (da implementare)"
                    });
                  }}
                />
              );
            } else {
              return (
                <FeedCard
                  key={item.id}
                  post={item.data}
                  onRemove={() => handleRemovePost(item.data.id)}
                  onQuoteShare={handleQuoteShare}
                />
              );
            }
          })}
          {mixedFeed.length === 1 && (
            <div className="py-12 text-center text-muted-foreground">
              <p>Nessun post disponibile.</p>
              <p className="text-sm mt-2">Crea il primo post!</p>
            </div>
          )}
        </div>
      </div>

      <FloatingActionButton onClick={handleCreatePost} />
      <BottomNavigation 
        activeTab={activeNavTab} 
        onTabChange={(tab) => {
          if (tab === 'home' && activeNavTab === 'home') {
            // Già sul feed, clicca home → scroll to top
            scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            setActiveNavTab(tab);
          }
        }}
        onProfileClick={() => setShowProfileSheet(true)}
      />

      <ProfileSideSheet 
        isOpen={showProfileSheet}
        onClose={() => setShowProfileSheet(false)}
      />

      <ComposerModal
        isOpen={showComposer}
        onClose={() => {
          setShowComposer(false);
          setQuotedPost(null);
        }}
        quotedPost={quotedPost}
      />

      {selectedPost && (
        <SimilarContentOverlay
          isOpen={showSimilarContent}
          onClose={handleCloseSimilarContent}
          originalPost={selectedPost}
        />
      )}

      {selectedFocus && (
        <FocusDetailSheet
          open={focusDetailOpen}
          onOpenChange={setFocusDetailOpen}
          type={selectedFocus.type === 'daily' ? 'daily' : 'interest'}
          category={selectedFocus.data.category}
          title={selectedFocus.data.title}
          summary={selectedFocus.data.summary}
          sources={selectedFocus.data.sources}
        />
      )}

      {selectedFocusForComments && (
        <CommentsSheet
          open={focusCommentsOpen}
          onOpenChange={setFocusCommentsOpen}
          postId={selectedFocusForComments.data.id}
          postContent={selectedFocusForComments.data.title}
          postAuthor={{
            username: selectedFocusForComments.type === 'daily' ? 'Daily Focus' : 'Interest Focus',
            full_name: selectedFocusForComments.type === 'daily' ? 'Daily Focus' : `Focus ${selectedFocusForComments.data.category}`,
            avatar_url: null
          }}
          onCommentAdded={() => {
            // Refresh comments if needed
          }}
        />
      )}
    </div>
  );
};

const FeedWithGate = () => (
  <CGProvider policy={{ minReadSeconds: 10, minScrollRatio: 0.8 }}>
    <Feed />
  </CGProvider>
);

export default FeedWithGate;
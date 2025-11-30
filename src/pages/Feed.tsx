import { useState, useEffect, useRef } from "react";
import { Logo } from "@/components/ui/logo";
import { Header } from "@/components/navigation/Header";
import { FeedCard } from "@/components/feed/FeedCardAdapt";
import { ExternalFocusCard } from "@/components/feed/ExternalFocusCard";
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

// Mock Data per External Focus Cards
const MOCK_DAILY_FOCUS = {
  type: 'daily' as const,
  title: "La Fusione Nucleare: Svolta Storica al MIT",
  summary: "I ricercatori del MIT hanno raggiunto un traguardo senza precedenti nella fusione nucleare, aprendo la strada a una fonte di energia pulita e illimitata. L'esperimento ha dimostrato per la prima volta un guadagno netto di energia.",
  sources: [
    { icon: "📰", name: "NYT" },
    { icon: "📄", name: "Repubblica" },
    { icon: "🔬", name: "Nature" }
  ],
  trustScore: 'Alto' as const,
  reactions: { likes: 234, comments: 89, shares: 45 }
};

const MOCK_INTEREST_FOCUS = [
  {
    type: 'interest' as const,
    category: 'TECH',
    title: "Apple annuncia il nuovo chip M4: rivoluzione nelle prestazioni",
    summary: "Il nuovo processore M4 di Apple promette prestazioni rivoluzionarie con un'efficienza energetica senza precedenti. Gli sviluppatori potranno sfruttare capacità AI integrate direttamente nel silicio.",
    sources: [
      { icon: "🍎", name: "Apple" },
      { icon: "📱", name: "The Verge" },
      { icon: "💻", name: "Ars Technica" }
    ],
    trustScore: 'Alto' as const,
    reactions: { likes: 156, comments: 34, shares: 28 }
  },
  {
    type: 'interest' as const,
    category: 'ARTE',
    title: "Biennale di Venezia: le opere più discusse dell'edizione 2024",
    summary: "La community dell'arte contemporanea dibatte sulle installazioni più controverse della Biennale. Temi come AI, sostenibilità e identità digitale dominano le discussioni.",
    sources: [
      { icon: "🎨", name: "Artforum" },
      { icon: "🖼️", name: "Biennale" },
      { icon: "📰", name: "Il Sole 24 Ore" }
    ],
    trustScore: 'Alto' as const,
    reactions: { likes: 98, comments: 23, shares: 15 }
  }
];

export const Feed = () => {
  const { data: dbPosts = [], isLoading, refetch } = usePosts();
  const toggleReaction = useToggleReaction();
  const queryClient = useQueryClient();
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

  // Build mixed feed: Daily Focus + User Posts + Interest Focus every 6 posts
  const buildMixedFeed = () => {
    const items: Array<{ type: 'daily' | 'interest' | 'post'; data: any; id: string }> = [];
    
    // 1. Daily Focus always at top
    items.push({ type: 'daily', data: MOCK_DAILY_FOCUS, id: 'daily-focus' });
    
    // 2. Intercalate user posts with Interest Focus every 6
    dbPosts.forEach((post, index) => {
      items.push({ type: 'post', data: post, id: post.id });
      
      // Insert Interest Focus after every 6 posts
      const interestIndex = Math.floor(index / 6);
      if ((index + 1) % 6 === 0 && MOCK_INTEREST_FOCUS[interestIndex]) {
        items.push({ 
          type: 'interest', 
          data: MOCK_INTEREST_FOCUS[interestIndex],
          id: `interest-focus-${interestIndex}`
        });
      }
    });
    
    return items;
  };

  const mixedFeed = buildMixedFeed();


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

  if (isLoading) {
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
                  trustScore={item.data.trustScore}
                  reactions={item.data.reactions}
                  onClick={() => {
                    toast({
                      title: "External Focus View",
                      description: "Visualizzazione dettagliata della notizia (da implementare)"
                    });
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
    </div>
  );
};

const FeedWithGate = () => (
  <CGProvider policy={{ minReadSeconds: 10, minScrollRatio: 0.8 }}>
    <Feed />
  </CGProvider>
);

export default FeedWithGate;
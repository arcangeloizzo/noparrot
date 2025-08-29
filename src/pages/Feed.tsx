import { useState, useEffect } from "react";
import { Logo } from "@/components/ui/logo";
import { FeedToggle } from "@/components/feed/FeedToggle";
import { FeedCard } from "@/components/feed/FeedCard";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { ProfileSideSheet } from "@/components/navigation/ProfileSideSheet";
import { FloatingActionButton } from "@/components/fab/FloatingActionButton";
import { ComposerModal } from "@/components/composer/ComposerModal";
import { SimilarContentOverlay } from "@/components/feed/SimilarContentOverlay";
import { ArticleReader } from "@/components/feed/ArticleReader";
import { ComprehensionTest } from "@/components/feed/ComprehensionTest";
import { Search } from "./Search";
import { Saved } from "./Saved";
import { Notifications } from "./Notifications";
import { mockPosts, generateMorePosts, MockPost } from "@/data/mockData";

export const Feed = () => {
  const [activeTab, setActiveTab] = useState<"following" | "foryou">("following");
  const [activeNavTab, setActiveNavTab] = useState("home");
  const [posts, setPosts] = useState(mockPosts);
  const [scrollY, setScrollY] = useState(0);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showSimilarContent, setShowSimilarContent] = useState(false);
  const [selectedPost, setSelectedPost] = useState<MockPost | null>(null);
  const [showReader, setShowReader] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [readerPost, setReaderPost] = useState<MockPost | null>(null);
  const [testPost, setTestPost] = useState<MockPost | null>(null);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    // Add more posts for demo
    setPosts([...mockPosts, ...generateMorePosts(15)]);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      // Force re-render to recalculate card positions
      forceUpdate({});
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Block background scroll when any modal is open
  useEffect(() => {
    if (showSimilarContent || showReader || showTest) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showSimilarContent, showReader, showTest]);

  // Improved card stack animation with precise positioning
  const getCardProps = (index: number) => {
    // Use actual card element for precise positioning if available
    const cardElement = document.querySelector(`[data-card-index="${index}"]`);
    
    if (!cardElement) {
      // Fallback for initial render
      return { scale: 0.9, offset: 0 };
    }
    
    const rect = cardElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Define a smaller, more precise transition zone (center 40% of viewport)
    const focusZoneTop = viewportHeight * 0.3;
    const focusZoneBottom = viewportHeight * 0.7;
    const focusZoneCenter = viewportHeight * 0.5;
    
    const cardCenter = rect.top + rect.height / 2;
    
    let scale = 0.85;
    let offset = 0;
    
    if (cardCenter >= focusZoneTop && cardCenter <= focusZoneBottom) {
      // Card is in focus zone - create smooth transition
      const distanceFromCenter = Math.abs(cardCenter - focusZoneCenter);
      const maxDistance = (focusZoneBottom - focusZoneTop) / 2;
      const progress = 1 - (distanceFromCenter / maxDistance);
      
      // Smooth scale transition: cards in center get scale 1.0, edges get 0.9
      scale = 0.9 + (progress * 0.1);
      
      // Add subtle vertical offset for stack effect
      const offsetMultiplier = cardCenter > focusZoneCenter ? 1 : -1;
      offset = (1 - progress) * 8 * offsetMultiplier;
    } else if (cardCenter < focusZoneTop) {
      // Cards above focus zone - slightly larger
      scale = 0.95;
      offset = -4;
    } else {
      // Cards below focus zone - smaller with downward offset
      scale = 0.85;
      offset = 6;
    }
    
    return { scale, offset };
  };

  const handleCreatePost = () => {
    setShowComposer(true);
  };

  const handleLogoClick = () => {
    localStorage.removeItem("noparrot-onboarded");
    window.location.reload();
  };

  const handleShowSimilarContent = (post: MockPost) => {
    setSelectedPost(post);
    setShowSimilarContent(true);
  };

  const handleCloseSimilarContent = () => {
    setShowSimilarContent(false);
    setSelectedPost(null);
  };

  const handleRemovePost = (postId: string) => {
    setPosts(prev => prev.filter(post => post.id !== postId));
  };

  const handleOpenReader = (post: MockPost) => {
    setReaderPost(post);
    setShowReader(true);
  };

  const handleCloseReader = () => {
    setShowReader(false);
    setReaderPost(null);
  };

  const handleProceedToTest = () => {
    setShowReader(false);
    setTestPost(readerPost);
    setShowTest(true);
  };

  const handleCloseTest = () => {
    setShowTest(false);
    setTestPost(null);
    setReaderPost(null);
  };

  const handleCompleteTest = () => {
    setShowTest(false);
    setTestPost(null);
    setReaderPost(null);
  };

  // Render different pages based on active tab
  if (activeNavTab === "search") {
    return (
      <div className="pb-20">
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
      <div className="pb-20">
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
      <div className="pb-20">
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mobile-container">
        {/* Header */}
        <div className="sticky top-0 bg-background z-50 border-b border-border/50">
          <div className="px-4 py-3 space-y-4">
            <div className="flex justify-center">
              <img 
                src="/lovable-uploads/7cf90ae6-5f2e-4bec-a1fb-c810cd8a1bb1.png"
                alt="NOPARROT"
                className="h-8 w-auto cursor-pointer hover:opacity-80 transition-opacity"
                onClick={handleLogoClick}
              />
            </div>
            <div className="flex justify-center">
              <FeedToggle activeTab={activeTab} onTabChange={setActiveTab} />
            </div>
          </div>
        </div>

        {/* Feed Cards */}
        <div className="pt-6 space-y-2 relative">
          {posts.map((post, index) => {
            const { scale, offset } = getCardProps(index);
            
            return (
              <div
                key={post.id}
                data-card-index={index}
                style={{
                  transform: `scale(${scale}) translateY(${offset}px)`,
                  transition: 'transform 0.2s ease-out',
                  transformOrigin: 'center center'
                }}
              >
                <FeedCard
                  post={post}
                  onLongPress={() => handleShowSimilarContent(post)}
                  onSwipeLeft={() => handleOpenReader(post)}
                  onSwipeRight={() => handleRemovePost(post.id)}
                />
              </div>
            );
          })}
        </div>

        {/* Load More Trigger */}
        <div className="p-8 text-center">
          <div className="text-sm text-muted-foreground">
            Scroll to load more posts...
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton onClick={handleCreatePost} />

      {/* Bottom Navigation */}
      <BottomNavigation 
        activeTab={activeNavTab} 
        onTabChange={setActiveNavTab}
        onProfileClick={() => setShowProfileSheet(true)}
      />

      {/* Profile Side Sheet */}
      <ProfileSideSheet 
        isOpen={showProfileSheet}
        onClose={() => setShowProfileSheet(false)}
      />

      {/* Composer Modal */}
      <ComposerModal
        isOpen={showComposer}
        onClose={() => setShowComposer(false)}
      />

      {/* Similar Content Overlay */}
      {selectedPost && (
        <SimilarContentOverlay
          isOpen={showSimilarContent}
          onClose={handleCloseSimilarContent}
          originalPost={selectedPost}
        />
      )}

      {/* Article Reader Modal */}
      {readerPost && (
        <ArticleReader
          post={readerPost}
          isOpen={showReader}
          onClose={handleCloseReader}
          onProceedToTest={handleProceedToTest}
        />
      )}

      {/* Comprehension Test Modal */}
      {testPost && (
        <ComprehensionTest
          post={testPost}
          isOpen={showTest}
          onClose={handleCloseTest}
          onComplete={handleCompleteTest}
        />
      )}
    </div>
  );
};
import { useState, useEffect } from "react";
import { Logo } from "@/components/ui/logo";
import { FeedToggle } from "@/components/feed/FeedToggle";
import { FeedCard } from "@/components/feed/FeedCard";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { ProfileSideSheet } from "@/components/navigation/ProfileSideSheet";
import { FloatingActionButton } from "@/components/fab/FloatingActionButton";
import { ComposerModal } from "@/components/composer/ComposerModal";
import { Search } from "./Search";
import { Saved } from "./Saved";
import { Notifications } from "./Notifications";
import { mockPosts, generateMorePosts } from "@/data/mockData";

export const Feed = () => {
  const [activeTab, setActiveTab] = useState<"following" | "foryou">("following");
  const [activeNavTab, setActiveNavTab] = useState("home");
  const [posts, setPosts] = useState(mockPosts);
  const [scrollY, setScrollY] = useState(0);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  useEffect(() => {
    // Add more posts for demo
    setPosts([...mockPosts, ...generateMorePosts(15)]);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate card scales and offsets based on scroll position
  const getCardProps = (index: number) => {
    const cardHeight = 300; // Card height including margin
    const cardSpacing = 16; // Space between cards
    const cardTotalHeight = cardHeight + cardSpacing;
    
    // Calculate which card should be "in focus" (closest to viewport center)
    const viewportCenter = scrollY + window.innerHeight * 0.4; // Focus point
    const cardCenter = index * cardTotalHeight + cardHeight / 2;
    
    // Calculate the relative position from the focused card
    const distanceFromFocus = (cardCenter - viewportCenter) / cardTotalHeight;
    const relativePosition = Math.round(distanceFromFocus);
    
    // Progressive scaling based on position relative to focused card
    let scale = 1.0;
    let translateY = 0;
    
    if (relativePosition === 0) {
      // Main card (in focus)
      scale = 1.0;
      translateY = 0;
    } else if (relativePosition === 1) {
      // First card below
      scale = 0.92;
      translateY = -8;
    } else if (relativePosition === 2) {
      // Second card below
      scale = 0.85;
      translateY = -16;
    } else if (relativePosition >= 3) {
      // Third+ cards below
      scale = 0.80;
      translateY = -24;
    } else if (relativePosition === -1) {
      // First card above
      scale = 0.95;
      translateY = 4;
    } else {
      // Cards far above
      scale = 0.90;
      translateY = 8;
    }
    
    return { scale, offset: translateY };
  };

  const handleCreatePost = () => {
    setShowComposer(true);
  };

  const handleLogoClick = () => {
    localStorage.removeItem("noparrot-onboarded");
    window.location.reload();
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
        <div className="sticky top-0 bg-background/80 backdrop-blur-sm z-50 border-b border-border/50">
          <div className="px-4 py-3 space-y-4">
            <div className="flex justify-center">
              <img 
                src="/lovable-uploads/4e2d113e-0ba6-45d9-8efe-2022612746f6.png"
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
        <div className="pt-6 space-y-4 relative">
          {posts.map((post, index) => {
            const { scale, offset } = getCardProps(index);
            
            return (
              <FeedCard
                key={post.id}
                post={post}
                scale={scale}
                offset={offset}
              />
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
    </div>
  );
};
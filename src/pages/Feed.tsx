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

  // Calculate card scales and offsets based on scroll
  const getCardProps = (index: number) => {
    const cardHeight = 280; // Approximate card height
    const scrollOffset = scrollY;
    const cardTop = index * (cardHeight + 16); // Card height + margin
    const viewportCenter = scrollOffset + window.innerHeight * 0.6; // Focus area moved lower
    
    // Distance from center of viewport
    const distanceFromCenter = Math.abs(cardTop - viewportCenter);
    
    // Only apply scaling when card is in viewport (expanded range)
    if (distanceFromCenter <= cardHeight * 1.5) {
      const normalizedDistance = distanceFromCenter / (cardHeight * 1.5);
      const scale = 1 - (normalizedDistance * 0.04); // More visible scaling (4% difference)
      const offset = normalizedDistance * 6; // Slightly more offset for visible effect
      return { scale: Math.max(0.96, scale), offset: Math.min(6, offset) };
    }
    
    return { scale: 0.96, offset: 6 }; // Off-screen cards with more noticeable shrinkage
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
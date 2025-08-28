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
    const viewportCenter = scrollOffset + window.innerHeight / 3; // Focus area
    
    // Distance from center of viewport
    const distanceFromCenter = Math.abs(cardTop - viewportCenter);
    
    // Only apply scaling when card is in viewport
    if (distanceFromCenter <= cardHeight) {
      const normalizedDistance = distanceFromCenter / cardHeight;
      const scale = 1 - (normalizedDistance * 0.12); // Scale from 1 to 0.88
      const offset = normalizedDistance * 16; // Offset from 0 to 16px
      return { scale: Math.max(0.88, scale), offset: Math.min(16, offset) };
    }
    
    return { scale: 0.88, offset: 16 }; // Off-screen cards
  };

  const handleCreatePost = () => {
    setShowComposer(true);
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
              <Logo variant="extended" size="md" />
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
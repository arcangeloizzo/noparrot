import { useState, useEffect } from "react";
import { Logo } from "@/components/ui/logo";
import { FeedToggle } from "@/components/feed/FeedToggle";
import { FeedCard } from "@/components/feed/FeedCard";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { ProfileSideSheet } from "@/components/navigation/ProfileSideSheet";
import { FloatingActionButton } from "@/components/fab/FloatingActionButton";
import { mockPosts, generateMorePosts } from "@/data/mockData";

export const Feed = () => {
  const [activeTab, setActiveTab] = useState<"following" | "foryou">("following");
  const [activeNavTab, setActiveNavTab] = useState("home");
  const [posts, setPosts] = useState(mockPosts);
  const [scrollY, setScrollY] = useState(0);
  const [showProfileSheet, setShowProfileSheet] = useState(false);

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
    const cardHeight = 200; // Approximate card height
    const baseScale = [1, 0.94, 0.88];
    const baseOffset = [0, 8, 16];
    
    if (index < 3) {
      return {
        scale: baseScale[index] || 0.8,
        offset: baseOffset[index] || 24
      };
    }
    
    return { scale: 0.8, offset: 24 };
  };

  const handleCreatePost = () => {
    // TODO: Open compose modal
    console.log("Open compose modal");
  };

  if (activeNavTab !== "home") {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="mobile-container">
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-foreground capitalize">
                {activeNavTab}
              </h2>
              <p className="text-muted-foreground">
                This section is coming soon...
              </p>
            </div>
          </div>
        </div>
        <BottomNavigation activeTab={activeNavTab} onTabChange={setActiveNavTab} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mobile-container">
        {/* Header */}
        <div className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b border-border/50">
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
    </div>
  );
};
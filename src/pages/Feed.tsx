import { useState, useEffect } from "react";
import { Logo } from "@/components/ui/logo";
import { FeedToggle } from "@/components/feed/FeedToggle";
import { FeedCard } from "@/components/feed/FeedCard";
import { ArticleReader } from "@/components/feed/ArticleReader";
import { PostTestActionsModal } from "@/components/feed/PostTestActionsModal";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { ProfileSideSheet } from "@/components/navigation/ProfileSideSheet";
import { FloatingActionButton } from "@/components/fab/FloatingActionButton";
import { ComposerModal } from "@/components/composer/ComposerModal";
import { SimilarContentOverlay } from "@/components/feed/SimilarContentOverlay";
import { CGProvider } from "@/lib/comprehension-gate";
import { SourceMCQTest } from "@/components/composer/SourceMCQTest";
import { Search } from "./Search";
import { Saved } from "./Saved";
import { Notifications } from "./Notifications";
import { mockPosts, generateMorePosts, MockPost } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";

export const Feed = () => {
  const [activeTab, setActiveTab] = useState<"following" | "foryou">("following");
  const [activeNavTab, setActiveNavTab] = useState("home");
  const [posts, setPosts] = useState(mockPosts);
  const [scrollY, setScrollY] = useState(0);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showSimilarContent, setShowSimilarContent] = useState(false);
  const [selectedPost, setSelectedPost] = useState<MockPost | null>(null);
  const [showArticleReader, setShowArticleReader] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showPostTestActions, setShowPostTestActions] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>("");
  const [, forceUpdate] = useState({});
  const { toast } = useToast();

  useEffect(() => {
    setPosts([...mockPosts, ...generateMorePosts(15)]);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      forceUpdate({});
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (showSimilarContent || showQuiz || showArticleReader || showPostTestActions) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showSimilarContent, showQuiz, showArticleReader, showPostTestActions]);

  const getCardProps = (index: number) => {
    const cardElement = document.querySelector(`[data-card-index="${index}"]`);
    if (!cardElement) return { scale: 0.9, offset: 0 };
    
    const rect = cardElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const focusZoneTop = viewportHeight * 0.3;
    const focusZoneBottom = viewportHeight * 0.7;
    const focusZoneCenter = viewportHeight * 0.5;
    const cardCenter = rect.top + rect.height / 2;
    
    let scale = 0.85;
    let offset = 0;
    
    if (cardCenter >= focusZoneTop && cardCenter <= focusZoneBottom) {
      const distanceFromCenter = Math.abs(cardCenter - focusZoneCenter);
      const maxDistance = (focusZoneBottom - focusZoneTop) / 2;
      const progress = 1 - (distanceFromCenter / maxDistance);
      scale = 0.9 + (progress * 0.1);
      const offsetMultiplier = cardCenter > focusZoneCenter ? 1 : -1;
      offset = (1 - progress) * 8 * offsetMultiplier;
    } else if (cardCenter < focusZoneTop) {
      scale = 0.95;
      offset = -4;
    } else {
      scale = 0.85;
      offset = 6;
    }
    
    return { scale, offset };
  };

  const handleCreatePost = () => setShowComposer(true);
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
    setSelectedPost(post);
    setShowArticleReader(true);
  };

  const handleCloseArticleReader = () => {
    setShowArticleReader(false);
    setSelectedPost(null);
  };

  const handleStartQuiz = (action: string) => {
    if (!selectedPost) return;
    
    setPendingAction(action);
    setShowArticleReader(false);
    setShowQuiz(true);
  };

  const handleCompleteQuiz = (passed: boolean) => {
    setShowQuiz(false);
    if (passed) {
      setShowPostTestActions(true);
    } else {
      // Reset on failed test
      setSelectedPost(null);
      setPendingAction("");
    }
  };

  const handleClosePostTestActions = () => {
    setShowPostTestActions(false);
    setSelectedPost(null);
    setPendingAction("");
  };

  // Navigation pages
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
                src="/lovable-uploads/2e463915-3b37-49f7-88b3-19a37a0538f2.png"
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
      </div>

      <FloatingActionButton onClick={handleCreatePost} />
      <BottomNavigation 
        activeTab={activeNavTab} 
        onTabChange={setActiveNavTab}
        onProfileClick={() => setShowProfileSheet(true)}
      />

      <ProfileSideSheet 
        isOpen={showProfileSheet}
        onClose={() => setShowProfileSheet(false)}
      />

      <ComposerModal
        isOpen={showComposer}
        onClose={() => setShowComposer(false)}
      />

      {selectedPost && (
        <SimilarContentOverlay
          isOpen={showSimilarContent}
          onClose={handleCloseSimilarContent}
          originalPost={selectedPost}
        />
      )}

      {selectedPost && (
        <ArticleReader
          post={selectedPost}
          isOpen={showArticleReader}
          onClose={handleCloseArticleReader}
          onStartQuiz={handleStartQuiz}
        />
      )}

      {showQuiz && selectedPost && (
        <SourceMCQTest
          source={{
            id: selectedPost.id,
            url: selectedPost.url || "",
            title: selectedPost.sharedTitle || "Articolo condiviso",
            state: 'testing',
            attempts: 0
          }}
          isOpen={showQuiz}
          onClose={() => {
            setShowQuiz(false);
            setSelectedPost(null);
            setPendingAction("");
          }}
          onComplete={handleCompleteQuiz}
        />
      )}

      {selectedPost && (
        <PostTestActionsModal
          post={selectedPost}
          isOpen={showPostTestActions}
          onClose={handleClosePostTestActions}
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
import { useState, useEffect } from "react";
import { Logo } from "@/components/ui/logo";
import { FeedCard } from "@/components/feed/FeedCardAdapt";
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
import { usePosts, useToggleReaction, Post } from "@/hooks/usePosts";
import { useToast } from "@/hooks/use-toast";

export const Feed = () => {
  const { data: dbPosts = [], isLoading } = usePosts();
  const toggleReaction = useToggleReaction();
  const [activeNavTab, setActiveNavTab] = useState("home");
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showSimilarContent, setShowSimilarContent] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showArticleReader, setShowArticleReader] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showPostTestActions, setShowPostTestActions] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>("");
  const { toast } = useToast();


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

  const handleCreatePost = () => setShowComposer(true);
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

  const handleOpenReader = (post: Post) => {
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
    <div className="min-h-screen bg-background pb-24">
      <div className="mobile-container max-w-[600px] mx-auto">
        {/* Header - X Style */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-50 border-b border-border">
          <div className="px-4 py-3">
            <div className="flex justify-center">
              <img 
                src="/lovable-uploads/2e463915-3b37-49f7-88b3-19a37a0538f2.png"
                alt="NOPARROT"
                className="h-7 w-auto cursor-pointer hover:opacity-80 transition-opacity"
                onClick={handleLogoClick}
              />
            </div>
          </div>
        </div>

        {/* Feed Cards - Linear X Style */}
        <div className="divide-y divide-border">
          {dbPosts.map((post) => (
            <FeedCard
              key={post.id}
              post={post}
              onOpenReader={() => handleOpenReader(post)}
              onRemove={() => handleRemovePost(post.id)}
            />
          ))}
          {dbPosts.length === 0 && (
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
            url: selectedPost.shared_url || "",
            title: selectedPost.shared_title || "Articolo condiviso",
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
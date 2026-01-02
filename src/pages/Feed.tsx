import { useState, useEffect, useMemo } from "react";
import { ImmersiveFeedContainer } from "@/components/feed/ImmersiveFeedContainer";
import { ImmersivePostCard } from "@/components/feed/ImmersivePostCard";
import { ImmersiveFocusCard } from "@/components/feed/ImmersiveFocusCard";
import { FocusDetailSheet } from "@/components/feed/FocusDetailSheet";
import { CommentsDrawer } from "@/components/feed/CommentsDrawer";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { ProfileSideSheet } from "@/components/navigation/ProfileSideSheet";
import { FloatingActionButton } from "@/components/fab/FloatingActionButton";
import { ComposerModal } from "@/components/composer/ComposerModal";
import { SimilarContentOverlay } from "@/components/feed/SimilarContentOverlay";
import { Header } from "@/components/navigation/Header";
import { CGProvider } from "@/lib/comprehension-gate";
import { Search } from "./Search";
import { Saved } from "./Saved";
import { Notifications } from "./Notifications";
import { usePosts, Post } from "@/hooks/usePosts";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useDailyFocus } from "@/hooks/useDailyFocus";
import { useInterestFocus } from "@/hooks/useInterestFocus";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/lib/haptics";
import { toast as sonnerToast } from "sonner";

export const Feed = () => {
  const { user } = useAuth();
  const { data: dbPosts = [], isLoading, refetch } = usePosts();
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

  // Handler completo per navigazione tab
  const handleTabChange = (tab: string) => {
    setActiveNavTab(tab);
  };

  // Handler per refresh quando già nel feed
  const handleHomeRefresh = () => {
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Invalida le query per refreshare i dati
    queryClient.invalidateQueries({ queryKey: ['posts'] });
    queryClient.invalidateQueries({ queryKey: ['daily-focus'] });
    queryClient.invalidateQueries({ queryKey: ['interest-focus'] });
    
    // Haptic feedback
    haptics.light();
  };
  const [showSimilarContent, setShowSimilarContent] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [quotedPost, setQuotedPost] = useState<Post | null>(null);
  const { toast } = useToast();
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

  // Pull-to-refresh is now handled by ImmersiveFeedContainer

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
          onTabChange={handleTabChange}
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
          onTabChange={handleTabChange}
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
          onTabChange={handleTabChange}
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
    <>
      {/* Immersive transparent header with notifications */}
      <Header variant="immersive" />
      
      <ImmersiveFeedContainer onRefresh={async () => { await refetch(); }}>
        {/* Immersive Feed Items */}
        {mixedFeed.map((item) => {
          if (item.type === 'daily' || item.type === 'interest') {
            return (
              <ImmersiveFocusCard
                key={item.id}
                focusId={item.data.id}
                type={item.type}
                category={item.data.category}
                title={item.data.title}
                summary={item.data.summary}
                sources={item.data.sources}
                trustScore={item.data.trust_score}
                imageUrl={item.data.image_url}
                reactions={item.data.reactions || { likes: 0, comments: 0, shares: 0 }}
                onClick={() => {
                  setSelectedFocus(item);
                  setFocusDetailOpen(true);
                }}
                onComment={() => {
                  setSelectedFocusForComments(item);
                  setFocusCommentsOpen(true);
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
              <ImmersivePostCard
                key={item.id}
                post={item.data}
                onRemove={() => handleRemovePost(item.data.id)}
                onQuoteShare={handleQuoteShare}
              />
            );
          }
        })}
        
        {/* Empty state */}
        {mixedFeed.length === 0 && (
          <div className="h-[100dvh] w-full snap-start flex items-center justify-center">
            <div className="text-center text-white/60">
              <p className="text-xl mb-2">Nessun post disponibile.</p>
              <p className="text-sm">Crea il primo post!</p>
            </div>
          </div>
        )}
      </ImmersiveFeedContainer>

      <FloatingActionButton onClick={handleCreatePost} />
      <BottomNavigation 
        activeTab={activeNavTab} 
        onTabChange={handleTabChange}
        onProfileClick={() => setShowProfileSheet(true)}
        onHomeRefresh={handleHomeRefresh}
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
        <>
          <FocusDetailSheet
            open={focusDetailOpen}
            onOpenChange={setFocusDetailOpen}
            type={selectedFocus.type === 'daily' ? 'daily' : 'interest'}
            category={selectedFocus.data.category}
            title={selectedFocus.data.title}
            deepContent={selectedFocus.data.deep_content}
            sources={selectedFocus.data.sources}
            imageUrl={selectedFocus.data.image_url}
            focusId={selectedFocus.data.id}
            reactions={selectedFocus.data.reactions}
            onLike={() => {
              if (!user) {
                sonnerToast.error('Devi effettuare il login per mettere like');
                return;
              }
              haptics.light();
            }}
            onComment={() => {
              setSelectedFocusForComments(selectedFocus);
              setFocusDetailOpen(false);
              setTimeout(() => setFocusCommentsOpen(true), 150);
            }}
            onShare={() => {
              toast({
                title: "Condividi",
                description: "Funzionalità share Focus (da implementare)"
              });
            }}
          />
        </>
      )}

      {selectedFocusForComments && (
        <CommentsDrawer
          post={{
            id: selectedFocusForComments.data.id,
            content: selectedFocusForComments.data.summary,
            author_id: 'system',
            created_at: selectedFocusForComments.data.created_at || new Date().toISOString(),
            author: {
              id: 'system',
              username: selectedFocusForComments.type === 'daily' ? 'Il Punto' : 'Per Te',
              full_name: selectedFocusForComments.type === 'daily' ? 'Il Punto' : `Per Te: ${selectedFocusForComments.data.category}`,
              avatar_url: null
            },
            topic_tag: null,
            shared_title: selectedFocusForComments.data.title,
            shared_url: 'focus://internal',
            preview_img: selectedFocusForComments.data.image_url,
            full_article: null,
            article_content: selectedFocusForComments.data.deep_content,
            trust_level: null,
            stance: null,
            sources: selectedFocusForComments.data.sources?.map((s: any) => s.url).filter(Boolean) || [],
            quoted_post_id: null,
            category: selectedFocusForComments.data.category || null,
            reactions: selectedFocusForComments.data.reactions || { likes: 0, comments: 0, shares: 0 }
          } as unknown as Post}
          isOpen={focusCommentsOpen}
          onClose={() => setFocusCommentsOpen(false)}
          mode="view"
        />
      )}
    </>
  );
};

const FeedWithGate = () => (
  <CGProvider policy={{ minReadSeconds: 10, minScrollRatio: 0.8 }}>
    <Feed />
  </CGProvider>
);

export default FeedWithGate;
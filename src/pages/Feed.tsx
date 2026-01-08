import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ImmersiveFeedContainer, ImmersiveFeedContainerRef } from "@/components/feed/ImmersiveFeedContainer";
import { ImmersivePostCard } from "@/components/feed/ImmersivePostCard";
import { ImmersiveEditorialCarousel } from "@/components/feed/ImmersiveEditorialCarousel";
import { FocusDetailSheet } from "@/components/feed/FocusDetailSheet";
import { CommentsDrawer } from "@/components/feed/CommentsDrawer";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";

import { FloatingActionButton } from "@/components/fab/FloatingActionButton";
import { ComposerModal } from "@/components/composer/ComposerModal";
import { SimilarContentOverlay } from "@/components/feed/SimilarContentOverlay";
import { Header } from "@/components/navigation/Header";
import { CGProvider } from "@/lib/comprehension-gate";
import { usePosts, Post } from "@/hooks/usePosts";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useDailyFocus, DailyFocus } from "@/hooks/useDailyFocus";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/lib/haptics";
import { toast as sonnerToast } from "sonner";

export const Feed = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: dbPosts = [], isLoading, refetch } = usePosts();
  const queryClient = useQueryClient();
  const feedContainerRef = useRef<ImmersiveFeedContainerRef>(null);
  
  // State for force refresh - passed to hooks
  const [refreshNonce, setRefreshNonce] = useState(0);
  
  // Fetch real Daily Focus items (now returns { items, totalCount }) with refreshNonce
  const { data: dailyFocusData, isLoading: loadingDaily } = useDailyFocus(refreshNonce);
  const dailyFocusItems = dailyFocusData?.items || [];
  const dailyFocusTotalCount = dailyFocusData?.totalCount || dailyFocusItems.length;
  
  const [showComposer, setShowComposer] = useState(false);

  // Handler per salvare l'indice attivo durante lo scroll
  const handleActiveIndexChange = (index: number) => {
    sessionStorage.setItem('feed-active-index', index.toString());
  };

  // Ref per evitare restore multipli
  const hasRestoredScrollRef = useRef(false);

  // Handler per navigazione tab (ora usa React Router)
  const handleTabChange = (tab: string) => {
    if (tab === 'home') navigate('/');
    else if (tab === 'search') navigate('/search');
    else if (tab === 'saved') navigate('/saved');
    else if (tab === 'notifications') navigate('/notifications');
  };

  // Handler per refresh quando già nel feed
  const handleHomeRefresh = () => {
    // Pulisci la posizione salvata per forzare scroll top
    sessionStorage.removeItem('feed-active-index');
    
    // Scroll container to top (for snap scroll)
    if (feedContainerRef.current) {
      feedContainerRef.current.scrollToTop();
    }
    // Fallback for window scroll
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Incrementa nonce per forzare refresh delle query
    setRefreshNonce(prev => prev + 1);
    
    // Invalida le query per refreshare i dati
    queryClient.invalidateQueries({ queryKey: ['posts'] });
    queryClient.invalidateQueries({ queryKey: ['daily-focus'] });
    
    // Haptic feedback + visual confirmation
    haptics.light();
    sonnerToast.success('Feed aggiornato');
  };
  const [showSimilarContent, setShowSimilarContent] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [quotedPost, setQuotedPost] = useState<Post | null>(null);
  const { toast } = useToast();
  const [focusDetailOpen, setFocusDetailOpen] = useState(false);
  const [selectedFocus, setSelectedFocus] = useState<any>(null);
  const [focusCommentsOpen, setFocusCommentsOpen] = useState(false);
  const [selectedFocusForComments, setSelectedFocusForComments] = useState<any>(null);

  // Build mixed feed: Daily Focus Carousel + User Posts
  const mixedFeed = useMemo(() => {
    const items: Array<{ type: 'daily-carousel' | 'post'; data: any; id: string }> = [];
    
    // 1. Daily Focus Carousel always at top (array of items)
    if (dailyFocusItems.length > 0) {
      items.push({ 
        type: 'daily-carousel', 
        data: dailyFocusItems, 
        id: 'daily-carousel-' + dailyFocusItems[0].id 
      });
    }
    
    // 2. User posts
    dbPosts.forEach((post) => {
      items.push({ type: 'post', data: post, id: post.id });
    });
    
    return items;
  }, [dailyFocusItems, dbPosts]);

  // Ripristina posizione scroll (indice) quando Feed si monta e i dati sono caricati
  useEffect(() => {
    // Attendi che i dati siano caricati
    if (isLoading || loadingDaily || !mixedFeed.length) return;
    if (hasRestoredScrollRef.current) return;
    
    const savedIndex = sessionStorage.getItem('feed-active-index');
    if (savedIndex) {
      const index = parseInt(savedIndex);
      hasRestoredScrollRef.current = true;
      
      // Triplo RAF + timeout per garantire che il DOM sia pronto su iOS
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (feedContainerRef.current?.scrollToIndex) {
              feedContainerRef.current.scrollToIndex(index);
            }
          }, 50);
        });
      });
    }
  }, [isLoading, loadingDaily, mixedFeed.length]);

  // Handle ?focus= URL parameter (from Saved page navigation)
  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (!focusId || loadingDaily) return;
    
    // Find the focus item in current data
    const focusItem = dailyFocusItems.find(item => item.id === focusId);
    
    if (focusItem) {
      const clickedIndex = dailyFocusItems.findIndex(d => d.id === focusId);
      const editorialNumber = dailyFocusTotalCount - clickedIndex;
      setSelectedFocus({ type: 'daily', data: focusItem, editorialNumber });
      setFocusDetailOpen(true);
      
      // Clear the URL parameter
      setSearchParams({}, { replace: true });
    } else {
      // Focus not in current carousel - fetch directly from DB
      (async () => {
        const { data: fetchedFocus, error } = await supabase
          .from('daily_focus')
          .select('*')
          .eq('id', focusId)
          .single();
        
        if (!error && fetchedFocus) {
          // Calculate editorial number by counting items newer than this one
          const { count } = await supabase
            .from('daily_focus')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', fetchedFocus.created_at);
          
          const editorialNumber = dailyFocusTotalCount - (count || 1) + 1;
          
          setSelectedFocus({ 
            type: 'daily', 
            data: fetchedFocus as unknown as DailyFocus, 
            editorialNumber 
          });
          setFocusDetailOpen(true);
        }
        
        // Clear the URL parameter
        setSearchParams({}, { replace: true });
      })();
    }
  }, [searchParams, dailyFocusItems, loadingDaily, dailyFocusTotalCount, setSearchParams]);

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
      
      <ImmersiveFeedContainer ref={feedContainerRef} onRefresh={async () => { await refetch(); }} onActiveIndexChange={handleActiveIndexChange}>
        {/* Immersive Feed Items */}
        {mixedFeed.map((item) => {
          if (item.type === 'daily-carousel') {
            // Editorial Carousel for Il Punto
            return (
              <ImmersiveEditorialCarousel
                key={item.id}
                items={item.data as DailyFocus[]}
                totalCount={dailyFocusTotalCount}
                onItemClick={(focusItem) => {
                  // Find index of clicked item to pass editorialNumber
                  const clickedIndex = dailyFocusItems.findIndex(d => d.id === focusItem.id);
                  const editorialNumber = dailyFocusTotalCount - clickedIndex;
                  setSelectedFocus({ type: 'daily', data: focusItem, editorialNumber });
                  setFocusDetailOpen(true);
                }}
                onComment={(focusItem) => {
                  setSelectedFocusForComments({ type: 'daily', data: focusItem });
                  setFocusCommentsOpen(true);
                }}
                onShareComplete={(focusItem) => {
                  // After gate passed, open composer with editorial as quoted content
                  setQuotedPost({
                    id: focusItem.id,
                    content: focusItem.summary,
                    author_id: 'system',
                    created_at: focusItem.created_at || new Date().toISOString(),
                    author: {
                      id: 'system',
                      username: 'Il Punto',
                      full_name: 'Il Punto',
                      avatar_url: null
                    },
                    topic_tag: null,
                    shared_title: focusItem.title,
                    shared_url: `focus://daily/${focusItem.id}`,
                    preview_img: focusItem.image_url,
                    full_article: null,
                    article_content: focusItem.deep_content,
                    trust_level: focusItem.trust_score,
                    stance: null,
                    sources: focusItem.sources?.map((s: any) => s.url).filter(Boolean) || [],
                    quoted_post_id: null,
                    category: focusItem.category || null,
                    reactions: focusItem.reactions || { likes: 0, comments: 0, shares: 0 }
                  } as unknown as Post);
                  setShowComposer(true);
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
        activeTab="home" 
        onTabChange={handleTabChange}
        onHomeRefresh={handleHomeRefresh}
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
            type="daily"
            category={selectedFocus.data.category}
            title={selectedFocus.data.title}
            deepContent={selectedFocus.data.deep_content}
            sources={selectedFocus.data.sources}
            imageUrl={selectedFocus.data.image_url}
            focusId={selectedFocus.data.id}
            editorialNumber={selectedFocus.editorialNumber}
            reactions={selectedFocus.data.reactions}
            onLike={() => {
              if (!user) {
                sonnerToast.error('Devi effettuare il login per mettere like');
                return;
              }
              haptics.light();
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
              username: 'Il Punto',
              full_name: 'Il Punto',
              avatar_url: null
            },
            topic_tag: null,
            shared_title: selectedFocusForComments.data.title,
            shared_url: 'focus://internal',
            preview_img: null,
            full_article: null,
            article_content: null,
            trust_level: null,
            stance: null,
            sources: null,
            quoted_post_id: null,
            category: selectedFocusForComments.data.category || null,
            reactions: selectedFocusForComments.data.reactions || { likes: 0, comments: 0, shares: 0 }
          } as unknown as Post}
          isOpen={focusCommentsOpen}
          onClose={() => {
            setFocusCommentsOpen(false);
            setSelectedFocusForComments(null);
          }}
        />
      )}
    </>
  );
};

const FeedWithProvider = () => (
  <CGProvider>
    <Feed />
  </CGProvider>
);

export default FeedWithProvider;

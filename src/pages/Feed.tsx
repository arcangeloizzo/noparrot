import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ImmersiveFeedContainer, ImmersiveFeedContainerRef } from "@/components/feed/ImmersiveFeedContainer";
import { ImmersivePostCard } from "@/components/feed/ImmersivePostCard";
import { ImmersiveEditorialCarousel } from "@/components/feed/ImmersiveEditorialCarousel";
import { FocusDetailSheet } from "@/components/feed/FocusDetailSheet";
import { CommentsDrawer } from "@/components/feed/CommentsDrawer";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";

// FloatingActionButton removed - now integrated into BottomNavigation
import { ComposerModal } from "@/components/composer/ComposerModal";
import { SimilarContentOverlay } from "@/components/feed/SimilarContentOverlay";
import { Header } from "@/components/navigation/Header";
import { PerfOverlay } from "@/components/debug/PerfOverlay";
import { CGProvider } from "@/lib/comprehension-gate";
import { usePosts, Post } from "@/hooks/usePosts";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useDailyFocus, DailyFocus } from "@/hooks/useDailyFocus";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/lib/haptics";
import { toast as sonnerToast } from "sonner";
import { perfStore, isEmailAllowed } from "@/lib/perfStore";
import { PostCardSkeleton, EditorialSlideSkeleton } from "@/components/feed/skeletons";
import { prefetchArticlePreviews } from "@/hooks/useArticlePreview";

// Helper to get optimized Supabase image URL for prefetch
const getOptimizedImageUrl = (src: string | undefined): string | undefined => {
  if (!src) return undefined;
  const isSupabaseStorage = src.includes('.supabase.co/storage/') || src.includes('supabase.co/storage/');
  if (!isSupabaseStorage) return src;
  if (src.includes('width=') || src.includes('resize=')) return src;
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}width=600&resize=contain&quality=75`;
};

export const Feed = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: dbPosts = [], isLoading, refetch } = usePosts();
  const queryClient = useQueryClient();
  const feedContainerRef = useRef<ImmersiveFeedContainerRef>(null);
  
  // State for force refresh - passed to hooks
  const [refreshNonce, setRefreshNonce] = useState(0);
  
  // Sliding Window: track active index for virtualization
  // Initialize from sessionStorage to avoid white screen on refresh
  const [activeIndex, setActiveIndex] = useState(() => {
    const saved = sessionStorage.getItem('feed-active-index');
    return saved ? parseInt(saved, 10) : 0;
  });
  
  // ===== HARDENING 3: Post-publish scroll state =====
  const [pendingScrollToPostId, setPendingScrollToPostId] = useState<string | null>(null);
  
  // Handler for publish success - schedules scroll to new post
  const handlePublishSuccess = useCallback((newPostId: string) => {
    console.log('[Feed] Post published, scheduling scroll to:', newPostId);
    setPendingScrollToPostId(newPostId);
  }, []);
  
  // Fetch real Daily Focus items (now returns { items, totalCount }) with refreshNonce
  const { data: dailyFocusData, isLoading: loadingDaily } = useDailyFocus(refreshNonce);
  const dailyFocusItems = dailyFocusData?.items || [];
  const dailyFocusTotalCount = dailyFocusData?.totalCount || dailyFocusItems.length;
  
  const [showComposer, setShowComposer] = useState(false);

  // Prefetch article previews for first 5 posts on mount
  const hasPrefetchedRef = useRef(false);
  useEffect(() => {
    if (hasPrefetchedRef.current || dbPosts.length === 0) return;
    hasPrefetchedRef.current = true;
    
    const urlsToPrefetch = dbPosts
      .slice(0, 5)
      .map(p => p.shared_url)
      .filter(Boolean);
    
    if (urlsToPrefetch.length > 0) {
      prefetchArticlePreviews(queryClient, urlsToPrefetch);
    }
  }, [dbPosts, queryClient]);


  // Store mixedFeed in ref for stable callback access
  const mixedFeedRef = useRef<Array<{ type: 'daily-carousel' | 'post'; data: any; id: string }>>([]);

  // ===== HARDENING 1: Atomic state sync utility =====
  // Lightweight state sync ONLY (no side effects) - ensures activeIndex and sessionStorage are always in sync
  const syncActiveIndex = useCallback((index: number) => {
    setActiveIndex(index);
    sessionStorage.setItem('feed-active-index', index.toString());
  }, []);

  // Handler per salvare l'indice attivo durante lo scroll - stabilized with useCallback
  // Also prefetches next card's image for smoother experience
  const handleActiveIndexChange = useCallback((index: number) => {
    // Use atomic sync utility
    syncActiveIndex(index);
    
    // Prefetch next card's optimized image using ref
    const nextItem = mixedFeedRef.current[index + 1];
    if (nextItem?.type === 'post' && nextItem.data.preview_img) {
      const img = new Image();
      img.src = getOptimizedImageUrl(nextItem.data.preview_img) || nextItem.data.preview_img;
    }
    
    // Trigger perf tracking for scroll action
    perfStore.startAction('scroll');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        perfStore.endAction();
      });
    });
  }, [syncActiveIndex]);

  // Ref per evitare restore multipli
  const hasRestoredScrollRef = useRef(false);

  // Handler per navigazione tab (ora usa React Router)
  const handleTabChange = (tab: string) => {
    if (tab === 'home') navigate('/');
    else if (tab === 'search') navigate('/search');
    else if (tab === 'saved') navigate('/saved');
    else if (tab === 'notifications') navigate('/notifications');
  };

  // ===== HARDENING 1: Robust Home Refresh =====
  // Handler per refresh quando già nel feed - uses syncActiveIndex for deterministic state
  const handleHomeRefresh = () => {
    // 1) Hard sync activeIndex a 0 PRIMA dello scroll (atomic state update)
    syncActiveIndex(0);
    
    // 2) Scroll SOLO il container (NO window.scrollTo - rispetta virtualization)
    if (feedContainerRef.current) {
      feedContainerRef.current.scrollToIndex(0);
    }
    
    // 3) Incrementa nonce per forzare refresh delle query
    setRefreshNonce(prev => prev + 1);
    
    // 4) Invalida le query per refreshare i dati
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

  // Keep ref in sync for stable callback access
  mixedFeedRef.current = mixedFeed;

  // ===== HARDENING 2: Dynamic prefetch for upcoming items =====
  useEffect(() => {
    if (mixedFeed.length === 0) return;
    
    const candidates = [activeIndex + 1, activeIndex + 2, activeIndex + 3]
      .map(i => mixedFeedRef.current[i])
      .filter(item => item?.type === 'post')
      .map(item => item.data.shared_url)
      .filter((url): url is string => !!url);

    if (candidates.length > 0) {
      prefetchArticlePreviews(queryClient, candidates);
    }
  }, [activeIndex, queryClient, mixedFeed.length]);

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

  // ===== HARDENING 3: Bounded retry loop for post-publish scroll =====
  useEffect(() => {
    if (!pendingScrollToPostId) return;
    
    let attempts = 0;
    const maxAttempts = 10; // ~2s total (10 * 200ms)
    const intervalMs = 200;
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const tryScroll = () => {
      attempts++;
      
      const idx = mixedFeed.findIndex(
        item => item.type === 'post' && item.data.id === pendingScrollToPostId
      );
      
      if (idx !== -1) {
        console.log(`[Feed] Found post at index ${idx}, scrolling...`);
        syncActiveIndex(idx);
        requestAnimationFrame(() => {
          feedContainerRef.current?.scrollToIndex(idx);
        });
        setPendingScrollToPostId(null);
        return;
      }
      
      if (attempts < maxAttempts) {
        timeoutId = setTimeout(tryScroll, intervalMs);
      } else {
        console.warn('[Feed] Could not find new post after', maxAttempts, 'attempts');
        setPendingScrollToPostId(null);
      }
    };
    
    tryScroll();
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [pendingScrollToPostId, mixedFeed, syncActiveIndex]);

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

  // Long-press on header to toggle perf overlay (for allowed users)
  const longPressRef = useRef<NodeJS.Timeout | null>(null);
  const handleHeaderPressStart = useCallback(() => {
    if (!isEmailAllowed(user?.email)) return;
    longPressRef.current = setTimeout(() => {
      perfStore.toggle();
      haptics.medium();
      sonnerToast.info(perfStore.getState().enabled ? 'Perf overlay ON' : 'Perf overlay OFF');
    }, 2000);
  }, [user?.email]);
  
  const handleHeaderPressEnd = useCallback(() => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  }, []);

  if (isLoading || loadingDaily) {
    return (
      <div className="min-h-screen bg-background">
        <Header variant="immersive" />
        <EditorialSlideSkeleton />
      </div>
    );
  }

  return (
    <>
      {/* Perf Overlay - only visible when enabled */}
      <PerfOverlay />
      
      {/* Immersive transparent header with notifications + long-press for perf toggle */}
      <div 
        onTouchStart={handleHeaderPressStart}
        onTouchEnd={handleHeaderPressEnd}
        onMouseDown={handleHeaderPressStart}
        onMouseUp={handleHeaderPressEnd}
        onMouseLeave={handleHeaderPressEnd}
      >
        <Header variant="immersive" />
      </div>
      
      <ImmersiveFeedContainer ref={feedContainerRef} onRefresh={async () => { await refetch(); }} onActiveIndexChange={handleActiveIndexChange}>
        {/* Sliding Window Virtualization: only mount heavy components in window */}
        {mixedFeed.map((item, feedIndex) => {
          // Virtualization window: activeIndex -1 to +2 (4 items max)
          const isVisible =
            feedIndex >= activeIndex - 1 &&
            feedIndex <= activeIndex + 2;

          // Wrapper ALWAYS stays mounted (preserves scroll height + snap points)
          return (
            <div
              key={item.type === 'post' ? `post-${item.data.id}` : `daily-carousel-${item.id}`}
              className="w-full h-[100dvh] snap-start shrink-0 overflow-hidden"
            >
              {isVisible ? (
                item.type === 'daily-carousel' ? (
                  <ImmersiveEditorialCarousel
                    key={item.id}
                    items={item.data as DailyFocus[]}
                    totalCount={dailyFocusTotalCount}
                    onItemClick={(focusItem) => {
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
                ) : (
                  <ImmersivePostCard
                    key={item.id}
                    post={item.data}
                    index={feedIndex}
                    onRemove={handleRemovePost}
                    onQuoteShare={handleQuoteShare}
                  />
                )
              ) : (
                // Lightweight placeholder for off-window items
                <div className="w-full h-full bg-[#0E1A24]" />
              )}
            </div>
          );
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

      <BottomNavigation 
        activeTab="home" 
        onTabChange={handleTabChange}
        onHomeRefresh={handleHomeRefresh}
        onComposerClick={handleCreatePost}
      />

      <ComposerModal
        isOpen={showComposer}
        onClose={() => {
          setShowComposer(false);
          setQuotedPost(null);
        }}
        quotedPost={quotedPost}
        onPublishSuccess={handlePublishSuccess}
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
          mode="view"
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

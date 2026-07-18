import React, { useState, useCallback, useEffect, useRef, memo, useLayoutEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Heart, MessageCircle, Bookmark, Info, Sparkles, Layers } from "lucide-react";
import { perfStore } from "@/lib/perfStore";
import { cn } from "@/lib/utils";
import { useFocusReactions, useToggleFocusReaction } from "@/hooks/useFocusReactions";
import { useFocusBookmark, useToggleFocusBookmark } from "@/hooks/useFocusBookmarks";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Logo } from "@/components/ui/logo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { DailyFocus } from "@/hooks/useDailyFocus";
import { SourceReaderGate } from "@/components/composer/SourceReaderGate";
import { SourceWithGate } from "@/lib/comprehension-gate-extended";
import { QuizModal } from "@/components/ui/quiz-modal";
import { SourcesDrawer } from "@/components/feed/SourcesDrawer";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/lib/haptics";
import { addBreadcrumb } from "@/lib/crashBreadcrumbs";
import { useLongPress } from "@/hooks/useLongPress";
import { ReactionPicker, reactionToEmoji, type ReactionType } from "@/components/ui/reaction-picker";
import { ReactionSummary } from "@/components/feed/ReactionSummary";
import { ReactionsSheet } from "@/components/feed/ReactionsSheet";
import { ShareSheet } from "@/components/share/ShareSheet";
import { UnifiedBadge } from "@/components/shared/UnifiedBadge";
import { CardShell } from "@/components/shared/CardShell";
import { ClampedTitle } from "@/components/shared/ClampedTitle";


interface ImmersiveEditorialCarouselProps {
  items: DailyFocus[];
  totalCount: number;
  onItemClick?: (item: DailyFocus) => void;
  onComment?: (item: DailyFocus) => void;
  onShare?: (item: DailyFocus) => void;
  onShareComplete?: (item: DailyFocus) => void;
}

const ImmersiveEditorialCarouselInner = ({
  items,
  totalCount,
  onItemClick,
  onComment,
  onShare,
  onShareComplete,
}: ImmersiveEditorialCarouselProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    dragFree: false,
    containScroll: "trimSnaps",
    skipSnaps: false,
    axis: "x",
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeItem = items[selectedIndex];

  const { user } = useAuth();
  const { data: reactionsData } = useFocusReactions(activeItem?.id || "", "daily");
  const toggleReaction = useToggleFocusReaction();

  // Bookmarks for active item
  const { data: isBookmarked } = useFocusBookmark(activeItem?.id || "", "daily");
  const toggleBookmark = useToggleFocusBookmark();

  // Dialog states - OUTSIDE carousel to avoid layout shifts
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const suppressUntilRef = React.useRef(0);

  // Sources drawer state
  const [sourcesDrawerOpen, setSourcesDrawerOpen] = useState(false);
  const [sourcesDrawerItem, setSourcesDrawerItem] = useState<DailyFocus | null>(null);

  // Reactions sheet state
  const [showReactionsSheet, setShowReactionsSheet] = useState(false);
  const [reactionsSheetItem, setReactionsSheetItem] = useState<DailyFocus | null>(null);

  // Comprehension Gate state for editorial share
  const [showReader, setShowReader] = useState(false);
  const [readerSource, setReaderSource] = useState<SourceWithGate | null>(null);
  const [readerClosing, setReaderClosing] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizData, setQuizData] = useState<{ qaId?: string; questions: any[]; focusId?: string } | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const pendingShareItemRef = useRef<DailyFocus | null>(null);

  const [showShareSheet, setShowShareSheet] = useState(false);
  const [itemToShare, setItemToShare] = useState<DailyFocus | null>(null);
  const [shareAction, setShareAction] = useState<'feed' | 'friend'>('feed');

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      suppressUntilRef.current = Date.now() + 400;
    }
  };

  // Update selected index on scroll
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const handleCardClick = (item: DailyFocus) => {
    if (infoDialogOpen) return;
    if (Date.now() < suppressUntilRef.current) return;
    onItemClick?.(item);
  };

  // Handle sources drawer open
  const handleOpenSources = (item: DailyFocus) => {
    setSourcesDrawerItem(item);
    setSourcesDrawerOpen(true);
  };

  // Handle share with comprehension gate
  const handleShareWithGate = async (item: DailyFocus, action: 'feed' | 'friend') => {
    if (!user) {
      toast.error("Devi effettuare il login per condividere");
      return;
    }

    pendingShareItemRef.current = item;
    setShareAction(action);

    // Build reader source from editorial deep_content
    const content = item.deep_content || item.summary;
    // Clean [SOURCE:N] markers for display in reader
    const cleanContent = content.replace(/\[SOURCE:\d+\]/g, '').trim();

    const readerSrc: SourceWithGate = {
      id: item.id,
      state: 'reading',
      url: `editorial://${item.id}`,
      title: item.title,
      summary: cleanContent.substring(0, 200),
      platform: 'article',
      contentQuality: 'complete',
      articleContent: cleanContent,
    };

    setReaderSource(readerSrc);
    setShowReader(true);
  };

  // Handle reader complete -> generate quiz
  const handleReaderComplete = async () => {
    setReaderClosing(true);

    setTimeout(async () => {
      setShowReader(false);
      setReaderClosing(false);
      setQuizLoading(true);

      try {
        const item = pendingShareItemRef.current;
        if (!item) throw new Error("No pending item");

        const content = item.deep_content || item.summary;

        // Generate quiz from editorial content
        const { data, error } = await supabase.functions.invoke('generate-qa', {
          body: {
            title: item.title,
            summary: content,
            sourceUrl: `editorial://${item.id}`,
            testMode: 'USER_ONLY',
            isPrePublish: true,
          }
        });

        if (error) throw error;

        if (data?.questions && data.questions.length > 0) {
          setQuizData({
            qaId: data.qaId,
            questions: data.questions,
            focusId: item.id
          });
          setShowQuiz(true);
        } else {
          handleQuizPass();
        }
      } catch (err) {
        console.error('[EditorialCarousel] Quiz generation error:', err);
        toast.error("Errore nella generazione del test");
        pendingShareItemRef.current = null;
      } finally {
        setQuizLoading(false);
      }
    }, 300);
  };

  // Handle quiz pass -> trigger share completion
  const handleQuizPass = () => {
    addBreadcrumb('quiz_closed', { via: 'passed' });
    setShowQuiz(false);
    setQuizData(null);

    const item = pendingShareItemRef.current;
    pendingShareItemRef.current = null;

    if (item) {
      onShareComplete?.(item);
    }
  };

  // Handle quiz close without passing
  const handleQuizClose = () => {
    addBreadcrumb('quiz_closed', { via: 'cancelled' });
    setShowQuiz(false);
    setQuizData(null);
    pendingShareItemRef.current = null;
  };

  if (!items.length) return null;

  return (
    <div className="w-full h-full relative flex flex-col overflow-hidden">
      {/* Editorial Background - Deep urban gradient */}
      <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(120% 80% at 50% 42%, #12253A 0%, #0B131A 62%, #070C12 100%)' }} />

      {/* Content Layer */}
      <div className="relative z-10 w-full h-full flex flex-col">

        {/* Carousel Container */}
        <div
          ref={emblaRef}
        className="flex-1 overflow-x-hidden touch-pan-y"
        >
          <div className="flex h-full will-change-transform transform-gpu">
            {items.map((item, index) => (
              <EditorialSlide
                key={item.id}
                item={item}
                index={index}
                isActive={index === selectedIndex}
                totalSlides={items.length}
                currentSlideIndex={selectedIndex}
                onDotClick={(idx) => emblaApi?.scrollTo(idx)}
                onClick={() => handleCardClick(item)}
                onOpenInfoDialog={() => setInfoDialogOpen(true)}
                onShare={() => {
                  setItemToShare(item);
                  setShowShareSheet(true);
                }}
                onOpenSources={() => handleOpenSources(item)}
                onComment={onComment}
                reactionsData={index === selectedIndex ? reactionsData : null}
                isBookmarked={index === selectedIndex ? isBookmarked : false}
                onLike={(reactionType) => {
                  if (!user) {
                    toast.error("Devi effettuare il login per mettere like");
                    return;
                  }
                  toggleReaction.mutate({ focusId: item.id, focusType: "daily", reactionType: reactionType || 'heart' });
                }}
                onBookmark={() => {
                  if (!user) {
                    toast.error("Devi effettuare il login per salvare");
                    return;
                  }
                  toggleBookmark.mutate({ focusId: item.id, focusType: "daily" });
                }}
                onOpenReactionsSheet={() => {
                  setReactionsSheetItem(item);
                  setShowReactionsSheet(true);
                }}
              />
            ))}
          </div>
        </div>

      </div>

      {/* Info Dialog - Legal disclaimer */}
      <Dialog
        open={infoDialogOpen}
        onOpenChange={(open) => {
          setInfoDialogOpen(open);
          handleDialogChange(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Sintesi Algoritmica
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Sintesi automatica basata su fonti pubbliche; NoParrot non è una testata giornalistica.
            </p>
            <p>
              Non è fact-checking; apri le fonti per verificare il contesto.
            </p>
          </div>
          <DialogClose asChild>
            <button className="w-full mt-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors">
              Ho capito
            </button>
          </DialogClose>
        </DialogContent>
      </Dialog>

      {/* Sources Drawer */}
      <SourcesDrawer
        open={sourcesDrawerOpen}
        onOpenChange={setSourcesDrawerOpen}
        sources={(sourcesDrawerItem?.sources || []).map((s: any, i: number) => ({
          icon: '📰',
          name: s.name || `Fonte ${i + 1}`,
          url: s.url || '',
          title: s.title || s.name || '',
          description: s.description || '',
        }))}
      />

      {/* Comprehension Gate Reader */}
      {readerSource && (
        <SourceReaderGate
          source={readerSource}
          isOpen={showReader}
          isClosing={readerClosing}
          onClose={() => {
            setShowReader(false);
            setReaderSource(null);
            pendingShareItemRef.current = null;
          }}
          onComplete={handleReaderComplete}
        />
      )}

      {/* Quiz Modal */}
      {showQuiz && quizData && (
        <QuizModal
          questions={quizData.questions}
          qaId={quizData.qaId}
          onSubmit={async (answers) => {
            const qaId = quizData.qaId;
            const sourceUrl = `focus://daily/${quizData.focusId}`;

            try {
              const { data, error } = await supabase.functions.invoke('submit-qa', {
                body: {
                  qaId,
                  postId: null,
                  sourceUrl: sourceUrl,
                  answers,
                  gateType: 'share'
                }
              });

              if (error) {
                console.error('[ImmersiveEditorialCarousel] Validation error:', error);
                return { passed: false, score: 0, total: quizData.questions.length, wrongIndexes: [] };
              }

              const passed = data?.passed || false;
              const score = data?.score || 0;
              const wrongIndexes = data?.wrongIndexes || [];

              return { passed, score, total: quizData.questions.length, wrongIndexes };
            } catch (err) {
              console.error('[ImmersiveEditorialCarousel] Unexpected error:', err);
              return { passed: false, score: 0, total: quizData.questions.length, wrongIndexes: [] };
            }
          }}
          onCancel={handleQuizClose}
          onComplete={(passed) => {
            if (passed) {
              handleQuizPass();
            } else {
              handleQuizClose();
            }
          }}
        />
      )}

      {/* Quiz Loading Overlay */}
      {quizLoading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] flex items-center justify-center">
          <div className="text-white text-center">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Preparazione test...</p>
          </div>
        </div>
      )}

      {/* Reactions Sheet - Who reacted */}
      <ReactionsSheet
        isOpen={showReactionsSheet}
        onClose={() => setShowReactionsSheet(false)}
        focusId={reactionsSheetItem?.id}
        focusType="daily"
      />

      {itemToShare && (
        <ShareSheet
          isOpen={showShareSheet}
          onClose={() => {
            setShowShareSheet(false);
            setItemToShare(null);
          }}
          onShareToFeed={() => handleShareWithGate(itemToShare, 'feed')}
          onShareToFriend={() => handleShareWithGate(itemToShare, 'friend')}
          onShareNatively={async () => {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const shareUrl = `${supabaseUrl}/functions/v1/share?id=${itemToShare.id}&type=il_punto`;
            const shareData = {
              title: `Il Punto di Oggi: ${itemToShare.title || 'NoParrot'}`,
              text: itemToShare.summary?.substring(0, 100) || '',
              url: shareUrl,
            };
            if (navigator.share && navigator.canShare?.(shareData)) {
              try { await navigator.share(shareData); } catch (err: any) {
                if (err instanceof Error && err.name !== 'AbortError') {
                  await navigator.clipboard.writeText(shareUrl);
                  toast.success('Link copiato!');
                }
              }
            } else {
              await navigator.clipboard.writeText(shareUrl);
              toast.success('Link copiato!');
            }
          }}
        />
      )}
    </div>
  );
};

export const ImmersiveEditorialCarousel = memo(ImmersiveEditorialCarouselInner);

// Format full timestamp: "14 GEN 2026 · 08:30"
const formatFullTimestamp = (createdAt?: string): string => {
  const date = new Date(createdAt || Date.now());
  const months = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
  const day = date.getDate().toString().padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day} ${month} ${year} · ${hours}:${minutes}`;
};

// Individual Editorial Slide Component
interface EditorialSlideProps {
  item: DailyFocus;
  index: number;
  isActive: boolean;
  totalSlides?: number;
  currentSlideIndex?: number;
  onDotClick?: (index: number) => void;
  onClick: () => void;
  onOpenInfoDialog: () => void;
  onShare?: () => void;
  onOpenSources?: () => void;
  onComment?: (item: DailyFocus) => void;
  reactionsData: { likes: number; likedByMe: boolean; myReactionType?: string | null } | null;
  isBookmarked?: boolean;
  onLike: (reactionType?: ReactionType) => void;
  onBookmark: () => void;
  onOpenReactionsSheet?: () => void;
}

const EditorialSlideInner = ({
  item,
  index,
  isActive,
  totalSlides = 0,
  currentSlideIndex = 0,
  onDotClick,
  onClick,
  onOpenInfoDialog,
  onShare,
  onOpenSources,
  onComment,
  reactionsData,
  isBookmarked,
  onLike,
  onBookmark,
  onOpenReactionsSheet,
}: EditorialSlideProps) => {
  // Track renders via ref increment (no useEffect deps issue)
  const renderCountRef = useRef(0);
  renderCountRef.current++;
  if (perfStore.getState().enabled) {
    perfStore.incrementEditorialSlide();
  }

  // Long press to open reaction picker (tap-to-select model)
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [currentReaction, setCurrentReaction] = useState<ReactionType | null>(null);
  const likeButtonRef = useRef<HTMLButtonElement>(null);
  const subBarRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [snapAlign, setSnapAlign] = useState<'start' | 'center'>('start');
  useLayoutEffect(() => {
    const el = boxRef.current; if (!el) return;
    const ro = new ResizeObserver(() => {
      setSnapAlign(el.offsetHeight <= window.innerHeight - 150 ? 'center' : 'start');
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lazy mount flag for ReactionPicker
  const hasMountedReactionPicker = useRef(false);
  if (showReactionPicker) hasMountedReactionPicker.current = true;

  const [isSmallScreen, setIsSmallScreen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerHeight < 700;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsSmallScreen(window.innerHeight < 700);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync currentReaction with server state (myReactionType) when reactionsData changes
  useEffect(() => {
    if (reactionsData?.myReactionType) {
      setCurrentReaction(reactionsData.myReactionType as ReactionType);
    } else if (!reactionsData?.likedByMe) {
      setCurrentReaction(null);
    }
  }, [reactionsData?.myReactionType, reactionsData?.likedByMe]);

  const likeHandlers = useLongPress({
    threshold: 450,
    onLongPress: () => setShowReactionPicker(true),
    onTap: () => {
      haptics.light();
      onLike('heart');
      setCurrentReaction(prev => prev ? null : 'heart');
    },
  });

  return (
    <div
      className="flex-[0_0_100%] min-w-0 flex-[1_0_auto] relative cursor-pointer transform-gpu will-change-transform flex flex-col"
      onClick={onClick}
    >
      <div
        ref={boxRef}
        className="relative z-10 w-full pointer-events-none"
        style={{
          margin: 'auto',
          width: 'calc(100% - 40px)',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.11)',
          background: 'linear-gradient(180deg, #0D1B2A 0%, #0A1420 100%)',  /* navy editoriale, NON vetro */
          boxShadow: '0 24px 60px -22px rgba(0,0,0,0.8)',
          overflow: 'visible',
          scrollSnapAlign: snapAlign,
          scrollMarginTop: 'calc(56px + env(safe-area-inset-top))',
          scrollMarginBottom: 'calc(88px + env(safe-area-inset-bottom))'
        }}
      >
        <CardShell>
        {/* Wrapper Header dentro il box */}
        <div className="relative z-50 pointer-events-none w-full px-[18px] pt-[16px]">
          {/* [Rail 1] HeaderRail: Fixed top overlay with gradient fade */}
          <CardShell.Header ref={headerRef}>
          <div className="flex justify-between items-start w-full pb-5">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ color: '#0A7AFF', border: '2px solid #0A7AFF', background: '#060E18' }}
              >
                <span className="text-xl font-bold mt-0.5">◉</span>
              </div>
              
              {/* Name & Meta */}
              <div className="flex flex-col">
                <span className="text-white font-semibold text-[15px] leading-tight flex items-center gap-1.5">
                  Il Punto
                  <svg className="w-3.5 h-3.5 text-[#0A7AFF] fill-current" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                </span>
                <span style={{ fontSize: '11px', color: '#7A8FA6' }}>
                  @ilpunto · {formatFullTimestamp(item.created_at)}
                </span>
              </div>
            </div>
          </div>
        </CardShell.Header>
        </div>

        {/* [Rail 2] ContentRail: Zone-mid */}
        <CardShell.Badge ref={badgeRef}>
          <UnifiedBadge kind="ai-synthesis">✦ AI Synthesis</UnifiedBadge>
        </CardShell.Badge>

        <CardShell.Mid ref={midRef} layoutMode="filled">
          <div className="w-full flex flex-col relative z-[1] pointer-events-auto flex-1 min-h-0">
            {/* Source Attribution Row with Info Icon as Subbar */}
            {item.sources?.length > 0 && (
              <div ref={subBarRef} className="il-punto-subbar">
                <span className="subbar-label">Analisi basata su:</span>
                <span className="font-semibold uppercase px-0.5">
                  {(item.sources[0] as any)?.name || new URL((item.sources[0] as any)?.url || 'https://fonte').hostname.replace('www.', '')}
                </span>
                {item.sources.length > 1 && (
                  <span>+ {item.sources.length - 1}</span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenInfoDialog();
                  }}
                  className="ml-0.5 text-white/40 hover:text-white transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Headline - Impact Font with exact sizes */}
            <ClampedTitle
              text={item.title}
              maxLines={isSmallScreen ? 2 : 3}
              as="h1"
              style={{
                fontFamily: "'Anton', 'Impact', sans-serif",
                fontSize: 'clamp(26px, 7.2vw, 33px)',
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                color: 'rgba(255,255,255,0.92)',
                textTransform: 'uppercase'
              }}
              className="mb-2"
            />

            {/* Abstract/Lead */}
            {(() => {
              const fullText = item.summary.replace(/\[SOURCE:[\d,\s]+\]/g, "").trim();
              const maxInitialLength = isSmallScreen ? 120 : 160;
              const needsTruncation = fullText.length > maxInitialLength;
              const displayText = needsTruncation ? fullText.substring(0, maxInitialLength).trim() : fullText;
              
              return (
                <div className="mb-3">
                  <p 
                    style={{ fontSize: '14px', color: '#7A8FA6', lineHeight: 1.55 }}
                    className="inline"
                  >
                    {displayText}
                  </p>
                  {needsTruncation && (
                    <div className="mt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onClick();
                        }}
                        className="text-sm font-bold text-[#0A7AFF] cursor-pointer hover:underline transition-all outline-none"
                      >
                        Approfondisci
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Fonti as Compact Tags */}
            {item.sources && item.sources.length > 0 && (
              <div className="mb-3 pointer-events-auto flex flex-wrap gap-2">
                {item.sources.slice(0, isSmallScreen ? 3 : 5).map((source: any, idx: number) => {
                  const colors = ['#0A7AFF', '#E41E52', '#FFD464', '#10B981', '#A78BFA'];
                  const barColor = colors[idx % colors.length];
                  const domainName = (source.name || new URL(source.url || 'https://link').hostname).replace('www.', '');
                  
                  return (
                    <button 
                      key={idx}
                      onClick={(e) => {
                         e.stopPropagation();
                         if (source.url) window.open(source.url, '_blank');
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border outline-none hover:bg-white/10 transition-colors"
                      style={{ 
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderColor: 'rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      <div style={{ width: '3px', height: '12px', borderRadius: '1.5px', backgroundColor: barColor, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#E2EAF4', textTransform: 'uppercase', letterSpacing: '0.02em', fontWeight: 600 }}>
                        {domainName}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </CardShell.Mid>

        {/* [Rail 3] ActionRail: Zone-bottom */}
        <CardShell.Bottom ref={bottomRef} className="flex flex-col">
          {/* Pagination Dots */}
          {totalSlides > 1 && (
            <div className="flex justify-center w-full pointer-events-auto mb-1">
              <div className="flex items-center gap-2 p-1.5 rounded-full bg-white/5 border border-white/10">
                {Array.from({ length: totalSlides }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDotClick?.(idx);
                    }}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      idx === currentSlideIndex
                        ? "bg-white w-6"
                        : "bg-white/40 w-1.5 hover:bg-white/60"
                    )}
                    aria-label={`Vai alla slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          )}


        </CardShell.Bottom>
      </CardShell>

      {/* ═══ RAIL AZIONI VERTICALE — Il Punto (stile mockup: icone + contatori/etichette) ═══ */}
      <div
        className="absolute right-[-20px] top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-[18px] pointer-events-auto"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {/* ── Like (long-press → reaction picker) ── */}
        <div className="flex flex-col items-center gap-[3px]">
          <button
            ref={likeButtonRef}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] select-none no-ios-callout"
            style={{ WebkitTapHighlightColor: 'transparent', filter: 'drop-shadow(0 2px 7px rgba(0,0,0,0.8))' }}
            {...likeHandlers}
            onClick={(e) => e.stopPropagation()}
          >
            {currentReaction && currentReaction !== 'heart' ? (
              <span className="text-2xl transition-transform active:scale-90">
                {reactionToEmoji(currentReaction)}
              </span>
            ) : (
              <Heart className={cn("w-7 h-7", reactionsData?.likedByMe ? "text-red-500 fill-red-500" : "text-white")} fill={reactionsData?.likedByMe ? "currentColor" : "none"} />
            )}
          </button>
          <span
            className="select-none"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
          >
            {reactionsData?.likes ?? item.reactions?.likes ?? 0}
          </span>
        </div>

        {/* ── Commenti ── */}
        <button
          className="flex flex-col items-center gap-[3px] select-none"
          onClick={(e) => { e.stopPropagation(); haptics.light(); onComment?.(item); }}
        >
          <MessageCircle className="w-7 h-7 text-white" style={{ filter: 'drop-shadow(0 2px 7px rgba(0,0,0,0.8))' }} />
          <span
            className="select-none"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
          >
            {item.reactions?.comments || 0}
          </span>
        </button>

        {/* ── Salva ── */}
        <button
          className="flex flex-col items-center gap-[3px] min-w-[44px]"
          onClick={(e) => { e.stopPropagation(); onBookmark?.(); }}
        >
          <Bookmark className={cn("w-7 h-7", isBookmarked ? "text-blue-400 fill-blue-400" : "text-white")} fill={isBookmarked ? "currentColor" : "none"} style={{ filter: 'drop-shadow(0 2px 7px rgba(0,0,0,0.8))' }} />
          <span
            className="select-none"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
          >
            Salva
          </span>
        </button>

        {/* ── Invia ── */}
        <button
          className="flex flex-col items-center gap-[3px] min-w-[44px]"
          onClick={(e) => { e.stopPropagation(); haptics.light(); onShare?.(); }}
        >
          <svg
            width="22" height="22" viewBox="0 0 26 26" fill="none"
            stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 2px 7px rgba(0,0,0,0.8))' }}
          >
            <path d="M23 4L10 15M23 4l-8 20-3.5-8.5L3 12z" />
          </svg>
          <span
            className="select-none"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
          >
            Invia
          </span>
        </button>

        {/* Reaction picker — spostato nel rail, ref invariati */}
        {hasMountedReactionPicker.current && (
          <ReactionPicker
            isOpen={showReactionPicker}
            onClose={() => setShowReactionPicker(false)}
            onSelect={(type) => {
              setCurrentReaction(type);
              onLike(type);
              setShowReactionPicker(false);
            }}
            currentReaction={currentReaction}
            triggerRef={likeButtonRef}
          />
        )}
      </div>
      </div> {/* Chiude Box Flottante */}
    </div>
  );
};

// Memoize slide component for rerender optimization
const EditorialSlide = memo(EditorialSlideInner);
EditorialSlide.displayName = 'EditorialSlide';

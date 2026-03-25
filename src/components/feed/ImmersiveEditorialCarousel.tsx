import React, { useState, useCallback, useEffect, useRef, memo } from "react";
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
  const handleShareWithGate = async (item: DailyFocus) => {
    if (!user) {
      toast.error("Devi effettuare il login per condividere");
      return;
    }

    pendingShareItemRef.current = item;

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
    <div className="h-[100dvh] w-full snap-start relative flex flex-col overflow-hidden">
      {/* Editorial Background - Deep urban gradient */}
      {/* Editorial Background - Deep urban gradient */}
      <div className="absolute inset-0 bg-immersive z-0" />

      {/* Urban concrete texture - GPU-friendly static PNG */}
      <div className="absolute inset-0 z-[1] opacity-[0.06] pointer-events-none mix-blend-overlay urban-noise-overlay" />

      {/* Vignette effect on edges */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, var(--immersive-muted) 100%)',
          opacity: 0.5
        }}
      />

      {/* Theme-aware cinematic fade overlay - top/bottom */}
      <div className="absolute inset-0 z-[3] pointer-events-none cinematic-fade-overlay" />

      {/* Content Layer */}
      <div className="relative z-10 w-full h-full flex flex-col">

        {/* Carousel Container */}
        <div
          ref={emblaRef}
          className="flex-1 overflow-hidden touch-pan-y"
        >
          <div className="flex h-full">
            {items.map((item, index) => (
              <EditorialSlide
                key={item.id}
                item={item}
                index={index}
                isActive={index === selectedIndex}
                onClick={() => handleCardClick(item)}
                onOpenInfoDialog={() => setInfoDialogOpen(true)}
                onShare={() => handleShareWithGate(item)}
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

      {/* Pagination Dots - Overlay on bottom - FIXED POSITION */}
      {items.length > 1 && (
        <div className="absolute bottom-24 left-0 right-0 z-50 flex justify-center pb-[env(safe-area-inset-bottom)] pointer-events-none">
          <div className="flex items-center gap-2 p-1.5 rounded-full bg-white/90 dark:bg-black/40 backdrop-blur-md shadow-sm dark:shadow-lg border border-slate-200 dark:border-white/10 pointer-events-auto">
            {items.map((_, index) => (
              <button
                key={index}
                onClick={() => emblaApi?.scrollTo(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 shadow-sm",
                  index === selectedIndex
                    ? "bg-slate-900 dark:bg-white w-6"
                    : "bg-slate-300 dark:bg-white/40 w-1.5 hover:bg-slate-400 dark:hover:bg-white/60"
                )}
                aria-label={`Vai alla slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}

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

  // Long press for reaction picker with drag-to-select
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [currentReaction, setCurrentReaction] = useState<ReactionType | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const likeButtonRef = useRef<HTMLButtonElement>(null);

  // Sync currentReaction with server state (myReactionType) when reactionsData changes
  useEffect(() => {
    if (reactionsData?.myReactionType) {
      setCurrentReaction(reactionsData.myReactionType as ReactionType);
    } else if (!reactionsData?.likedByMe) {
      setCurrentReaction(null);
    }
  }, [reactionsData?.myReactionType, reactionsData?.likedByMe]);

  const likeHandlers = useLongPress({
    onLongPress: () => setShowReactionPicker(true),
    onTap: () => {
      haptics.light();
      onLike('heart');
      // Optimistically update local state
      setCurrentReaction(prev => prev ? null : 'heart');
    },
    onMove: (x, y) => setDragPosition({ x, y }),
    onRelease: () => setDragPosition(null),
  });

  return (
    <div
      className="flex-[0_0_100%] min-w-0 h-full px-6 cursor-pointer"
      onClick={onClick}
    >
      <div className="h-full flex flex-col justify-center py-4">

        {/* Main Content Area - Editorial Edition Layout */}
        <div className="flex flex-col relative">
          {/* Soft glow vignette behind headline */}
          <div className="absolute inset-0 flex items-start justify-center pointer-events-none">
            <div className="w-[80%] h-[200px] bg-noparrot-blue/5 rounded-full blur-3xl mt-8" />
          </div>

          {/* Content */}
          <div className="relative z-10">
            {/* Author Row - Il Punto Brand */}
            <div className="flex items-center justify-between mb-4">
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

              {/* AI Synthesis Badge */}
              <div 
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm"
                style={{ background: 'rgba(10,122,255,0.12)', border: '1px solid rgba(10,122,255,0.2)' }}
              >
                <Sparkles size={12} color="#0A7AFF" />
                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#0A7AFF' }}>
                  AI SYNTHESIS
                </span>
              </div>
            </div>

            {/* Source Attribution Row with Info Icon */}
            {item.sources?.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white/5 inline-flex self-start px-2 py-1 rounded-md mb-3 border border-white/5">
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#7A8FA6' }}>
                  Analisi basata su:
                </span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#E2EAF4' }} className="font-semibold uppercase px-0.5">
                  {(item.sources[0] as any)?.name || new URL((item.sources[0] as any)?.url || 'https://fonte').hostname.replace('www.', '')}
                </span>
                {item.sources.length > 1 && (
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#7A8FA6' }}>
                    + {item.sources.length - 1} {item.sources.length - 1 === 1 ? 'fonte aggiuntiva' : 'fonti aggiuntive'}
                  </span>
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
            <h1 
              style={{
                fontFamily: 'Impact, sans-serif',
                fontSize: 'clamp(26px, 6.5vw, 36px)',
                lineHeight: 0.95,
                letterSpacing: '-0.02em',
                color: '#FFFFFF',
                textTransform: 'uppercase'
              }}
              className="mb-3 drop-shadow-xl line-clamp-2"
            >
              {item.title}
            </h1>

            {/* Abstract/Lead */}
            <p 
              style={{ fontSize: '14px', color: '#7A8FA6', lineHeight: 1.55 }}
              className="mb-5 line-clamp-3"
            >
              {item.summary.replace(/\[SOURCE:[\d,\s]+\]/g, "").trim()}
            </p>

            {/* Blocco Fonti (max 5) - V2 */}
            {item.sources && item.sources.length > 0 && (
              <div 
                className="mb-6 pointer-events-auto flex flex-col"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}
              >
                {item.sources.slice(0, 5).map((source: any, idx: number, arr: any[]) => {
                  const colors = ['#0A7AFF', '#E41E52', '#FFD464', '#10B981', '#A78BFA'];
                  const barColor = colors[idx % colors.length];
                  const domainName = (source.name || new URL(source.url || 'https://link').hostname).replace('www.', '');
                  const headline = source.title || source.headline || source.description;
                  
                  return (
                    <button 
                      key={idx}
                      onClick={(e) => {
                         e.stopPropagation();
                         if (source.url) window.open(source.url, '_blank');
                      }}
                      className="w-full flex items-center group hover:bg-white/5 transition-all outline-none"
                      style={{ 
                        borderBottom: idx !== arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        padding: '10px 12px'
                      }}
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        <div style={{ width: '3px', height: '24px', borderRadius: '2px', backgroundColor: barColor, flexShrink: 0 }} />
                        <div className="flex flex-col items-start px-3 min-w-0 flex-1">
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '9px', color: '#7A8FA6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {domainName}
                          </span>
                          {headline && (
                            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#E2EAF4', width: '100%', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                              {headline}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ color: '#7A8FA6', fontSize: '12px', flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Action Bar - Aligned with ImmersivePostCard */}
            <div className="flex items-center justify-between gap-6">
              {/* Primary Share Button - Pill shape with consistent height */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShare?.();
                }}
                className="h-11 px-5 bg-blue-50 hover:bg-blue-100 dark:bg-white dark:hover:bg-gray-200 text-blue-600 dark:text-[#1F3347] font-bold rounded-full shadow-sm dark:shadow-md border border-blue-100 dark:border-transparent flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Logo variant="icon" size="sm" className="h-5 w-5" />
                <span className="text-sm font-semibold leading-none">Condividi</span>
                {(item.reactions?.shares ?? 0) > 0 && (
                  <span className="text-xs opacity-70">({item.reactions?.shares})</span>
                )}
              </button>

              {/* Action Icons - Uniform w-6 h-6, aligned on same axis */}
              <div
                className="flex items-center gap-4 h-11 action-bar-zone bg-slate-100 px-4 rounded-full shadow-sm border border-slate-200 dark:bg-transparent dark:px-0 dark:rounded-none dark:shadow-none dark:border-none transition-all"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >

                {/* Like with long press for reaction picker */}
                <div className="relative flex items-center justify-center gap-1.5 h-full">
                  <button
                    ref={likeButtonRef}
                    className="flex items-center justify-center h-full select-none"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    {...likeHandlers}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Dynamic icon: show emoji if non-heart reaction, otherwise Heart icon */}
                    {currentReaction && currentReaction !== 'heart' ? (
                      <span className="text-xl transition-transform active:scale-90">
                        {reactionToEmoji(currentReaction)}
                      </span>
                    ) : (
                      <Heart
                        className={cn(
                          "w-6 h-6 transition-transform active:scale-90",
                          reactionsData?.likedByMe ? "text-red-500 fill-red-500" : "text-slate-700 dark:text-immersive-foreground"
                        )}
                        fill={reactionsData?.likedByMe ? "currentColor" : "none"}
                      />
                    )}
                  </button>
                  {/* Count - clickable to open reactions drawer, select-none prevents text selection */}
                  <button
                    className="text-sm font-bold text-slate-700 dark:text-immersive-foreground hover:text-black dark:hover:text-immersive-foreground/80 transition-colors select-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      const likesCount = reactionsData?.likes ?? item.reactions?.likes ?? 0;
                      if (likesCount > 0) {
                        onOpenReactionsSheet?.();
                      }
                    }}
                  >
                    {reactionsData?.likes ?? item.reactions?.likes ?? 0}
                  </button>

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
                    dragPosition={dragPosition}
                    onDragRelease={() => setDragPosition(null)}
                  />
                </div>

                {/* Reaction Summary - Show who reacted */}
                {(reactionsData?.likes ?? 0) > 0 && (
                  <ReactionSummary
                    reactions={[{ type: 'heart' as ReactionType, count: reactionsData?.likes ?? 0 }]}
                    totalCount={reactionsData?.likes ?? 0}
                    onClick={() => onOpenReactionsSheet?.()}
                    showCount={false}
                  />
                )}

                {/* Comments - select-none prevents text selection on long-press */}
                <button
                  className="flex items-center justify-center gap-1.5 h-full select-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    haptics.light();
                    onComment?.(item);
                  }}
                >
                  <MessageCircle className="w-6 h-6 text-slate-700 dark:text-immersive-foreground transition-transform active:scale-90" />
                  <span className="text-sm font-bold text-slate-700 dark:text-immersive-foreground select-none">
                    {item.reactions?.comments ?? 0}
                  </span>
                </button>

                {/* Bookmark */}
                <button
                  className="flex items-center justify-center h-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    haptics.light();
                    onBookmark();
                  }}
                >
                  <Bookmark
                    className={cn(
                      "w-6 h-6 transition-transform active:scale-90",
                      isBookmarked ? "text-blue-400 fill-blue-400" : "text-slate-700 dark:text-immersive-foreground"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Memoize slide component for rerender optimization
const EditorialSlide = memo(EditorialSlideInner);
EditorialSlide.displayName = 'EditorialSlide';

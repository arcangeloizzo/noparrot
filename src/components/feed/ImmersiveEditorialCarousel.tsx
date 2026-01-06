import React, { useState, useCallback, useEffect, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Heart, MessageCircle, Bookmark, Info, ShieldCheck } from "lucide-react";
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
  DialogTrigger,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { DailyFocus } from "@/hooks/useDailyFocus";
import { SourceReaderGate } from "@/components/composer/SourceReaderGate";
import { SourceWithGate } from "@/lib/comprehension-gate-extended";
import { QuizModal } from "@/components/ui/quiz-modal";
import { SourcesDrawer } from "@/components/feed/SourcesDrawer";
import { supabase } from "@/integrations/supabase/client";

interface ImmersiveEditorialCarouselProps {
  items: DailyFocus[];
  totalCount: number; // Total editorials in DB for correct numbering
  onItemClick?: (item: DailyFocus) => void;
  onComment?: (item: DailyFocus) => void;
  onShare?: (item: DailyFocus) => void;
  onShareComplete?: (item: DailyFocus) => void; // Called after gate passed
}

export const ImmersiveEditorialCarousel = ({
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

  // Reactions for active item
  const { user } = useAuth();
  const { data: reactionsData } = useFocusReactions(activeItem?.id || "", "daily");
  const toggleReaction = useToggleFocusReaction();
  
  // Bookmarks for active item
  const { data: isBookmarked } = useFocusBookmark(activeItem?.id || "", "daily");
  const toggleBookmark = useToggleFocusBookmark();

  // Dialog states - OUTSIDE carousel to avoid layout shifts
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [trustDialogOpen, setTrustDialogOpen] = useState(false);
  const suppressUntilRef = React.useRef(0);

  // Sources drawer state
  const [sourcesDrawerOpen, setSourcesDrawerOpen] = useState(false);
  const [sourcesDrawerItem, setSourcesDrawerItem] = useState<DailyFocus | null>(null);

  // Comprehension Gate state for editorial share
  const [showReader, setShowReader] = useState(false);
  const [readerSource, setReaderSource] = useState<SourceWithGate | null>(null);
  const [readerClosing, setReaderClosing] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizData, setQuizData] = useState<{ questions: any[]; focusId?: string } | null>(null);
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
    if (infoDialogOpen || trustDialogOpen) return;
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
      summary: cleanContent.substring(0, 200), // Short summary only
      platform: 'article',
      contentQuality: 'complete',
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
            questions: data.questions,
            focusId: item.id
          });
          setShowQuiz(true);
        } else {
          // No quiz needed, proceed directly
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
    setShowQuiz(false);
    setQuizData(null);
    pendingShareItemRef.current = null;
  };

  if (!items.length) return null;

  const activeTrustScore = activeItem?.trust_score;

  return (
    <div className="h-[100dvh] w-full snap-start relative flex flex-col overflow-hidden">
      {/* Editorial Background with noise texture */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0D1B2A] via-[#1B263B] to-[#0E141A] z-0" />
      
      {/* Subtle noise texture overlay */}
      <div 
        className="absolute inset-0 z-[1] opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content Layer */}
      <div className="relative z-10 w-full h-full flex flex-col pt-14 pb-24">
        
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
                totalCount={totalCount}
                isActive={index === selectedIndex}
                onClick={() => handleCardClick(item)}
                onOpenInfoDialog={() => setInfoDialogOpen(true)}
                onOpenTrustDialog={() => setTrustDialogOpen(true)}
                onShare={() => handleShareWithGate(item)}
                onOpenSources={() => handleOpenSources(item)}
                onComment={onComment}
                reactionsData={index === selectedIndex ? reactionsData : null}
                isBookmarked={index === selectedIndex ? isBookmarked : false}
                onLike={() => {
                  if (!user) {
                    toast.error("Devi effettuare il login per mettere like");
                    return;
                  }
                  toggleReaction.mutate({ focusId: item.id, focusType: "daily" });
                }}
                onBookmark={() => {
                  if (!user) {
                    toast.error("Devi effettuare il login per salvare");
                    return;
                  }
                  toggleBookmark.mutate({ focusId: item.id, focusType: "daily" });
                }}
              />
            ))}
          </div>
        </div>

        {/* Pagination Dots */}
        {items.length > 1 && (
          <div className="flex items-center justify-center gap-2 py-4">
            {items.map((_, index) => (
              <button
                key={index}
                onClick={() => emblaApi?.scrollTo(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  index === selectedIndex
                    ? "bg-white w-6"
                    : "bg-white/30 hover:bg-white/50"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info Dialog - OUTSIDE carousel to prevent layout shifts */}
      <Dialog 
        open={infoDialogOpen} 
        onOpenChange={(open) => {
          setInfoDialogOpen(open);
          handleDialogChange(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cos'è Il Punto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Questo contenuto è una sintesi automatica generata da NoParrot usando fonti pubbliche.</p>
            <p>Serve per offrire un contesto comune da cui partire per la discussione.</p>
            <p className="font-medium text-foreground">Non rappresenta una posizione ufficiale né una verifica dei fatti.</p>
          </div>
          <DialogClose asChild>
            <button className="w-full mt-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors">
              Chiudi
            </button>
          </DialogClose>
        </DialogContent>
      </Dialog>

      {/* Trust Score Dialog - OUTSIDE carousel to prevent layout shifts */}
      <Dialog 
        open={trustDialogOpen} 
        onOpenChange={(open) => {
          setTrustDialogOpen(open);
          handleDialogChange(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trust Score - Il Punto</DialogTitle>
            <DialogDescription>
              Informazioni sull'affidabilità delle fonti
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              Questo contenuto è generato aggregando <strong className="text-foreground">fonti giornalistiche verificate</strong> e autorevoli.
            </p>
            <p>
              Il Trust Score "{activeTrustScore?.toUpperCase() || 'MEDIO'}" indica che le fonti utilizzate hanno un buon track record di affidabilità editoriale.
            </p>
            <div className="pt-3 border-t border-border">
              <p className="font-medium text-foreground mb-2">Come viene calcolato:</p>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Analisi automatica delle fonti citate</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Verifica della reputazione editoriale</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Coerenza tra titolo e contenuto</span>
                </li>
              </ul>
            </div>
            <p className="text-xs pt-2 border-t border-border text-muted-foreground">
              Nota: non è fact-checking. Valuta l'affidabilità delle fonti, non la verità assoluta.
            </p>
          </div>
          <DialogClose asChild>
            <button className="w-full mt-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors">
              Chiudi
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
          onSubmit={async (answers) => {
            // SECURITY HARDENED: All validation via submit-qa edge function
            const sourceUrl = `focus://daily/${quizData.focusId}`;
            
            try {
              const { data, error } = await supabase.functions.invoke('submit-qa', {
                body: {
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
    </div>
  );
};

// Individual Editorial Slide Component - Simplified, dialogs moved to parent
interface EditorialSlideProps {
  item: DailyFocus;
  index: number;
  totalCount: number; // Total editorials in DB for correct numbering
  isActive: boolean;
  onClick: () => void;
  onOpenInfoDialog: () => void;
  onOpenTrustDialog: () => void;
  onShare?: () => void;
  onOpenSources?: () => void;
  onComment?: (item: DailyFocus) => void;
  reactionsData: { likes: number; likedByMe: boolean } | null;
  isBookmarked?: boolean;
  onLike: () => void;
  onBookmark: () => void;
}

// Format edition time: "2:30 pm | gen 04"
const formatEditionTime = (editionTime?: string, createdAt?: string): string => {
  if (!editionTime && !createdAt) return 'edizione di oggi';
  
  const date = new Date(createdAt || Date.now());
  const months = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const month = months[date.getMonth()];
  const day = date.getDate().toString().padStart(2, '0');
  
  if (editionTime) {
    return `${editionTime} | ${month} ${day}`;
  }
  
  // Fallback: format from created_at
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${ampm} | ${month} ${day}`;
};

const EditorialSlide = ({
  item,
  index,
  totalCount,
  isActive,
  onClick,
  onOpenInfoDialog,
  onOpenTrustDialog,
  onShare,
  onOpenSources,
  onComment,
  reactionsData,
  isBookmarked,
  onLike,
  onBookmark,
}: EditorialSlideProps) => {
  const trustScore = item.trust_score;
  // Correct numbering: latest item (index 0) gets totalCount, second gets totalCount-1, etc.
  const displayNumber = totalCount - index;

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
            <div className="w-[80%] h-[200px] bg-[#0A7AFF]/5 rounded-full blur-3xl mt-8" />
          </div>

          {/* Content */}
          <div className="relative z-10">
            {/* Edition Number - GRANDE, tipografico, elegante */}
            <span className="text-6xl sm:text-7xl font-extralight text-white/25 tracking-tighter mb-2 block font-serif">
              #{displayNumber}
            </span>

            {/* Headline - Elemento più leggibile */}
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-3 drop-shadow-xl">
              {item.title}
            </h1>

            {/* Editorial Byline - sotto il titolo, stile testata */}
            <div className="flex items-center gap-2 text-white/60 mb-4">
              <span className="text-sm font-medium tracking-wide font-mono">
                ◉ IL PUNTO
              </span>
              <span className="text-white/30">·</span>
              <span className="text-xs font-medium tracking-wider text-white/50">
                {formatEditionTime(item.edition_time, item.created_at)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenInfoDialog();
                }}
                className="ml-1 hover:text-white/80 transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Abstract/Lead - Preview della notizia */}
            <p className="text-base sm:text-lg text-white/70 leading-relaxed line-clamp-3 mb-5">
              {item.summary.replace(/\[SOURCE:[\d,\s]+\]/g, "")}
            </p>

            {/* Sources + Trust Badge Row - Sigilli discreti */}
            <div className="flex items-center justify-between mb-6">
              {/* Sources Tag */}
              {item.sources?.length > 0 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSources?.();
                  }}
                  className="inline-flex items-center px-3 py-1.5 bg-white/5 backdrop-blur-md rounded-full text-xs text-white/60 font-medium border border-white/5 hover:bg-white/10 transition-colors"
                >
                  {item.sources[0]?.name?.toLowerCase() || "fonti"}
                  {item.sources.length > 1 && ` +${item.sources.length - 1}`}
                </button>
              )}

              {/* Trust Badge - Sigillo piccolo, non prominente */}
              {trustScore && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTrustDialog();
                  }}
                  className={cn(
                    "h-6 flex items-center gap-1 px-2 rounded-full text-[9px] uppercase tracking-wider font-bold border",
                    trustScore.toLowerCase() === "alto" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                    trustScore.toLowerCase() === "medio" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                    trustScore.toLowerCase() === "basso" && "bg-red-500/10 text-red-400 border-red-500/20"
                  )}
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>TRUST {trustScore.toUpperCase()}</span>
                </button>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between gap-3">
              {/* Primary Share Button */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onShare?.();
                }}
                className="h-10 px-4 bg-white hover:bg-gray-50 text-[#1F3347] font-bold rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Logo variant="icon" size="sm" className="h-4 w-4" />
                <span className="text-sm font-semibold leading-none">Condividi</span>
              </button>

              {/* Reactions */}
              <div className="flex items-center gap-1 bg-black/20 backdrop-blur-xl h-10 px-3 rounded-2xl border border-white/5">
                
                {/* Like */}
                <button 
                  className="flex items-center justify-center gap-1.5 h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLike();
                  }}
                >
                  <Heart 
                    className={cn(
                      "w-5 h-5",
                      reactionsData?.likedByMe ? "text-red-500 fill-red-500" : "text-white"
                    )}
                    fill={reactionsData?.likedByMe ? "currentColor" : "none"}
                  />
                  <span className="text-xs font-bold text-white">
                    {reactionsData?.likes ?? item.reactions?.likes ?? 0}
                  </span>
                </button>

                {/* Comments */}
                <button 
                  className="flex items-center justify-center gap-1.5 h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onComment?.(item);
                  }}
                >
                  <MessageCircle className="w-5 h-5 text-white" />
                  <span className="text-xs font-bold text-white">
                    {item.reactions?.comments ?? 0}
                  </span>
                </button>

                {/* Bookmark */}
                <button 
                  className="flex items-center justify-center h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBookmark();
                  }}
                >
                  <Bookmark 
                    className={cn(
                      "w-5 h-5",
                      isBookmarked ? "text-brand-pink fill-brand-pink" : "text-white"
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

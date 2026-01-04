import React, { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Heart, MessageCircle, Bookmark, Info, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusReactions, useToggleFocusReaction } from "@/hooks/useFocusReactions";
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

interface ImmersiveEditorialCarouselProps {
  items: DailyFocus[];
  onItemClick?: (item: DailyFocus) => void;
  onComment?: (item: DailyFocus) => void;
  onShare?: (item: DailyFocus) => void;
}

export const ImmersiveEditorialCarousel = ({
  items,
  onItemClick,
  onComment,
  onShare,
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

  // Dialog states - OUTSIDE carousel to avoid layout shifts
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [trustDialogOpen, setTrustDialogOpen] = useState(false);
  const suppressUntilRef = React.useRef(0);

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
                totalItems={items.length}
                isActive={index === selectedIndex}
                onClick={() => handleCardClick(item)}
                onOpenInfoDialog={() => setInfoDialogOpen(true)}
                onOpenTrustDialog={() => setTrustDialogOpen(true)}
                onShare={onShare}
                onComment={onComment}
                reactionsData={index === selectedIndex ? reactionsData : null}
                onLike={() => {
                  if (!user) {
                    toast.error("Devi effettuare il login per mettere like");
                    return;
                  }
                  toggleReaction.mutate({ focusId: item.id, focusType: "daily" });
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
    </div>
  );
};

// Individual Editorial Slide Component - Simplified, dialogs moved to parent
interface EditorialSlideProps {
  item: DailyFocus;
  index: number;
  totalItems: number;
  isActive: boolean;
  onClick: () => void;
  onOpenInfoDialog: () => void;
  onOpenTrustDialog: () => void;
  onShare?: (item: DailyFocus) => void;
  onComment?: (item: DailyFocus) => void;
  reactionsData: { likes: number; likedByMe: boolean } | null;
  onLike: () => void;
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
  totalItems,
  isActive,
  onClick,
  onOpenInfoDialog,
  onOpenTrustDialog,
  onShare,
  onComment,
  reactionsData,
  onLike,
}: EditorialSlideProps) => {
  const trustScore = item.trust_score;
  // Reverse numbering: latest item (index 0) gets highest number
  const displayNumber = totalItems - index;

  return (
    <div 
      className="flex-[0_0_100%] min-w-0 h-full px-6 cursor-pointer"
      onClick={onClick}
    >
      <div className="h-full flex flex-col justify-center py-4">
        
        {/* Masthead Row */}
        <div className="flex justify-between items-center mb-8">
          {/* Editorial Masthead - Now just a button that opens parent dialog */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenInfoDialog();
            }}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-opacity"
          >
            <span className="text-xs font-bold tracking-[0.2em] uppercase">IL PUNTO</span>
            <span className="text-white/40">·</span>
            <span className="text-[10px] font-medium tracking-wider uppercase text-white/50">
              {formatEditionTime(item.edition_time, item.created_at)}
            </span>
            <Info className="w-3.5 h-3.5 ml-1 text-white/40" />
          </button>

          {/* Trust Score - Now just a button that opens parent dialog */}
          {trustScore && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onOpenTrustDialog();
              }}
              className={cn(
                "h-8 flex items-center gap-1.5 bg-black/30 backdrop-blur-xl border border-white/10 px-3 rounded-full cursor-pointer hover:bg-black/40 transition-colors whitespace-nowrap",
                trustScore.toLowerCase() === "alto" && "text-emerald-400",
                trustScore.toLowerCase() === "medio" && "text-amber-400",
                trustScore.toLowerCase() === "basso" && "text-red-400"
              )}
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-bold tracking-wider uppercase">
                TRUST {trustScore.toUpperCase()}
              </span>
            </button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col relative">
          {/* Soft glow vignette behind headline */}
          <div className="absolute inset-0 flex items-start justify-center pointer-events-none">
            <div className="w-[80%] h-[200px] bg-[#0A7AFF]/5 rounded-full blur-3xl mt-8" />
          </div>

          {/* Content */}
          <div className="relative z-10">
            {/* Chapter Number - Prominent, visible */}
            <span className="text-3xl font-black text-white/70 tracking-tight mb-3 block">
              #{displayNumber}
            </span>

            {/* Headline */}
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-4 drop-shadow-xl">
              {item.title}
            </h1>

            {/* Abstract/Lead with fade */}
            <p className="text-base sm:text-lg text-white/70 leading-relaxed line-clamp-3 mb-4">
              {item.summary.replace(/\[SOURCE:[\d,\s]+\]/g, "")}
            </p>

            {/* Sources Tag */}
            {item.sources?.length > 0 && (
              <div className="flex items-center mb-6">
                <button 
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center px-3 py-1.5 bg-white/5 backdrop-blur-md rounded-full text-xs text-white/60 font-medium border border-white/5 hover:bg-white/10 transition-colors"
                >
                  {item.sources[0]?.name?.toLowerCase() || "fonti"}
                  {item.sources.length > 1 && ` +${item.sources.length - 1}`}
                </button>
              </div>
            )}

            {/* Action Bar - Integrated with content */}
            <div className="flex items-center justify-between gap-3">
              {/* Primary Share Button */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onShare?.(item);
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
                    toast.info("Funzionalità in arrivo");
                  }}
                >
                  <Bookmark className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

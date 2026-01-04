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

  // Dialog states
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
                infoDialogOpen={infoDialogOpen}
                setInfoDialogOpen={setInfoDialogOpen}
                trustDialogOpen={trustDialogOpen}
                setTrustDialogOpen={setTrustDialogOpen}
                onDialogChange={handleDialogChange}
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

        {/* Bottom Actions - Always reflects active item */}
        <div className="flex items-center justify-between gap-3 px-6">
          
          {/* Primary Share Button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onShare?.(activeItem);
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
                if (!user) {
                  toast.error("Devi effettuare il login per mettere like");
                  return;
                }
                toggleReaction.mutate({ focusId: activeItem.id, focusType: "daily" });
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
                {reactionsData?.likes ?? activeItem.reactions?.likes ?? 0}
              </span>
            </button>

            {/* Comments */}
            <button 
              className="flex items-center justify-center gap-1.5 h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onComment?.(activeItem);
              }}
            >
              <MessageCircle className="w-5 h-5 text-white" />
              <span className="text-xs font-bold text-white">
                {activeItem.reactions?.comments ?? 0}
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
  );
};

// Individual Editorial Slide Component
interface EditorialSlideProps {
  item: DailyFocus;
  index: number;
  totalItems: number;
  isActive: boolean;
  onClick: () => void;
  infoDialogOpen: boolean;
  setInfoDialogOpen: (open: boolean) => void;
  trustDialogOpen: boolean;
  setTrustDialogOpen: (open: boolean) => void;
  onDialogChange: (open: boolean) => void;
}

const EditorialSlide = ({
  item,
  index,
  totalItems,
  isActive,
  onClick,
  infoDialogOpen,
  setInfoDialogOpen,
  trustDialogOpen,
  setTrustDialogOpen,
  onDialogChange,
}: EditorialSlideProps) => {
  const trustScore = item.trust_score;

  return (
    <div 
      className="flex-[0_0_100%] min-w-0 h-full px-6 cursor-pointer"
      onClick={onClick}
    >
      <div className="h-full flex flex-col justify-between py-4">
        
        {/* Top Bar */}
        <div className="flex justify-between items-center">
          {/* IL PUNTO Badge */}
          <Dialog 
            open={infoDialogOpen} 
            onOpenChange={(open) => {
              setInfoDialogOpen(open);
              onDialogChange(open);
            }}
          >
            <DialogTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="h-8 inline-flex items-center gap-2 px-3 rounded-full backdrop-blur-xl border cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap bg-[#0A7AFF]/20 border-[#0A7AFF]/30 text-[#0A7AFF]"
              >
                <span className="text-xs font-bold tracking-wide">IL PUNTO</span>
                <Info className="w-3.5 h-3.5" />
              </button>
            </DialogTrigger>
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

          {/* Trust Score */}
          {trustScore && (
            <Dialog 
              open={trustDialogOpen} 
              onOpenChange={(open) => {
                setTrustDialogOpen(open);
                onDialogChange(open);
              }}
            >
              <DialogTrigger asChild>
                <button 
                  onClick={(e) => e.stopPropagation()}
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
              </DialogTrigger>
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
                    Il Trust Score "{trustScore.toUpperCase()}" indica che le fonti utilizzate hanno un buon track record di affidabilità editoriale.
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
          )}
        </div>

        {/* Center Content */}
        <div className="flex-1 flex flex-col justify-center relative">
          {/* Large Index Number - Editorial style */}
          <div className="absolute -top-2 left-0 text-[120px] font-black text-white/[0.06] leading-none select-none pointer-events-none">
            #{index + 1}
          </div>

          {/* Soft glow vignette behind headline */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[80%] h-[60%] bg-[#0A7AFF]/5 rounded-full blur-3xl" />
          </div>

          {/* Content */}
          <div className="relative z-10">
            {/* Small visible index */}
            <span className="text-sm font-bold text-[#0A7AFF]/60 mb-2 block">
              #{index + 1} di {totalItems}
            </span>

            {/* Headline */}
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-4 drop-shadow-xl">
              {item.title}
            </h1>

            {/* Abstract/Lead with fade */}
            <p className="text-base sm:text-lg text-white/70 leading-relaxed line-clamp-3 mb-6">
              {item.summary.replace(/\[SOURCE:[\d,\s]+\]/g, "")}
            </p>
          </div>
        </div>

        {/* Sources Tag - Bottom */}
        {item.sources?.length > 0 && (
          <div className="flex items-center">
            <button 
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center px-3 py-1.5 bg-white/5 backdrop-blur-md rounded-full text-xs text-white/60 font-medium border border-white/5 hover:bg-white/10 transition-colors"
            >
              {item.sources[0]?.name?.toLowerCase() || "fonti"}
              {item.sources.length > 1 && ` +${item.sources.length - 1}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

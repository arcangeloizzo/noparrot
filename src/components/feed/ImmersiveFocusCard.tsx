import React from "react";
import { Heart, MessageCircle, Bookmark, Info, ShieldCheck, Quote } from "lucide-react";
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

interface Source {
  icon: string;
  name: string;
  url?: string;
}

interface ImmersiveFocusCardProps {
  focusId: string;
  type?: 'daily';
  category?: string;
  title: string;
  summary: string;
  sources: Source[];
  trustScore?: string;
  imageUrl?: string;
  reactions: {
    likes: number;
    comments: number;
    shares: number;
  };
  onClick?: () => void;
  onComment?: () => void;
  onShare?: () => void;
}

export const ImmersiveFocusCard = ({
  focusId,
  type = 'daily',
  category,
  title,
  summary,
  sources,
  trustScore,
  imageUrl,
  reactions,
  onClick,
  onComment,
  onShare,
}: ImmersiveFocusCardProps) => {
  const { user } = useAuth();
  const { data: reactionsData } = useFocusReactions(focusId, type);
  const toggleReaction = useToggleFocusReaction();

  // Track which dialogs are open to prevent card click while any dialog is open
  const [infoDialogOpen, setInfoDialogOpen] = React.useState(false);
  const [trustDialogOpen, setTrustDialogOpen] = React.useState(false);
  
  // Suppress card click for a brief moment after dialog closes
  const suppressUntilRef = React.useRef(0);
  
  const handleDialogChange = (open: boolean) => {
    if (!open) {
      // When dialog closes, suppress card clicks for 400ms
      suppressUntilRef.current = Date.now() + 400;
    }
  };

  const handleCardClick = () => {
    // Don't trigger if any dialog is open
    if (infoDialogOpen || trustDialogOpen) return;
    // Don't trigger if we're in suppress window
    if (Date.now() < suppressUntilRef.current) return;
    onClick?.();
  };

  return (
    <div 
      className="h-[100dvh] w-full snap-start relative flex flex-col p-6 overflow-hidden cursor-pointer"
      onClick={handleCardClick}
    >
      
      {/* Background Layer */}
      {imageUrl ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/90 z-0" />
          <img 
            src={imageUrl} 
            className="absolute inset-0 w-full h-full object-cover opacity-50 blur-2xl scale-110 z-[-1]" 
            alt=""
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-[#1F3347] to-[#0E141A] z-0" />
      )}

      {/* Content Layer */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between pt-14 pb-24">
        
        {/* Top Bar */}
        <div className="flex flex-col gap-2">
          {/* Row 1: Badge tipo + Trust Score (stessa altezza h-8) */}
          <div className="flex justify-between items-center">
            {/* Badge Tipo - compatto su 1 riga */}
            <Dialog 
              open={infoDialogOpen} 
              onOpenChange={(open) => {
                setInfoDialogOpen(open);
                handleDialogChange(open);
              }}
            >
              <DialogTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 inline-flex items-center gap-2 px-3 rounded-full backdrop-blur-xl border cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap bg-[#0A7AFF]/20 border-[#0A7AFF]/30 text-[#0A7AFF]"
                >
                  <span className="text-xs font-bold tracking-wide font-mono">
                    ◉ IL PUNTO
                  </span>
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

            {/* Trust Score - stessa altezza h-8 */}
            {trustScore && (
              <Dialog 
                open={trustDialogOpen} 
                onOpenChange={(open) => {
                  setTrustDialogOpen(open);
                  handleDialogChange(open);
                }}
              >
                <DialogTrigger asChild>
                  <button 
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "h-8 flex items-center gap-1.5 bg-black/30 backdrop-blur-xl border border-white/10 px-3 rounded-full cursor-pointer hover:bg-black/40 transition-colors whitespace-nowrap",
                      trustScore.toLowerCase() === 'alto' && "text-emerald-400",
                      trustScore.toLowerCase() === 'medio' && "text-amber-400",
                      trustScore.toLowerCase() === 'basso' && "text-red-400"
                    )}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-[10px] font-bold tracking-wider uppercase">TRUST {trustScore.toUpperCase()}</span>
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
        </div>

        {/* Center Content */}
        <div className="flex-1 flex flex-col justify-center px-2">
          <Quote className="text-white/20 w-12 h-12 rotate-180 mb-4" />
          <h1 className="text-3xl font-bold text-white leading-tight mb-4 drop-shadow-xl">
            {title}
          </h1>
          <p className="text-lg text-white/80 leading-relaxed line-clamp-4 mb-6">
            {summary.replace(/\[SOURCE:[\d,\s]+\]/g, '')}
          </p>
          
          {/* Sources Tag - sorted by name length (shortest first) */}
          {sources.length > 0 && (
            <div className="flex items-center gap-2">
              <button className="inline-flex items-center px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs text-white/80 font-medium border border-white/10 max-w-[180px]">
                <span className="truncate">
                  {[...sources].sort((a, b) => (a.name?.length || 0) - (b.name?.length || 0))[0]?.name?.toLowerCase() || 'fonti'}
                </span>
                {sources.length > 1 && <span className="flex-shrink-0 ml-1">+{sources.length - 1}</span>}
              </button>
            </div>
          )}
        </div>

        {/* Bottom Actions - Aligned heights h-10 */}
        <div className="flex items-center justify-between gap-3">
          
          {/* Primary Share Button - h-10 px-4 */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onShare?.();
            }}
            className="h-10 px-4 bg-white hover:bg-gray-50 text-[#1F3347] font-bold rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Logo variant="icon" size="sm" className="h-4 w-4" />
            <span className="text-sm font-semibold leading-none">
              Condividi{reactions.shares > 0 ? ` (${reactions.shares})` : ''}
            </span>
          </button>

          {/* Reactions - Horizontal layout h-10 matching share button */}
          <div className="flex items-center gap-1 bg-black/20 backdrop-blur-xl h-10 px-3 rounded-2xl border border-white/5">
            
            {/* Like */}
            <button 
              className="flex items-center justify-center gap-1.5 h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (!user) {
                  toast.error('Devi effettuare il login per mettere like');
                  return;
                }
                toggleReaction.mutate({ focusId, focusType: type });
              }}
            >
              <Heart 
                className={cn(
                  "w-5 h-5",
                  reactionsData?.likedByMe ? "text-red-500 fill-red-500" : "text-white"
                )}
                fill={reactionsData?.likedByMe ? "currentColor" : "none"}
              />
              <span className="text-xs font-bold text-white">{reactionsData?.likes ?? reactions.likes}</span>
            </button>

            {/* Comments */}
            <button 
              className="flex items-center justify-center gap-1.5 h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onComment?.();
              }}
            >
              <MessageCircle className="w-5 h-5 text-white" />
              <span className="text-xs font-bold text-white">{reactions.comments}</span>
            </button>

            {/* Bookmark */}
            <button 
              className="flex items-center justify-center h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                toast.info('Funzionalità in arrivo');
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

import React from "react";
import { Heart, MessageCircle, Share2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useFocusReactions, useToggleFocusReaction } from "@/hooks/useFocusReactions";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Source {
  icon: string;
  name: string;
  url?: string;
}

interface ExternalFocusCardProps {
  focusId: string;
  type: 'daily' | 'interest';
  category?: string;
  title: string;
  summary: string;
  sources: Source[];
  trustScore: 'Alto' | 'Medio' | 'Basso';
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

export const ExternalFocusCard = ({
  focusId,
  type,
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
}: ExternalFocusCardProps) => {
  const { user } = useAuth();
  const { data: reactionsData } = useFocusReactions(focusId, type);
  const toggleReaction = useToggleFocusReaction();
  const isDailyFocus = type === 'daily';
  
  const badgeBg = isDailyFocus ? 'bg-[#0A7AFF]' : 'bg-[#A98FF8]/20';
  const badgeText = isDailyFocus ? 'text-white' : 'text-[#A98FF8]';
  const borderColor = isDailyFocus ? 'border-[#0A7AFF]' : 'border-[#A98FF8]';
  
  const trustColors = {
    'Alto': 'text-green-400',
    'Medio': 'text-yellow-400',
    'Basso': 'text-red-400'
  };

  return (
    <div 
      className={cn(
        "bg-[#0E141A] rounded-xl overflow-hidden border border-white/5 cursor-pointer",
        "transition-all hover:border-white/10",
        `border-l-4 ${borderColor}`
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="p-4 pb-3 pt-5">
        <div className="flex items-center gap-2">
          <Badge className={cn(badgeBg, badgeText, "font-semibold px-3 py-1 border-0")}>
            {isDailyFocus ? '🌍 IL PUNTO' : `🧠 PER TE: ${category?.toUpperCase() || 'GENERALE'}`}
          </Badge>
          {isDailyFocus && (
            <Dialog>
              <DialogTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <Info className="w-4 h-4 text-gray-400" />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Cos'è Il Punto</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Questo contenuto è una sintesi automatica generata da NoParrot usando fonti pubbliche.
                  </p>
                  <p>
                    Serve per offrire un contesto comune da cui partire per la discussione.
                  </p>
                  <p className="font-medium text-foreground">
                    Non rappresenta una posizione ufficiale né una verifica dei fatti.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-4">
        <h3 className="text-lg font-bold text-white mb-2 leading-tight">
          {title}
        </h3>
        <p className="text-sm text-gray-400 leading-relaxed mb-3 line-clamp-6">
          {summary.replace(/\[SOURCE:[\d,\s]+\]/g, '')}
        </p>
        
        {/* Sources - Aggregated Tag */}
        {sources.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              // This could open SourcesDrawer if needed
            }}
            className="inline-flex items-center px-2.5 py-1 bg-primary/10 hover:bg-primary/20 rounded-md text-xs text-primary font-medium cursor-pointer transition-colors border border-primary/20"
          >
            {sources[0]?.name?.toLowerCase() || 'fonti'}
            {sources.length > 1 && ` +${sources.length - 1}`}
          </button>
        )}
      </div>

      {/* Footer - Reactions */}
      <div className="px-4 py-3 border-t border-white/5 flex items-center gap-6">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!user) {
              toast.error('Devi effettuare il login per mettere like');
              return;
            }
            toggleReaction.mutate({ focusId, focusType: type });
          }}
          className={cn(
            "reaction-btn-heart",
            reactionsData?.likedByMe && "liked"
          )}
        >
          <Heart 
            className="w-5 h-5 transition-all" 
            fill={reactionsData?.likedByMe ? "currentColor" : "none"}
            strokeWidth={reactionsData?.likedByMe ? 0 : 2}
          />
          <span>{reactionsData?.likes ?? reactions.likes}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onComment?.();
          }}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-400 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          <span>{reactions.comments}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare?.();
          }}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-green-400 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          <span>{reactions.shares}</span>
        </button>
      </div>
    </div>
  );
};

import { EDITORIAL } from '@/config/brand';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuotedEditorialCardProps {
  title: string;
  summary?: string;
  onClick?: () => void;
  /** "feed" shows full branding, "composer" shows minimal branding */
  variant?: 'feed' | 'composer';
  trustScore?: { band: string; score?: number };
}

export const QuotedEditorialCard = ({ 
  title, 
  summary,
  onClick,
  variant = 'feed',
  trustScore
}: QuotedEditorialCardProps) => {
  const isComposer = variant === 'composer';
  
  return (
    <div 
      className="rounded-2xl p-4 mt-3 cursor-pointer active:scale-[0.98] transition-transform border border-white/10 relative overflow-hidden"
      style={{ 
        background: 'linear-gradient(135deg, #0A0F14 0%, #151D27 100%)'
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {/* Urban texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Header - Stile profilo utente */}
      <div className="flex items-center gap-4 mb-4 relative z-10">
        {/* Avatar circolare con sfondo bianco e ring azzurro - più grande */}
        <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center ring-2 ring-[#0A7AFF]/50 shadow-lg overflow-hidden">
          <img 
            src={EDITORIAL.AVATAR_IMAGE} 
            alt="Il Punto"
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Nome e handle */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-base">Il Punto</p>
          <p className="text-sm text-white/50">{EDITORIAL.HANDLE}</p>
        </div>
        
        {/* Trust Score Badge (se disponibile e non in composer) */}
        {trustScore && !isComposer && (
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-[9px] uppercase font-bold shrink-0",
            trustScore.band === 'ALTO' && "bg-emerald-500/20 text-emerald-400",
            trustScore.band === 'MEDIO' && "bg-amber-500/20 text-amber-400",
            trustScore.band === 'BASSO' && "bg-red-500/20 text-red-400",
            !trustScore.band && "bg-white/10 text-white/60"
          )}>
            <ShieldCheck className="w-3 h-3" />
            <span>TRUST {trustScore.band || '—'}</span>
          </div>
        )}
      </div>

      {/* Editorial Title - Prominente */}
      <h3 className="font-bold text-white text-base leading-tight mb-3 line-clamp-2 relative z-10">
        {title}
      </h3>
      
      {/* Summary/Abstract - Solo nel feed con CTA */}
      {!isComposer && summary && (
        <p className="text-sm text-white/60 line-clamp-5 leading-relaxed relative z-10">
          {summary}
          <span className="text-white font-semibold"> Leggi tutto</span>
        </p>
      )}
    </div>
  );
};

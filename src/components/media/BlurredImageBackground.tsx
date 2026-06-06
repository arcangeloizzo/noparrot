import { ReactNode } from 'react';

interface BlurredImageBackgroundProps {
  imageUrl: string;
  onClick?: () => void; // per attivare media viewer
  overlayGradient?: string | null; // accent opzionale (es. gradient Instagram per Reel)
}

export const BlurredImageBackground = ({
  imageUrl,
  onClick,
  overlayGradient
}: BlurredImageBackgroundProps) => {
  return (
    <div 
      className="absolute inset-0 overflow-hidden cursor-pointer"
      onClick={onClick}
      aria-label="Apri immagine a schermo intero"
      style={{ 
        contain: 'paint layout' 
      }}
    >
      <img 
        src={imageUrl}
        alt=""
        className="w-full h-full object-cover animate-in fade-in duration-500"
        style={{ 
          filter: 'blur(20px)',
          transform: 'scale(1.06)', // evita bordi vuoti del blur
          willChange: 'transform'
        }}
        loading="lazy"
      />
      
      {/* Vignette per leggibilità testo (più scuro in basso dove sta action bar) */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ 
          background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 25%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.85) 100%)'
        }}
      />
      
      {/* Overlay accent opzionale (es. gradient Instagram per Reel) */}
      {overlayGradient && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ background: overlayGradient, mixBlendMode: 'overlay' }}
        />
      )}
    </div>
  );
};

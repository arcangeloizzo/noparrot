import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SpotifyGradientBackground } from '@/components/feed/SpotifyGradientBackground';

export type AmbientMediaKind =
  | 'reel-short'   // video verticale: blur più morbido, opacity più alta
  | 'photo-user'   // foto caricata da utente: idem
  | 'og-image'     // immagine OG / thumbnail estratta da articolo: blur più forte, opacity più bassa
  | 'thumbnail';   // thumbnail video (YouTube std, ecc): come og-image

export type AmbientPreset =
  | 'auto'         // default: deriva da media|category
  | 'editorial'    // Il Punto: #0D1B2A + glow blu
  | 'spotify';     // mantiene comportamento estrazione colori esistente

export interface AmbientLayerProps {
  /** Media ambient (prevale su category se presente). */
  media?: { src: string; kind: AmbientMediaKind };
  /** Hex colore categoria (fallback se non c'è media). */
  category?: string;
  /** Preset semantico per casi speciali. Default 'auto'. */
  preset?: AmbientPreset;
  /** Per preset='spotify': palette già estratta dalla cover o features aggiuntive. */
  spotifyPalette?: { primary: string; secondary?: string };
  spotifyTrackInfo?: { albumArtUrl: string; audioFeatures?: any };
  /** Override del posizionamento (default: absolute inset:0). */
  className?: string;
  /** Solo la card attiva renderizza lo sfondo sfumato con immagine. */
  isActive?: boolean;
}

export function AmbientLayer({
  media,
  category,
  preset = 'auto',
  spotifyPalette,
  spotifyTrackInfo,
  className,
  isActive = true
}: AmbientLayerProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset loaded state if source changes
  useEffect(() => {
    setImageLoaded(false);
  }, [media?.src]);

  // Pre-load image helper for S2 - only if card is active
  useEffect(() => {
    if (!media?.src || !isActive) return;
    let active = true;
    const img = new Image();
    
    // Set onload and onerror handlers BEFORE setting src to avoid any race conditions
    img.onload = () => {
      if (active) setImageLoaded(true);
    };
    img.onerror = () => {
      // Keep state as false or fallback silently
    };
    img.src = media.src;
    
    // Check if the image is already cached/complete
    if (img.complete) {
      if (active) setImageLoaded(true);
    } else {
      // Decode asynchronously off-thread for better scrolling performance, catch errors silently
      img.decode()
        .then(() => {
          if (active) setImageLoaded(true);
        })
        .catch(() => {
          // Silent catch: onload will trigger when the browser finishes loading/decoding
        });
    }
    
    return () => {
      active = false;
    };
  }, [media?.src, isActive]);

  // Se la card non è attiva, bypassiamo il caricamento/composizione dell'immagine per alleggerire il GPU thread
  if (!isActive) {
    const resolvedColor = category && category.startsWith('#') ? category : null;
    const gradient = resolvedColor
      ? `radial-gradient(ellipse 90% 55% at 70% 25%, ${resolvedColor}22 0%, transparent 65%), radial-gradient(ellipse 70% 45% at 20% 80%, ${resolvedColor}11 0%, transparent 60%)`
      : `radial-gradient(ellipse 90% 55% at 70% 25%, rgba(255,255,255,0.04) 0%, transparent 65%), radial-gradient(ellipse 70% 45% at 20% 80%, rgba(255,255,255,0.02) 0%, transparent 60%)`;

    return (
      <div
        className={cn("absolute inset-0 pointer-events-none z-0 bg-immersive", className)}
        style={{
          background: gradient
        }}
      />
    );
  }

  // 1. Editorial Preset
  if (preset === 'editorial') {
    return (
      <div
        className={cn("absolute inset-0 pointer-events-none z-0", className)}
        style={{
          backgroundColor: '#0D1B2A',
          backgroundImage: 'radial-gradient(circle at center, color-mix(in srgb, var(--blue, #0A7AFF) 25%, transparent) 0%, transparent 70%)',
        }}
      />
    );
  }

  // 2. Spotify Preset
  if (preset === 'spotify') {
    return (
      <SpotifyGradientBackground
        albumArtUrl={spotifyTrackInfo?.albumArtUrl || media?.src || ''}
        audioFeatures={spotifyTrackInfo?.audioFeatures}
        spotifyPalette={spotifyPalette}
        className={className}
      />
    );
  }

  // 3. Media Present (S2 preset) - only if loaded
  if (media?.src && imageLoaded) {
    const isVertical = media.kind === 'reel-short' || media.kind === 'photo-user';
    
    // Config values based on media kind:
    // reel-short | photo-user: blur(50px) saturate(1.45) brightness(0.75); opacity: 0.45
    // og-image | thumbnail: blur(64px) saturate(1.45) brightness(0.70); opacity: 0.32
    const filter = isVertical
      ? 'blur(50px) saturate(1.45) brightness(0.75)'
      : 'blur(64px) saturate(1.45) brightness(0.70)';
      
    const opacity = isVertical ? 0.45 : 0.32;

    return (
      <div 
        className={cn("absolute overflow-hidden pointer-events-none z-0 bg-immersive", className)}
        style={{ inset: 0 }}
      >
        <div
          className="absolute"
          style={{
            inset: '-12%',
            backgroundImage: `url(${media.src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter,
            opacity,
            transform: 'scale(1.12) translateZ(0)',
            willChange: 'transform',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
          }}
        />
        {/* Scrim overlay for contrast */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ 
            background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.85) 100%)'
          }}
        />
      </div>
    );
  }

  // 4. Category Present (S3 preset) or Fallback (no image loaded yet or no media)
  const resolvedColor = category && category.startsWith('#') ? category : null;
  const gradient = resolvedColor
    ? `radial-gradient(ellipse 90% 55% at 70% 25%, ${resolvedColor}22 0%, transparent 65%), radial-gradient(ellipse 70% 45% at 20% 80%, ${resolvedColor}11 0%, transparent 60%)`
    : `radial-gradient(ellipse 90% 55% at 70% 25%, rgba(255,255,255,0.04) 0%, transparent 65%), radial-gradient(ellipse 70% 45% at 20% 80%, rgba(255,255,255,0.02) 0%, transparent 60%)`;

  return (
    <div
      className={cn("absolute inset-0 pointer-events-none z-0 bg-immersive", className)}
      style={{
        background: gradient
      }}
    />
  );
}

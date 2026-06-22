import { ReactNode, CSSProperties, memo } from 'react';
import { cn } from '@/lib/utils';
import type { UnifiedMedia } from '@/types/media';

export type MediaFrameVariant = 'tall' | 'strip' | 'mini' | 'inline' | 'square';

interface MediaFrameProps {
  /** Media unificato (UnifiedMedia) — può venire da upload utente o link preview con fallback */
  media: Pick<UnifiedMedia, 'src' | 'ratio' | 'orientation' | 'kind'>;
  /**
   * Variante layout decisa dal consumer in base alla matrice §5.1:
   * - tall: full-width, height min(42vh, 380px) — portrait + testo corto
   * - strip: full-width, height 16vh (min 100 max 160) — landscape + testo lungo
   * - mini: aspect-ratio del media nativo, max-height 31vh/240px — portrait + testo lungo (mini affiancato §5.3)
   */
  variant: MediaFrameVariant;
  /** Tap handler — apre ExpandedViewer (sotto-blocco G). Optional finché non lo facciamo. */
  onTap?: () => void;
  /**
   * Overlay slot — z-index 3 (sotto l'anello 4, sopra lo speculare 2).
   * Per chip platform, play button, counter carousel, dots, src-row.
   */
  children?: ReactNode;
  /** Classi extra opzionali */
  className?: string;
  /** Stage variant flag: aggiunge frame--stage per ombra più pronunciata */
  isStage?: boolean;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

/**
 * MediaFrame — spec v1.1 §5.2 + §5.1 matrice
 *
 * Wrapper "glass ring" per qualunque media nel feed (foto, thumb video, OG image, cover audio).
 * Applica: anello gradient (::after, z-4), riflesso speculare (::before, z-2), ombra,
 * overflow hidden con border-radius coerente.
 *
 * Il componente è AGNOSTICO della sorgente: riceve UnifiedMedia (subset). Il consumer
 * decide variant in base a orientation × textLength (matrice §5.1).
 *
 * Crop: object-fit:cover sempre (spec §M2). Mai aspect-ratio libero dall'immagine:
 * la variant è scelta dal consumer in coerenza con orientation, niente crop verticale 16:9.
 */
function MediaFrameImpl({
  media,
  variant,
  onTap,
  children,
  className,
  isStage = false,
  onLoad,
  onError,
}: MediaFrameProps) {
  const variantStyle = getVariantStyle(variant, media.ratio);

  return (
    <div
      className={cn(
        'frame',
        isStage && 'frame--stage',
        onTap && 'cursor-pointer',
        className
      )}
      style={{
        borderRadius: 20,
        ...variantStyle,
      }}
      onClick={onTap}
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
    >
      <img
        src={media.src}
        alt=""
        width={(media as any).width || undefined}
        height={(media as any).height || undefined}
        loading="lazy"
        decoding="async"
        onLoad={onLoad}
        onError={onError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
        draggable={false}
      />
      {children && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            pointerEvents: 'none', // gli overlay specifici riabilitano pointer-events su se stessi
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export const MediaFrame = memo(MediaFrameImpl, (prev, next) => (
  prev.variant === next.variant &&
  prev.isStage === next.isStage &&
  prev.className === next.className &&
  prev.onTap === next.onTap &&
  prev.children === next.children &&
  prev.onLoad === next.onLoad &&
  prev.onError === next.onError &&
  prev.media.src === next.media.src &&
  prev.media.ratio === next.media.ratio &&
  prev.media.orientation === next.media.orientation &&
  prev.media.kind === next.media.kind
));

/**
 * Calcola lo stile inline per la variante (dimensioni esatte da spec §5.1, §5.3, §5.5).
 * Usa valori espliciti (no var()) per la regola interim post-TICKET-07A.
 */
function getVariantStyle(
  variant: MediaFrameVariant,
  ratio: UnifiedMedia['ratio']
): CSSProperties {
  switch (variant) {
    case 'tall': {
      // Spec §M1/§5.2: il media mantiene orientamento nativo. Usa aspect-ratio derivato
      // da ratio + max-height come safety net per immagini molto alte.
      const ar = ratio === '9:16' ? '9 / 16' : '3 / 4'; // default 3:4 per portrait
      return {
        width: '100%',
        aspectRatio: ar,
        maxHeight: 'min(42vh, 380px)',
      };
    }
    case 'strip':
      // Spec §5.1: landscape + testo lungo → strip full-width, flex:0 1 auto, height 16vh (min 100, max 160)
      return {
        width: '100%',
        height: '16vh',
        minHeight: 100,
        maxHeight: 160,
        flex: '0 1 auto',
      };
    case 'mini':
      // Spec §5.3: mini affiancato — width:auto, aspect-ratio match ratio nativo, max-height min(31vh, 240px), min-height 176
      // Spec specifica solo 9:16 e 3:4 variante r34. Per square 1:1 usiamo 9:16 default come safety.
      return {
        width: 'auto',
        aspectRatio: ratio === '3:4' ? '3 / 4' : '9 / 16',
        maxHeight: 'min(31vh, 240px)',
        minHeight: 176,
        flexShrink: 0,
        alignSelf: 'flex-start',
        marginTop: 0,
      };
    case 'inline':
      // Spec §5.1: landscape + testo corto → full-width, aspect-ratio 16/9 piena
      return {
        width: '100%',
        aspectRatio: '16 / 9',
      };
    case 'square':
      // Spec §M1: il media mantiene orientamento nativo. Per immagini 1:1 + testo corto
      // → container quadrato full-width, no crop.
      return {
        width: '100%',
        aspectRatio: '1 / 1',
      };
  }
}

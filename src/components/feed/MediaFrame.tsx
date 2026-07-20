import { Play, Images } from 'lucide-react';

export interface MediaFrameItem {
  url: string;
  type: 'image' | 'video';
  orientation?: string | null;
  ratio?: number | null;
  thumbnail_url?: string | null;
}

export interface MediaFrameProps {
  media: MediaFrameItem[];
  onMediaClick?: (index: number, el: HTMLElement) => void;
}

const getOrientation = (m: MediaFrameItem): 'landscape' | 'portrait' | 'square' => {
  if (m.orientation === 'landscape' || m.orientation === 'portrait' || m.orientation === 'square') {
    return m.orientation;
  }
  if (m.ratio) {
    if (m.ratio > 1.05) return 'landscape';
    if (m.ratio < 0.95) return 'portrait';
    return 'square';
  }
  return 'landscape';
};

const PlayBadge = ({ size = 62 }: { size?: number }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
      pointerEvents: 'none',
    }}
  >
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: 'rgba(10,14,22,0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Play className={size >= 60 ? 'w-6 h-6 text-white fill-white ml-0.5' : 'w-4 h-4 text-white fill-white ml-0.5'} />
    </div>
  </div>
);

const renderMediaEl = (m: MediaFrameItem, contain: boolean) => {
  const commonStyle: React.CSSProperties = contain
    ? { position: 'relative', zIndex: 1, width: '100%', height: '100%', objectFit: 'contain' }
    : { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };

  if (m.type === 'video') {
    return (
      <video
        src={m.url}
        poster={m.thumbnail_url || undefined}
        muted
        playsInline
        preload="metadata"
        style={commonStyle}
      />
    );
  }
  return <img src={m.url} loading="lazy" style={commonStyle} alt="" />;
};

export const MediaFrame = ({ media, onMediaClick }: MediaFrameProps) => {
  if (!media || media.length === 0) return null;

  const handleTileClick = (i: number) => (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    onMediaClick?.(i, e.currentTarget as HTMLElement);
  };

  // ── SINGLE ────────────────────────────────────────────────────
  if (media.length === 1) {
    const m = media[0];
    const orient = getOrientation(m);

    if (orient === 'landscape') {
      return (
        <div className="w-full pointer-events-auto">
          <div
            onClick={handleTileClick(0)}
            style={{
              position: 'relative',
              aspectRatio: '16 / 10',
              overflow: 'hidden',
              background: '#0a0f18',
              cursor: 'pointer',
            }}
          >
            {renderMediaEl(m, false)}
            {m.type === 'video' && <PlayBadge />}
          </div>
        </div>
      );
    }

    // portrait / square → STAGE
    return (
      <div className="w-full pointer-events-auto">
        <div
          onClick={handleTileClick(0)}
          style={{
            position: 'relative',
            height: 'min(62svh, 540px)',
            overflow: 'hidden',
            background: '#0a0f18',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${m.thumbnail_url || m.url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(28px) brightness(0.55) saturate(130%)',
              transform: 'scale(1.15)',
            }}
          />
          {renderMediaEl(m, true)}
          {m.type === 'video' && <PlayBadge />}
        </div>
      </div>
    );
  }

  // ── MULTIPLE (2+) ─────────────────────────────────────────────
  const count = media.length;
  const isTwo = count === 2;
  const visible = media.slice(0, 3);
  const extra = count > 3 ? count - 3 : 0;

  const gridStyle: React.CSSProperties = isTwo
    ? {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '3px',
        height: 'min(56svh, 480px)',
        overflow: 'hidden',
        position: 'relative',
      }
    : {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '3px',
        height: 'min(56svh, 480px)',
        overflow: 'hidden',
        position: 'relative',
      };

  return (
    <div className="w-full pointer-events-auto">
      <div style={gridStyle}>
        {/* counter chip */}
        <div
          style={{
            position: 'absolute',
            left: '10px',
            top: '10px',
            zIndex: 3,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10.5px',
            letterSpacing: '0.08em',
            color: '#fff',
            background: 'rgba(10,14,22,0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: '4px 9px',
            borderRadius: '999px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            pointerEvents: 'none',
          }}
        >
          <Images className="w-3 h-3" />
          {count}
        </div>

        {visible.map((m, i) => {
          const tileStyle: React.CSSProperties = {
            position: 'relative',
            overflow: 'hidden',
            background: '#0a0f18',
            cursor: 'pointer',
          };
          if (!isTwo && i === 0) {
            tileStyle.gridRow = '1 / span 2';
          }
          const isLastVisible = i === visible.length - 1;
          const showExtra = extra > 0 && isLastVisible;

          return (
            <div key={i} style={tileStyle} onClick={handleTileClick(showExtra ? 3 : i)}>
              <img
                src={m.thumbnail_url || m.url}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                alt=""
              />
              {m.type === 'video' && !showExtra && <PlayBadge size={44} />}
              {showExtra && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(8,12,20,0.55)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '20px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    color: '#fff',
                    zIndex: 2,
                  }}
                >
                  +{extra}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MediaFrame;
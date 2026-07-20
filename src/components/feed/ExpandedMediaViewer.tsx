import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Heart, MessageCircle, Bookmark, Send, X } from 'lucide-react';
import type { MediaFrameItem } from './MediaMosaic';

export type { MediaFrameItem };

export interface ExpandedMediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaFrameItem[];
  initialIndex?: number;
  authorLabel?: string;
  caption?: string;
  accentColor?: string;
  getOriginRect?: () => DOMRect | null;
  heartsCount?: number;
  hasHearted?: boolean;
  onHeart?: () => void;
  onComment?: () => void;
  onBookmark?: () => void;
  hasBookmarked?: boolean;
  onShare?: () => void;
}

type Phase = 'idle' | 'from' | 'open' | 'exit';

const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export const ExpandedMediaViewer = ({
  isOpen,
  onClose,
  media,
  initialIndex = 0,
  authorLabel,
  caption,
  accentColor,
  getOriginRect,
  heartsCount,
  hasHearted,
  onHeart,
  onComment,
  onBookmark,
  hasBookmarked,
  onShare,
}: ExpandedMediaViewerProps) => {
  const accent = accentColor || '#0A7AFF';

  const [phase, setPhase] = useState<Phase>('idle');
  const [geom, setGeom] = useState<React.CSSProperties>({});
  const [current, setCurrent] = useState(initialIndex);
  const [uiVisible, setUiVisible] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [dragDx, setDragDx] = useState(0);

  const getOriginRectRef = useRef(getOriginRect);
  getOriginRectRef.current = getOriginRect;

  const trackRef = useRef<HTMLDivElement | null>(null);
  const touchStart = useRef<{ x: number; y: number; target: EventTarget | null } | null>(null);

  const TRANSITION =
    'top .46s cubic-bezier(0.32,0.72,0,1), left .46s cubic-bezier(0.32,0.72,0,1), width .46s cubic-bezier(0.32,0.72,0,1), height .46s cubic-bezier(0.32,0.72,0,1), border-radius .46s cubic-bezier(0.32,0.72,0,1), opacity .25s ease';

  const fullscreenGeom: React.CSSProperties = {
    top: 0,
    left: 0,
    width: '100vw',
    height: '100svh',
    borderRadius: 0,
    opacity: 1,
  };

  // Open / close morph
  useEffect(() => {
    if (isOpen) {
      setCurrent(initialIndex);
      setUiVisible(true);
      const rect = getOriginRectRef.current?.();
      if (rect) {
        setGeom({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          borderRadius: 18,
          opacity: 1,
        });
        setPhase('from');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setGeom(fullscreenGeom);
            setPhase('open');
          });
        });
      } else {
        setGeom({ ...fullscreenGeom, opacity: 0 });
        setPhase('from');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setGeom({ ...fullscreenGeom, opacity: 1 });
            setPhase('open');
          });
        });
      }
    } else {
      setPhase('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Pause non-current videos
  useEffect(() => {
    const root = trackRef.current;
    if (!root) return;
    const videos = root.querySelectorAll('video');
    videos.forEach((v, i) => {
      if (i !== current) {
        try {
          v.pause();
        } catch {
          // ignore
        }
      }
    });
  }, [current]);

  const handleClose = useCallback(() => {
    const rect = getOriginRectRef.current?.();
    if (rect) {
      setGeom({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        borderRadius: 18,
        opacity: 1,
      });
    } else {
      setGeom({ ...fullscreenGeom, opacity: 0 });
    }
    setPhase('exit');
    window.setTimeout(() => {
      onClose();
    }, 460);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  // Gestures
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, target: e.target };
    setDragging(true);
    setDragDx(0);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.touches[0];
    setDragDx(t.clientX - touchStart.current.x);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) {
      setDragging(false);
      return;
    }
    const dx = dragDx;
    const tgt = touchStart.current.target as HTMLElement | null;
    const isInteractive =
      tgt && (tgt.closest('button') || tgt.tagName === 'VIDEO' || tgt.closest('video'));
    setDragging(false);
    setDragDx(0);
    touchStart.current = null;

    if (Math.abs(dx) > 50) {
      if (dx < 0 && current < media.length - 1) setCurrent(current + 1);
      else if (dx > 0 && current > 0) setCurrent(current - 1);
    } else if (Math.abs(dx) < 8 && !isInteractive) {
      setUiVisible((v) => !v);
    }
  };

  if (!isOpen && phase === 'idle') return null;
  if (typeof document === 'undefined') return null;

  const trackTransform = dragging
    ? `translateX(calc(${-current * 100}vw + ${dragDx}px))`
    : `translateX(${-current * 100}vw)`;

  const rootStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 70,
    background: '#070b12',
    overflow: 'hidden',
    transition: TRANSITION,
    ...geom,
  };

  const node = (
    <div
      style={rootStyle}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* ambient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.8,
          background: `radial-gradient(120% 60% at 50% 0%, ${accent}4D 0%, transparent 60%), radial-gradient(120% 60% at 50% 100%, ${accent}2E 0%, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />
      {/* grain */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.05,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
          backgroundImage: GRAIN_URL,
        }}
      />

      {/* TRACK */}
      <div
        ref={trackRef}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          transform: trackTransform,
          transition: dragging ? 'none' : 'transform .38s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {media.map((m, i) => (
          <div
            key={i}
            style={{
              width: '100vw',
              height: '100%',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {m.type === 'video' ? (
              <video
                src={m.url}
                controls
                playsInline
                style={{ maxWidth: '100%', maxHeight: '100%' }}
              />
            ) : (
              <img
                src={m.url}
                alt=""
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* UI overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: uiVisible ? 1 : 0,
          transition: 'opacity .3s ease',
          zIndex: 5,
        }}
      >
        {/* top bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 14px 14px 14px',
            background: 'linear-gradient(180deg, rgba(5,8,14,0.7) 0%, transparent 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'auto',
          }}
        >
          {media.length > 1 ? (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                letterSpacing: '0.12em',
                color: '#fff',
              }}
            >
              {current + 1} / {media.length}
            </span>
          ) : (
            <span />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
            }}
            aria-label="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* bottom gradient + caption + dots */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '30px 64px calc(env(safe-area-inset-bottom, 0px) + 18px) 16px',
            background: 'linear-gradient(0deg, rgba(5,8,14,0.75) 0%, transparent 100%)',
            pointerEvents: 'auto',
          }}
        >
          {media.length > 1 && (
            <div
              style={{
                display: 'flex',
                gap: 5,
                marginBottom: 12,
                alignItems: 'center',
              }}
            >
              {media.map((_, i) => (
                <span
                  key={i}
                  style={{
                    height: 6,
                    width: i === current ? 22 : 6,
                    borderRadius: 999,
                    background: i === current ? '#fff' : 'rgba(255,255,255,0.3)',
                    transition: 'width .25s ease, background .25s ease',
                  }}
                />
              ))}
            </div>
          )}
          {authorLabel && (
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10.5px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: '6px',
              }}
            >
              {authorLabel}
            </div>
          )}
          {caption && (
            <div
              style={{
                fontSize: '14.5px',
                lineHeight: 1.4,
                color: 'rgba(170,182,198,0.85)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {caption}
            </div>
          )}
        </div>

        {/* Right rail */}
        <div
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            alignItems: 'center',
            pointerEvents: 'auto',
            zIndex: 6,
          }}
        >
          {onHeart && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHeart();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                filter: 'drop-shadow(0 2px 7px rgba(0,0,0,0.8))',
              }}
              aria-label="Mi piace"
            >
              <Heart
                className="w-7 h-7"
                color="#fff"
                fill={hasHearted ? '#ff3b5c' : 'none'}
                strokeWidth={2}
              />
              {typeof heartsCount === 'number' && (
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    color: '#fff',
                    letterSpacing: '0.06em',
                  }}
                >
                  {heartsCount}
                </span>
              )}
            </button>
          )}
          {onComment && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onComment();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                filter: 'drop-shadow(0 2px 7px rgba(0,0,0,0.8))',
              }}
              aria-label="Commenta"
            >
              <MessageCircle className="w-7 h-7" color="#fff" strokeWidth={2} />
            </button>
          )}
          {onBookmark && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBookmark();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                filter: 'drop-shadow(0 2px 7px rgba(0,0,0,0.8))',
              }}
              aria-label="Salva"
            >
              <Bookmark
                className="w-7 h-7"
                color="#fff"
                fill={hasBookmarked ? '#0A7AFF' : 'none'}
                strokeWidth={2}
              />
            </button>
          )}
          {onShare && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                filter: 'drop-shadow(0 2px 7px rgba(0,0,0,0.8))',
              }}
              aria-label="Condividi"
            >
              <Send className="w-7 h-7" color="#fff" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
};

export default ExpandedMediaViewer;
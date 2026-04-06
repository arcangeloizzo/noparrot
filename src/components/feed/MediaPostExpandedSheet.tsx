import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { Post } from '@/hooks/usePosts';
import { MentionText } from './MentionText';
import { ExternalLink } from 'lucide-react';
import { decodeHTMLEntities } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VoicePlayer } from '@/components/media/VoicePlayer';

interface MediaPostExpandedSheetProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  activeVoicePost?: any;
  articlePreview?: any;
}

const getHostnameFromUrl = (url: string | undefined): string => {
  if (!url) return 'Fonte';
  try {
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    return new URL(urlWithProtocol).hostname;
  } catch {
    return 'Fonte';
  }
};

export const MediaPostExpandedSheet = ({ post, isOpen, onClose, activeVoicePost, articlePreview }: MediaPostExpandedSheetProps) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const touchStartY = useRef(0);
  const scrollTopAtStart = useRef(0);
  const isDraggingRef = useRef(false);
  const dragYRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setDragY(0);
      setIsClosing(false);
      isDraggingRef.current = false;
      dragYRef.current = 0;
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setDragY(0);
      isDraggingRef.current = false;
      dragYRef.current = 0;
    }, 250);
  }, [onClose]);

  // Use native event listeners with { passive: false } so e.preventDefault() works
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !isOpen) return;

    const scrollArea = el.querySelector('.sheet-scroll-area') as HTMLElement;

    const onTouchStart = (e: TouchEvent) => {
      scrollTopAtStart.current = scrollArea?.scrollTop || 0;
      touchStartY.current = e.touches[0].clientY;
      isDraggingRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      const deltaY = e.touches[0].clientY - touchStartY.current;
      const isAtTop = !scrollArea || scrollArea.scrollTop <= 0;

      // Only drag if swiping down AND content is at the top
      if (deltaY > 0 && isAtTop && scrollTopAtStart.current <= 0) {
        e.preventDefault();
        isDraggingRef.current = true;
        setIsDragging(true);
        const dampened = deltaY > 50 ? 50 + (deltaY - 50) * 0.4 : deltaY;
        dragYRef.current = dampened;
        setDragY(dampened);
      } else if (isDraggingRef.current && deltaY > 0) {
        e.preventDefault();
        const dampened = deltaY > 50 ? 50 + (deltaY - 50) * 0.4 : deltaY;
        dragYRef.current = dampened;
        setDragY(dampened);
      }
    };

    const onTouchEnd = () => {
      if (!isDraggingRef.current) return;
      
      if (dragYRef.current > 100) {
        handleClose();
      } else {
        setDragY(0);
        dragYRef.current = 0;
      }
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [isOpen, handleClose]);

  if (!isOpen && !isClosing) return null;

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const authorName = post.author.full_name || post.author.username;
  const isChallengePost = post.post_type === 'challenge';
  const displayTitle = post.title || activeVoicePost?.title || post.challenge?.title;

  const sheetTransform = isClosing 
    ? 'translateY(100%)' 
    : isDragging 
      ? `translateY(${dragY}px)` 
      : 'translateY(0)';
  
  const sheetTransition = isDragging ? 'none' : 'transform 250ms ease-out';

  // Determine body text — the full, untruncated text
  const bodyText = activeVoicePost?.body_text || post.content;

  return (
    <>
      <div 
        className="fixed inset-0 z-50" 
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          opacity: isClosing ? 0 : isDragging ? Math.max(0.3, 1 - dragY / 300) : 1,
          transition: isDragging ? 'none' : 'opacity 250ms ease-out',
        }} 
        onClick={handleClose} 
      />
      <div 
        ref={sheetRef}
        className="fixed left-0 right-0 bottom-0 z-[51] flex flex-col"
        style={{
          backgroundColor: '#111d2e',
          borderRadius: '16px 16px 0 0',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          maxHeight: '85vh',
          transform: sheetTransform,
          transition: sheetTransition,
          willChange: 'transform',
        }}
      >
        <div className="sheet-scroll-area flex-1 overflow-y-auto px-4 pb-6">
          {/* 1. Handle — draggable indicator */}
          <div 
            style={{
              width: '36px', height: '4px', backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: '2px', margin: '10px auto 8px',
              cursor: 'grab',
            }}
          />

          {/* 2. Header utente */}
          <div className="flex items-center justify-between mb-4 mt-2">
            <div className="flex items-center gap-2">
              <Avatar className="w-[26px] h-[26px]">
                <AvatarImage src={post.author.avatar_url || ''} className="object-cover" />
                <AvatarFallback className="bg-primary/20 text-[10px]">{getInitials(authorName)}</AvatarFallback>
              </Avatar>
              <div className="flex items-baseline gap-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                <span className="text-[12px] font-bold text-white">{authorName}</span>
                <span className="text-[11px] text-white/50">@{post.author.username}</span>
              </div>
            </div>
            <button 
              onClick={handleClose}
              className="w-[28px] h-[28px] flex items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>

          {/* 3. Badge tipo post */}
          {activeVoicePost && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md mb-3" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
              <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: isChallengePost ? '#FFD464' : '#0A7AFF' }}>
                {isChallengePost ? '⚡ CHALLENGE' : '🎙 VOICECAST'}
              </span>
            </div>
          )}

          {/* 4. Titolo completo */}
          {displayTitle && (
            <h2 
              className="uppercase mb-4"
              style={{ fontFamily: 'Impact, sans-serif', fontSize: '18px', color: '#fff', lineHeight: 1.2, margin: '0 0 16px 0' }}
            >
              {displayTitle}
            </h2>
          )}

          {/* 5. Player audio — full component with waveform */}
          {activeVoicePost && (
            <div className="mb-5 bg-white/5 rounded-xl border border-white/10 p-3">
              <VoicePlayer
                audioUrl={activeVoicePost.audio_url}
                waveformData={activeVoicePost.waveform_data}
                durationSeconds={activeVoicePost.duration_seconds}
                transcript={activeVoicePost.transcript}
                transcriptStatus={activeVoicePost.transcript_status}
              />
            </div>
          )}

          {/* 6. Immagine — full width, no height limit, ALWAYS shown if media exists */}
          {post.media && post.media.length > 0 && (
            <div className="mb-5 rounded-lg overflow-hidden w-full">
              <img 
                src={post.media[0].thumbnail_url || post.media[0].url} 
                alt="" 
                style={{ width: '100%', borderRadius: '8px' }} 
              />
            </div>
          )}

          {/* 6b. Preview image (when no media but preview_img exists) */}
          {!post.media?.length && (post.preview_img || articlePreview?.image) && !activeVoicePost && (
            <div className="mb-5 rounded-lg overflow-hidden w-full">
              <img 
                src={articlePreview?.image || post.preview_img} 
                alt="" 
                style={{ width: '100%', borderRadius: '8px' }} 
              />
            </div>
          )}

          {/* 7. Link preview espansa */}
          {post.shared_url && !post.media?.length && (
            <div 
              className="flex items-center gap-3 bg-[rgba(255,255,255,0.04)] rounded-lg p-2 mb-5 cursor-pointer border border-white/5"
              onClick={() => window.open(post.shared_url, '_blank')}
            >
              <div className="w-[56px] h-[56px] rounded-md shrink-0 overflow-hidden bg-white/5 flex items-center justify-center">
                {articlePreview?.image || post.preview_img ? (
                  <img src={articlePreview?.image || post.preview_img} className="w-full h-full object-cover" />
                ) : (
                  <ExternalLink className="w-5 h-5 text-white/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white leading-tight mb-1" style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {decodeHTMLEntities(articlePreview?.title || post.shared_title || getHostnameFromUrl(post.shared_url))}
                </p>
                {articlePreview?.description && (
                  <p className="text-white/55 mb-1" style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {decodeHTMLEntities(articlePreview.description)}
                  </p>
                )}
                <p className="text-white/40 uppercase font-semibold" style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px' }}>
                  {getHostnameFromUrl(post.shared_url)}
                </p>
              </div>
            </div>
          )}

          {/* 8. Corpo testo COMPLETO — NO truncation */}
          {bodyText && (
            <div 
              className="whitespace-pre-wrap break-words"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '15px',
                lineHeight: 1.55,
                color: 'rgba(255, 255, 255, 0.8)'
              }}
            >
              <MentionText content={bodyText} />
            </div>
          )}
          
          {/* 9. Padding bottom for safe area */}
          <div style={{ height: 'calc(24px + env(safe-area-inset-bottom, 0px))' }} />
        </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

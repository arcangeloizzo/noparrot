import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Post } from '@/hooks/usePosts';
import { MentionText } from './MentionText';
import { ExternalLink } from 'lucide-react';
import { getHostnameFromUrl, decodeHTMLEntities } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VoicePlayer } from '@/components/ui/voice-player';

interface MediaPostExpandedSheetProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  activeVoicePost?: any;
  articlePreview?: any;
}

export const MediaPostExpandedSheet = ({ post, isOpen, onClose, activeVoicePost, articlePreview }: MediaPostExpandedSheetProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const authorName = post.author.full_name || post.author.username;
  const isChallengePost = post.post_type === 'challenge';
  const displayTitle = post.title || activeVoicePost?.title || post.challenge?.title;

  return (
    <>
      <div 
        className="fixed inset-0 z-50" 
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }} 
        onClick={onClose} 
      />
      <div 
        className="fixed left-0 right-0 bottom-0 z-[51] flex flex-col"
        style={{
          backgroundColor: '#111d2e',
          borderRadius: '16px 16px 0 0',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          maxHeight: '85vh',
          animation: 'slideUp 300ms ease-out'
        }}
      >
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {/* 1. Handle */}
          <div 
            style={{
              width: '36px', height: '4px', backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: '2px', margin: '10px auto 8px'
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
              onClick={onClose}
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
                {isChallengePost ? 'CHALLENGE' : 'VOICECAST'}
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

          {/* 5. Player audio */}
          {activeVoicePost && (
            <div className="mb-5 bg-white/5 rounded-xl border border-white/10 p-3">
              <VoicePlayer
                audioUrl={activeVoicePost.audio_url}
                waveformData={activeVoicePost.waveform_data}
                duration={activeVoicePost.duration_seconds}
                isChallenge={isChallengePost}
                postId={post.id}
              />
            </div>
          )}

          {/* 6. Immagine */}
          {(post.media?.[0]?.url || post.preview_img || articlePreview?.image) && !activeVoicePost && (
            <div className="mb-5 rounded-lg overflow-hidden w-full">
              <img 
                src={post.media?.[0]?.url || articlePreview?.image || post.preview_img} 
                alt="" 
                style={{ width: '100%', borderRadius: '8px', objectFit: 'cover' }} 
              />
            </div>
          )}

          {/* 7. Link preview espansa */}
          {post.shared_url && !activeVoicePost && !post.media?.length && (
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

          {/* 8. Corpo testo COMPLETO */}
          {post.content && (
            <div 
              className="whitespace-pre-wrap break-words"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '15px',
                lineHeight: 1.55,
                color: 'rgba(255, 255, 255, 0.8)'
              }}
            >
              <MentionText content={post.content} />
            </div>
          )}
          
          {/* 9. Padding bottom */}
          <div className="h-[24px]" />
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

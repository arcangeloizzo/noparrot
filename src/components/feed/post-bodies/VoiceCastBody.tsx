import { cn } from "@/lib/utils";
import { ImmersiveVoicePlayerV2 } from "@/components/media/ImmersiveVoicePlayerV2";
import { MediaGallery } from "@/components/media/MediaGallery";
import type { Post } from "@/hooks/usePosts";

interface VoiceCastBodyProps {
  post: Post;
  activeVoicePost: any;
  carouselIndex: number;
  setCarouselIndex: (i: number) => void;
  setSelectedMediaIndex: (i: number | null) => void;
  setShowFullText: (v: boolean) => void;
  setShowMediaExpandedSheet: (v: boolean) => void;
  renderBodyText: (content: string | undefined | null, hasTitle: boolean) => JSX.Element | null;
}

export const VoiceCastBody = ({
  post,
  activeVoicePost,
  carouselIndex,
  setCarouselIndex,
  setSelectedMediaIndex,
  setShowFullText,
  setShowMediaExpandedSheet,
  renderBodyText,
}: VoiceCastBodyProps) => {
  return (
    <div className="w-full flex flex-col pt-2 pb-8">
        {/* Badge VoiceCast — first element */}
        <div className="w-full flex justify-center mb-5 shrink-0">
          <span className="h-8 px-4 text-[12px] rounded-full font-bold tracking-wide inline-flex items-center uppercase border shadow-sm backdrop-blur-md"
            style={{ color: '#0A7AFF', background: 'rgba(10,122,255,0.06)', borderColor: 'rgba(10,122,255,0.2)' }}>
            🎙 VOICECAST
          </span>
        </div>
        {/* VoiceCast Content Hierarchy - 4 scenarios */}
        {(() => {
          const hasTitle = Boolean(activeVoicePost?.title);
          const hasBodyText = Boolean(activeVoicePost?.body_text);

          if (hasTitle) {
            return (
              <div className={cn(
                "flex flex-col mb-4",
                hasBodyText ? "items-start text-left px-2" : "items-center text-center justify-center flex-1 px-4 min-h-0"
              )}>
                <h2 
                  style={{
                    fontFamily: 'Impact, sans-serif',
                    fontSize: 'clamp(26px, 6.5vw, 36px)',
                    lineHeight: 0.95,
                    letterSpacing: '-0.02em',
                    color: '#FFFFFF',
                    textTransform: 'uppercase'
                  }}
                  className={cn(
                    "drop-shadow-xl w-full",
                    hasBodyText ? "mb-3" : "text-center mb-6"
                  )}
                >
                  {activeVoicePost?.title}
                </h2>
                {hasBodyText && renderBodyText(activeVoicePost?.body_text, true)}
              </div>
            );
          }

          // Fallback per vecchi post che hanno solo il body text (post.content)
          return (
            <div className="flex-shrink-0 mb-4 px-1">
              {renderBodyText(post.content, false)}
            </div>
          );
        })()}
        
        {/* 2. Media Image (Cropped flexibly taking remaining space) - only if they attach images to VoiceCast */}
        {post.media && post.media.length > 0 && (
          <div className="flex-1 min-h-0 w-full mb-6 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/50">
            {post.media.length === 1 ? (
              <img
                src={post.media[0].thumbnail_url || post.media[0].url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full object-cover">
                <MediaGallery
                  media={post.media}
                  onClick={(_, index) => setSelectedMediaIndex(index)}
                  initialIndex={carouselIndex}
                  onIndexChange={setCarouselIndex}
                  className="w-full h-full object-cover"
                  fillHeight={true}
                />
              </div>
            )}
          </div>
        )}

        {/* 3. Animated Big Waveform Player */}
        <ImmersiveVoicePlayerV2
          audioUrl={activeVoicePost?.audio_url || ''}
          durationSeconds={activeVoicePost?.duration_seconds || 0}
          transcriptStatus={activeVoicePost?.transcript_status as any}
          onShowTranscript={() => setShowFullText(true)}
        />
    </div>
  );
};

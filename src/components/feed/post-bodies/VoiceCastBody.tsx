import React, { useMemo } from "react";
import { getCardImageUrl } from "@/lib/mediaUtils";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { MediaGallery } from "@/components/media/MediaGallery";
import { VoicePlayer } from "@/components/media/VoicePlayer";
import { ImmersiveVoicePlayerV2 } from "@/components/media/ImmersiveVoicePlayerV2";
import { MediaFrame } from "@/components/shared/MediaFrame";
import { MediaMosaic } from "../MediaMosaic";

interface VoiceCastBodyProps {
  // Identification
  postId: string;

  // Layout & Scroller
  emergencyScroll: boolean;

  // Voice data
  voiceTitle: string;
  voiceContent: string;
  bodyLineClamp: number;
  shouldShowApprofondisci: boolean;

  // Media
  hasMedia: boolean;
  media: any[] | undefined;
  shouldUseBlurredBg: boolean;
  flexibleImageStep: string | undefined;
  flexibleImageHeight: number | undefined;
  isVideoMedia: boolean;
  mediaUrl: string | undefined;
  carouselIndex: number;

  // Active / Player
  isActive: boolean;
  essentialVoicePlayerState: string | undefined;
  audioUrl: string;
  durationSeconds: number;
  transcriptStatus: any;
  transcript: string | null | undefined;

  // Callbacks
  openFullTextDrawer: (mode: "description" | "transcript") => void;
  registerRef: (id: string) => (node: HTMLElement | null) => void;
  setSelectedMediaIndex: (index: number | null) => void;
  setCarouselIndex: (index: number) => void;

  // Refs passed as normal props (avoiding React.forwardRef complexity)
  bodyRef: React.Ref<HTMLDivElement> | undefined;
  bodyTextRef: React.Ref<HTMLDivElement> | undefined;
  mediaRef: React.Ref<HTMLDivElement> | undefined;
  slotBottomRef: React.Ref<HTMLDivElement> | undefined;
}

const VoiceCastBodyInner = ({
  postId,
  emergencyScroll,
  voiceTitle,
  voiceContent,
  bodyLineClamp,
  shouldShowApprofondisci,
  hasMedia,
  media,
  shouldUseBlurredBg,
  flexibleImageStep,
  flexibleImageHeight,
  isVideoMedia,
  mediaUrl,
  carouselIndex,
  isActive,
  essentialVoicePlayerState,
  audioUrl,
  durationSeconds,
  transcriptStatus,
  transcript,
  openFullTextDrawer,
  registerRef,
  setSelectedMediaIndex,
  setCarouselIndex,
  bodyRef,
  bodyTextRef,
  mediaRef,
  slotBottomRef,
}: VoiceCastBodyProps) => {
  const downscaledMedia = useMemo(() => {
    if (!media) return [];
    return media.map(item => ({
      ...item,
      // Video: mai trasformare l'URL (render/image fallisce sul file video).
      url: item.type === 'video' ? item.url : getCardImageUrl(item.url, 1200, 75),
      thumbnail_url: item.thumbnail_url ? getCardImageUrl(item.thumbnail_url, 1200, 75) : undefined
    }));
  }, [media]);

  const downscaledMediaUrl = useMemo(() => {
    return getCardImageUrl(mediaUrl, 1200, 75);
  }, [mediaUrl]);
  const handleDescriptionRef = (node: HTMLDivElement | null) => {
    registerRef("essential-description")(node);
    if (bodyRef) {
      if (typeof bodyRef === "function") {
        bodyRef(node);
      } else {
        (bodyRef as any).current = node;
      }
    }
    if (bodyTextRef) {
      if (typeof bodyTextRef === "function") {
        bodyTextRef(node);
      } else {
        (bodyTextRef as any).current = node;
      }
    }
  };

  const handleMediaRef = (node: HTMLDivElement | null) => {
    registerRef("flexible-image")(node);
    if (mediaRef) {
      if (typeof mediaRef === "function") {
        mediaRef(node);
      } else {
        (mediaRef as any).current = node;
      }
    }
  };
  const shouldRenderMini = hasMedia && media && media.length > 0 && !shouldUseBlurredBg;
  const shouldRenderMosaic = hasMedia && media && media.length > 0 && !shouldUseBlurredBg;

  return (
    <div
      className={cn(
        "w-full flex flex-col pt-2 pb-5",
        emergencyScroll && "overflow-y-auto"
      )}
    >
      {/* Header Essenziale: Badge + Title */}
      <div
        ref={registerRef("essential-title")}
        className="w-full flex flex-col flex-shrink-0"
      >
        {/* Title se esiste */}
        {voiceTitle && voiceTitle.trim().length > 0 && (
          <ClampedTitle
            as="h2"
            text={voiceTitle}
            maxLines={3}
            className="uppercase mb-3 flex-shrink-0"
            style={{
              fontFamily: "'Anton', 'Impact', sans-serif",
              fontSize: "clamp(30px, 8vw, 42px)",
              lineHeight: 0.92,
              letterSpacing: "-0.02em",
              color: "#FFFFFF",
              textAlign: "left",
            }}
          />
        )}
      </div>

      {/* PLAYER VOCALE — spec: subito dopo il titolo */}
      {audioUrl && (
        <div
          ref={registerRef("essential-voice-player")}
          className="w-full flex-shrink-0"
          style={{ marginBottom: '14px' }}
        >
          {isActive ? (
            <VoicePlayer
              audioUrl={audioUrl || ""}
              durationSeconds={durationSeconds || 0}
              transcript={transcript}
              transcriptStatus={transcriptStatus}
              accentColor="#10B981"
              onShowTranscript={() => openFullTextDrawer("transcript")}
            />
          ) : (
            <div className="w-full h-[52px] rounded-xl bg-white/5 border border-white/10 animate-pulse flex items-center justify-center text-xs text-white/40">
              Caricamento player vocale...
            </div>
          )}
        </div>
      )}

      {/* MEDIA — full-bleed MediaMosaic sotto il player, sopra il body */}
      {shouldRenderMosaic && media && (
        <div
          ref={handleMediaRef}
          className="flex-shrink-0 mb-3.5"
          style={{ marginLeft: '-18px', marginRight: '-18px' }}
        >
          <MediaMosaic
            media={downscaledMedia.map((m: any, i: number) => ({
              url: m.url || m.src || (i === 0 ? downscaledMediaUrl : undefined),
              type: m.type === 'video' ? 'video' : 'image',
              orientation: media[i]?.orientation ?? null,
              ratio: media[i]?.ratio ?? null,
              thumbnail_url: m.thumbnail_url ?? null,
            }))}
            onMediaClick={(idx) => setSelectedMediaIndex(idx)}
          />
        </div>
      )}

      {/* BODY sempre sotto media, larghezza piena */}
      <div className="w-full flex flex-col">
        {voiceContent && voiceContent.trim().length > 0 && (
          <div
            ref={handleDescriptionRef}
            className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6] text-left flex-shrink-0"
            style={{
              fontFamily: '"Inter", sans-serif',
              lineHeight: 1.55,
              display: "-webkit-box",
              WebkitLineClamp: bodyLineClamp,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            <MentionText content={voiceContent} />
          </div>
        )}

        {shouldShowApprofondisci && (
          <div className="flex-shrink-0 mt-1 mb-2 text-left">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openFullTextDrawer("description");
              }}
              className="text-sm text-primary font-semibold active:opacity-60 transition-opacity block"
            >
              Approfondisci
            </button>
          </div>
        )}
      </div>

      {/* slot-bottom vuoto per compat layout engine */}
      <div className="slot-bottom" ref={slotBottomRef} />
    </div>
  );
};

export const VoiceCastBody = React.memo(VoiceCastBodyInner, (prev, next) => {
  return (
    prev.postId === next.postId &&
    prev.emergencyScroll === next.emergencyScroll &&
    prev.voiceTitle === next.voiceTitle &&
    prev.voiceContent === next.voiceContent &&
    prev.bodyLineClamp === next.bodyLineClamp &&
    prev.shouldShowApprofondisci === next.shouldShowApprofondisci &&
    prev.hasMedia === next.hasMedia &&
    prev.media === next.media &&
    prev.shouldUseBlurredBg === next.shouldUseBlurredBg &&
    prev.flexibleImageStep === next.flexibleImageStep &&
    prev.flexibleImageHeight === next.flexibleImageHeight &&
    prev.isVideoMedia === next.isVideoMedia &&
    prev.mediaUrl === next.mediaUrl &&
    prev.carouselIndex === next.carouselIndex &&
    prev.isActive === next.isActive &&
    prev.essentialVoicePlayerState === next.essentialVoicePlayerState &&
    prev.audioUrl === next.audioUrl &&
    prev.durationSeconds === next.durationSeconds &&
    prev.transcriptStatus === next.transcriptStatus &&
    prev.transcript === next.transcript &&
    prev.bodyRef === next.bodyRef &&
    prev.bodyTextRef === next.bodyTextRef &&
    prev.mediaRef === next.mediaRef &&
    prev.slotBottomRef === next.slotBottomRef
  );
});

VoiceCastBody.displayName = "VoiceCastBody";
export default VoiceCastBody;

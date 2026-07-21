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
      url: getCardImageUrl(item.url, 1200, 75),
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

  return (
    <div
      className={cn(
        "w-full flex flex-col pt-2 pb-8 flex-1 min-h-0 justify-start",
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

      {/* Content wrapper: row for mini layout, column for standard layout */}
      <div
        className={cn(shouldRenderMini ? "vstage-row w-full flex gap-4" : "w-full flex flex-col")}
        style={shouldRenderMini ? { flex: '0 0 auto', marginTop: 0 } : undefined}
      >
        <div className={cn(shouldRenderMini ? "v-col flex-1 min-w-0 flex flex-col" : "w-full flex flex-col")}>
          {/* Description flessibile se esiste */}
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

          {/* Approfondisci subito dopo description (se non c'è description, dopo title) */}
          {shouldShowApprofondisci && (
            <div className="flex-shrink-0 mt-2 mb-3 text-left">
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

        {/* Colonna destra (media), SOLO se shouldRenderMini */}
        {shouldRenderMini && media && media[0] && (() => {
          const mediaForFrame = {
            src: isVideoMedia ? (media[0].thumbnail_url || mediaUrl || '') : (media[0].url || mediaUrl || ''),
            ratio: media[0].ratio || undefined,
            orientation: media[0].orientation || undefined,
            kind: isVideoMedia ? "video" as const : "image" as const,
          };
          return (
            <div
              ref={handleMediaRef}
              className="flex-shrink-0"
              style={{ 
                alignSelf: "flex-start",
                maxHeight: flexibleImageHeight ? `${flexibleImageHeight}px` : undefined
              }}
            >
              <MediaFrame
                media={mediaForFrame}
                variant="mini"
                miniMinHeight={90}
                height={flexibleImageHeight}
                onTap={() => setSelectedMediaIndex(0)}
              />
            </div>
          );
        })()}
      </div>

      {/* Image/Media flessibile per layout standard (non-mini) */}
      {!shouldRenderMini && hasMedia && media && media.length > 0 && !shouldUseBlurredBg && (
        <>
          {flexibleImageStep === "full" && (
            <div
              ref={handleMediaRef}
              className="relative flex-shrink-0 w-full flex items-center justify-center overflow-hidden mb-3 rounded-xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)] cursor-pointer"
              style={{ height: `${flexibleImageHeight}px` }}
              onClick={
                media.length === 1
                  ? (e) => {
                      e.stopPropagation();
                      setSelectedMediaIndex(0);
                    }
                  : undefined
              }
            >
              {downscaledMedia.length === 1 ? (
                isVideoMedia ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={downscaledMedia[0]?.thumbnail_url || downscaledMediaUrl}
                      alt=""
                      width={media[0]?.width || 1080}
                      height={media[0]?.height || 1080}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white p-3 rounded-full shadow-lg">
                        <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img
                    src={downscaledMediaUrl}
                    alt=""
                    width={media[0]?.width || 1080}
                    height={media[0]?.height || 1080}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain"
                  />
                )
              ) : (
                <MediaGallery
                  media={downscaledMedia}
                  onClick={(_, index) => setSelectedMediaIndex(index)}
                  initialIndex={carouselIndex}
                  onIndexChange={setCarouselIndex}
                  className="h-full w-full object-contain"
                  isActive={isActive}
                />
              )}
            </div>
          )}

          {flexibleImageStep === "pill" && (
            <div
              ref={handleMediaRef}
              className="flex-shrink-0 mb-3"
              style={{ height: "36px" }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMediaIndex(0);
                }}
                className="inline-flex h-9 items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/10 px-4 rounded-full text-white text-xs font-bold"
              >
                <span>📎 Vedi {isVideoMedia ? "video" : "immagine"}</span>
              </button>
            </div>
          )}

          {flexibleImageStep === "hidden" && (
            <div
              ref={handleMediaRef}
              style={{ height: 0, overflow: "hidden" }}
            />
          )}
        </>
      )}

      {/* Player Vocale — spec FIX A/C: render incondizionato quando audioUrl esiste.
          Il ref 'essential-voice-player' resta agganciato per il layout engine. */}
      <div className="slot-bottom" ref={slotBottomRef}>
        {audioUrl && (
          <div
            ref={registerRef("essential-voice-player")}
            className="w-full mt-auto flex-shrink-0"
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
      </div>
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

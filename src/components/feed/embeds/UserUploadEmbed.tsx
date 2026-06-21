import React, { memo, useState, useMemo } from "react";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { MediaGallery } from "@/components/media/MediaGallery";
import { MediaFrame } from "@/components/shared/MediaFrame";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { countPostWords, calculateMediaLayout, getCardImageUrl } from "@/lib/mediaUtils";
import type { UnifiedMedia } from "@/types/media";

interface UserUploadEmbedProps {
  postTitle?: string;
  postContent?: string;
  postMedia?: any[];
  normalizedMedias: UnifiedMedia[];
  isNearActive: boolean;
  isActive: boolean;
  useStackLayout: boolean;
  emergencyScroll: boolean;
  bodyLineClamp: number;
  shouldShowApprofondisci: boolean;
  flexiblesStatus: any;

  // Callbacks
  onOpenFullText: (mode: "description" | "transcript") => void;
  registerRef: (id: string) => (node: HTMLElement | null) => void;
  onMediaTap?: (index: number) => void;

  // Refs
  titleRef?: React.RefObject<any> | ((node: any) => void);
  bodyRef?: React.RefObject<any> | ((node: any) => void);
  bodyTextRef?: React.RefObject<any> | React.MutableRefObject<any> | ((node: any) => void);
  mediaRef?: React.RefObject<any> | ((node: any) => void);
}

const UserUploadEmbedInner = ({
  postTitle,
  postContent,
  postMedia = [],
  normalizedMedias = [],
  isNearActive,
  isActive,
  useStackLayout,
  emergencyScroll,
  bodyLineClamp,
  shouldShowApprofondisci,
  flexiblesStatus,
  onOpenFullText,
  registerRef,
  onMediaTap,
  titleRef,
  bodyRef,
  bodyTextRef,
  mediaRef,
}: UserUploadEmbedProps) => {
  // Localized carousel state
  const [carouselIndex, setCarouselIndex] = useState(0);

  const wordCount = useMemo(() => {
    return countPostWords(postTitle || "", postContent || "");
  }, [postTitle, postContent]);

  const hasMedia = postMedia && postMedia.length > 0;
  const isVideoMedia = postMedia?.[0]?.type === "video";
  const mediaUrl = postMedia?.[0]?.url || "";

  const downscaledPostMedia = useMemo(() => {
    if (!postMedia) return [];
    return postMedia.map(item => ({
      ...item,
      url: getCardImageUrl(item.url, 1200, 75),
      thumbnail_url: item.thumbnail_url ? getCardImageUrl(item.thumbnail_url, 1200, 75) : undefined
    }));
  }, [postMedia]);

  const downscaledMediaUrl = useMemo(() => {
    return getCardImageUrl(mediaUrl, 1200, 75);
  }, [mediaUrl]);

  const userUploadMedia = normalizedMedias.find((m) => m.source === "user_upload");
  const linkPreviewMedia = normalizedMedias.find((m) => m.source === "link_preview");
  const hasPreviewMetadata = false && !!linkPreviewMedia;
  const isMiniLayout =
    (userUploadMedia &&
      userUploadMedia.kind === "image" &&
      calculateMediaLayout(userUploadMedia, wordCount) === "mini") ||
    (linkPreviewMedia &&
      hasPreviewMetadata &&
      calculateMediaLayout(linkPreviewMedia, wordCount) === "mini");

  return (
    <div
      className={cn(
        "flex-1 min-h-0 flex flex-col justify-start w-full",
        emergencyScroll && "overflow-y-auto"
      )}
    >
      {/* Title */}
      {postTitle && postTitle.trim().length > 0 && (
        <ClampedTitle
          as="h2"
          text={postTitle}
          maxLines={3}
          ref={titleRef}
          className="uppercase mb-2 flex-shrink-0"
          style={{
            fontFamily: "Impact, sans-serif",
            fontSize: "clamp(30px, 8vw, 42px)",
            lineHeight: 0.92,
            letterSpacing: "-0.02em",
            color: "#FFFFFF",
            textAlign: "left",
          }}
        />
      )}

      {/* Body text — unico flessibile o primo flessibile (renderizzato qui solo se NON mini layout) */}
      {!isMiniLayout && postContent && postContent.trim().length > 0 && (
        <div
          ref={(el) => {
            if (bodyRef) {
              if (typeof bodyRef === "function") bodyRef(el);
              else (bodyRef as any).current = el;
            }
            if (bodyTextRef) {
              if (typeof bodyTextRef === "function") bodyTextRef(el);
              else (bodyTextRef as any).current = el;
            }
          }}
          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6]"
          style={{
            fontFamily: "Inter, sans-serif",
            lineHeight: 1.55,
            textAlign: "left",
            display: "-webkit-box",
            WebkitLineClamp: bodyLineClamp,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          <MentionText content={postContent} />
        </div>
      )}

      {/* Approfondisci (subito dopo il body text - renderizzato qui solo se NON mini layout) */}
      {!isMiniLayout && shouldShowApprofondisci && (
        <div className="flex-shrink-0 mt-2 mb-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenFullText("description");
            }}
            className="text-sm text-primary font-semibold hover:underline block"
          >
            Approfondisci
          </button>
        </div>
      )}

      {/* Image/Media — secondo flessibile (se presente) */}
      {hasMedia && (
        <>
          {/* Caso singolo upload immagine utente con matrice §5.1 */}
          {normalizedMedias.length === 1 &&
          normalizedMedias[0].kind === "image" ? (
            (() => {
              const mediaForFrame = normalizedMedias[0];
              const layout = calculateMediaLayout(mediaForFrame, wordCount);
              const imageStep = flexiblesStatus?.["flexible-image"]?.step || "full";

              if (imageStep === "pill") {
                return (
                  <div
                    ref={(node) => {
                      registerRef("flexible-image")(node);
                      if (mediaRef) {
                        if (typeof mediaRef === "function") mediaRef(node);
                        else (mediaRef as any).current = node;
                      }
                    }}
                    className="flex-shrink-0 mb-3"
                    style={{ height: "36px" }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMediaTap?.(0);
                      }}
                      className="inline-flex h-9 items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/10 px-4 rounded-full text-white text-xs font-bold"
                    >
                      <span>📎 Vedi immagine</span>
                    </button>
                  </div>
                );
              }

              if (imageStep === "hidden") {
                return (
                  <div
                    ref={(node) => {
                      registerRef("flexible-image")(node);
                      if (mediaRef) {
                        if (typeof mediaRef === "function") mediaRef(node);
                        else (mediaRef as any).current = node;
                      }
                    }}
                    style={{ height: 0, overflow: "hidden" }}
                  />
                );
              }

              if (layout === "mini") {
                return (
                  <div className="vstage-row">
                    <div className="v-col">
                      {postContent && postContent.trim().length > 0 && (
                        <div
                          ref={(el) => {
                            if (bodyRef) {
                              if (typeof bodyRef === "function") bodyRef(el);
                              else (bodyRef as any).current = el;
                            }
                            if (bodyTextRef) {
                              if (typeof bodyTextRef === "function") bodyTextRef(el);
                              else (bodyTextRef as any).current = el;
                            }
                          }}
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6]"
                          style={{
                            fontFamily: "Inter, sans-serif",
                            lineHeight: 1.55,
                            textAlign: "left",
                            display: "-webkit-box",
                            WebkitLineClamp: bodyLineClamp,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          <MentionText content={postContent} />
                        </div>
                      )}
                      {shouldShowApprofondisci && (
                        <div className="flex-shrink-0 mt-2 mb-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenFullText("description");
                            }}
                            className="text-sm text-primary font-semibold hover:underline block"
                          >
                            Approfondisci
                          </button>
                        </div>
                      )}
                    </div>
                    <div
                      ref={(node) => {
                        registerRef("flexible-image")(node);
                        if (mediaRef) {
                          if (typeof mediaRef === "function") mediaRef(node);
                          else (mediaRef as any).current = node;
                        }
                      }}
                      className="flex-shrink-0"
                      style={{ alignSelf: "flex-start" }}
                    >
                      <MediaFrame
                        media={mediaForFrame}
                        variant="mini"
                        onTap={() => onMediaTap?.(0)}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            pointerEvents: "auto",
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            background: "rgba(0,0,0,0.45)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: 13,
                          }}
                        >
                          ⤢
                        </div>
                      </MediaFrame>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  ref={(node) => {
                    registerRef("flexible-image")(node);
                    if (mediaRef) {
                      if (typeof mediaRef === "function") mediaRef(node);
                      else (mediaRef as any).current = node;
                    }
                  }}
                  className="w-full flex-shrink-0"
                >
                  <MediaFrame
                    media={mediaForFrame}
                    variant={layout}
                    onTap={() => onMediaTap?.(0)}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        pointerEvents: "auto",
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        background: "rgba(0,0,0,0.45)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: 14,
                      }}
                    >
                      ⤢
                    </div>
                  </MediaFrame>
                </div>
              );
            })()
          ) : (
            /* Caso carousel o video — mantieni legacy */
            <>
              {flexiblesStatus["flexible-image"]?.step === "full" && (
                <div
                  ref={(node) => {
                    registerRef("flexible-image")(node);
                    if (mediaRef) {
                      if (typeof mediaRef === "function") mediaRef(node);
                      else (mediaRef as any).current = node;
                    }
                  }}
                  className="relative flex-shrink-0 w-full flex items-center justify-center overflow-hidden mb-3 rounded-xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)] cursor-pointer"
                  style={{ height: `${flexiblesStatus["flexible-image"].height}px` }}
                  onClick={
                    postMedia.length === 1
                      ? (e) => {
                          e.stopPropagation();
                          onMediaTap?.(0);
                        }
                      : undefined
                  }
                >
                  {postMedia.length === 1 ? (
                    isVideoMedia ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <img
                          src={downscaledPostMedia?.[0]?.thumbnail_url || downscaledMediaUrl}
                          alt=""
                          width={postMedia?.[0]?.width || 1080}
                          height={postMedia?.[0]?.height || 1080}
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
                        width={postMedia?.[0]?.width || 1080}
                        height={postMedia?.[0]?.height || 1080}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain"
                      />
                    )
                  ) : (
                    <MediaGallery
                      media={downscaledPostMedia}
                      onClick={(_, index) => onMediaTap?.(index)}
                      initialIndex={carouselIndex}
                      onIndexChange={setCarouselIndex}
                      className="h-full w-full object-contain"
                      isActive={isActive}
                    />
                  )}
                </div>
              )}

              {flexiblesStatus["flexible-image"]?.step === "pill" && (
                <div
                  ref={(node) => {
                    registerRef("flexible-image")(node);
                    if (mediaRef) {
                      if (typeof mediaRef === "function") mediaRef(node);
                      else (mediaRef as any).current = node;
                    }
                  }}
                  className="flex-shrink-0 mb-3"
                  style={{ height: "36px" }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMediaTap?.(0);
                    }}
                    className="inline-flex h-9 items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/10 px-4 rounded-full text-white text-xs font-bold"
                  >
                    <span>📎 Vedi {isVideoMedia ? "video" : "immagine"}</span>
                  </button>
                </div>
              )}

              {flexiblesStatus["flexible-image"]?.step === "hidden" && (
                <div
                  ref={(node) => {
                    registerRef("flexible-image")(node);
                    if (mediaRef) {
                      if (typeof mediaRef === "function") mediaRef(node);
                      else (mediaRef as any).current = node;
                    }
                  }}
                  style={{ height: 0, overflow: "hidden" }}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export const UserUploadEmbed = memo(UserUploadEmbedInner, (prevProps, nextProps) => {
  return (
    prevProps.postTitle === nextProps.postTitle &&
    prevProps.postContent === nextProps.postContent &&
    prevProps.isNearActive === nextProps.isNearActive &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.useStackLayout === nextProps.useStackLayout &&
    prevProps.emergencyScroll === nextProps.emergencyScroll &&
    prevProps.bodyLineClamp === nextProps.bodyLineClamp &&
    prevProps.shouldShowApprofondisci === nextProps.shouldShowApprofondisci &&
    (prevProps.postMedia === nextProps.postMedia ||
      (prevProps.postMedia?.length === nextProps.postMedia?.length &&
        (prevProps.postMedia || []).every(
          (val, idx) =>
            val?.url === nextProps.postMedia?.[idx]?.url &&
            val?.type === nextProps.postMedia?.[idx]?.type
        ))) &&
    (prevProps.normalizedMedias === nextProps.normalizedMedias ||
      (prevProps.normalizedMedias?.length === nextProps.normalizedMedias?.length &&
        (prevProps.normalizedMedias || []).every(
          (val, idx) =>
            val.src === nextProps.normalizedMedias[idx].src &&
            val.ratio === nextProps.normalizedMedias[idx].ratio &&
            val.orientation === nextProps.normalizedMedias[idx].orientation &&
            val.kind === nextProps.normalizedMedias[idx].kind
        ))) &&
    prevProps.flexiblesStatus?.["flexible-image"]?.step ===
      nextProps.flexiblesStatus?.["flexible-image"]?.step &&
    prevProps.flexiblesStatus?.["flexible-image"]?.height ===
      nextProps.flexiblesStatus?.["flexible-image"]?.height
  );
});

UserUploadEmbed.displayName = "UserUploadEmbed";

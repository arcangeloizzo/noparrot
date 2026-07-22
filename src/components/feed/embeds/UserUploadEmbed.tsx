import React, { memo, useState, useMemo, useRef } from "react";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { MediaFrame } from "@/components/shared/MediaFrame";
import { MediaMosaic } from "../MediaMosaic";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { countPostWords, calculateMediaLayout, getCardImageUrl } from "@/lib/mediaUtils";
import type { UnifiedMedia } from "@/types/media";

interface UserUploadEmbedProps {
  postTitle?: string;
  postContent?: string;
  layoutMode?: 'filled' | 'hero' | 'poster';
  accentColor?: string;
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
  onMediaTap?: (index: number, el?: HTMLElement | null) => void;

  // Refs
  titleRef?: React.RefObject<any> | ((node: any) => void);
  bodyRef?: React.RefObject<any> | ((node: any) => void);
  bodyTextRef?: React.RefObject<any> | React.MutableRefObject<any> | ((node: any) => void);
  mediaRef?: React.RefObject<any> | ((node: any) => void);
}

const UserUploadEmbedInner = ({
  postTitle,
  postContent,
  layoutMode = 'filled',
  accentColor,
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
  const frameNodeRef = useRef<HTMLElement | null>(null);

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
      // Video: URL invariato. Immagini: preferisci thumbnail_url raw se esiste
      // (mitigazione performance interim con /render/image/ disattivato).
      url: item.type === 'video'
        ? item.url
        : (item.thumbnail_url || item.url),
      thumbnail_url: item.thumbnail_url || undefined,
    }));
  }, [postMedia]);

  const downscaledMediaUrl = useMemo(() => {
    return mediaUrl;
  }, [mediaUrl]);

  const userUploadMedia = normalizedMedias.find((m) => m.source === "user_upload");
  const linkPreviewMedia = normalizedMedias.find((m) => m.source === "link_preview");
  const hasPreviewMetadata = false && !!linkPreviewMedia;

  const isLandscape = userUploadMedia?.orientation === 'landscape';
  const isWordCountMini = userUploadMedia
    ? calculateMediaLayout(userUploadMedia, wordCount) === "mini"
    : false;
  const isEngineMini = flexiblesStatus?.["flexible-image"]?.step === "mini";

  const shouldRenderMini = !!(
    userUploadMedia &&
    userUploadMedia.kind === "image" &&
    !isLandscape &&
    (isWordCountMini || isEngineMini)
  );

  const isPoster = layoutMode === 'poster';
  const isLettura = layoutMode === 'filled' && !hasMedia && wordCount >= 30;

  return (
    <div
      className={cn(
        "flex-1 min-h-0 flex flex-col justify-start w-full",
        emergencyScroll && "overflow-y-auto"
      )}
    >
      {isLettura && accentColor && (
        <div className="lettura-accent" style={{ background: accentColor }} />
      )}

      {isPoster && accentColor && (
        <div className="poster-accent" style={{ background: accentColor }} />
      )}

      {/* Title */}
      {postTitle && postTitle.trim().length > 0 && (
        <ClampedTitle
          as="h2"
          text={postTitle}
          maxLines={6}
          ref={titleRef}
          className={cn("uppercase mb-3.5 flex-shrink-0", isPoster && "text-center")}
          style={{
            fontFamily: "'Anton', 'Impact', sans-serif",
            fontSize: isPoster ? "clamp(42px, 12vw, 58px)" : "clamp(30px, 8vw, 42px)",
            lineHeight: isPoster ? 1.02 : 0.92,
            letterSpacing: "-0.02em",
            color: "#FFFFFF",
            textAlign: isPoster ? "center" : "left",
          }}
        />
      )}

      {/* Image/Media — spostato SUBITO DOPO il titolo (ordine: Title → MEDIA → Body → Approfondisci) */}
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
                      frameNodeRef.current = node;
                      if (mediaRef) {
                        if (typeof mediaRef === "function") mediaRef(node);
                        else (mediaRef as any).current = node;
                      }
                    }}
                    className="flex-shrink-0 mb-3.5"
                    style={{ height: "36px" }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMediaTap?.(0, frameNodeRef.current);
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
                      frameNodeRef.current = node;
                      if (mediaRef) {
                        if (typeof mediaRef === "function") mediaRef(node);
                        else (mediaRef as any).current = node;
                      }
                    }}
                    style={{ height: 0, overflow: "hidden" }}
                  />
                );
              }

              if (shouldRenderMini) {
                return (
                  <div className="vstage-row">
                    <div className="v-col">
                      {postContent && postContent.trim().length > 0 && (
                        <div
                          ref={(el) => {
                            registerRef("essential-description")(el);
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
                        <div className="flex-shrink-0 mt-2 mb-3 text-left">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenFullText("description");
                            }}
                            className="text-sm text-primary font-semibold active:opacity-60 transition-opacity block"
                          >
                            Approfondisci
                          </button>
                        </div>
                      )}
                    </div>
                    <div
                      ref={(node) => {
                        registerRef("flexible-image")(node);
                        frameNodeRef.current = node;
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
                        height={flexiblesStatus?.["flexible-image"]?.height}
                        onTap={() => onMediaTap?.(0, frameNodeRef.current)}
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
                    frameNodeRef.current = node;
                    if (mediaRef) {
                      if (typeof mediaRef === "function") mediaRef(node);
                      else (mediaRef as any).current = node;
                    }
                  }}
                  className="w-full flex-shrink-0 mb-3.5"
                >
                  <MediaFrame
                    media={mediaForFrame}
                    variant={layout}
                    height={imageStep === "mini" ? flexiblesStatus?.["flexible-image"]?.height : undefined}
                    onTap={() => onMediaTap?.(0, frameNodeRef.current)}
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
                    frameNodeRef.current = node;
                    if (mediaRef) {
                      if (typeof mediaRef === "function") mediaRef(node);
                      else (mediaRef as any).current = node;
                    }
                  }}
                  className="flex-shrink-0 mb-3.5"
                  style={{ marginLeft: '-18px', marginRight: '-18px' }}
                >
                  <MediaMosaic
                    media={downscaledPostMedia.map((m: any, i: number) => ({
                      url: m.url,
                      type: m.type === 'video' ? 'video' : 'image',
                      orientation: postMedia?.[i]?.orientation ?? null,
                      ratio: postMedia?.[i]?.ratio ?? null,
                      thumbnail_url: m.thumbnail_url ?? null,
                    }))}
                    onMediaClick={(idx, el) => onMediaTap?.(idx, el)}
                  />
                </div>
              )}

              {flexiblesStatus["flexible-image"]?.step === "pill" && (
                <div
                  ref={(node) => {
                    registerRef("flexible-image")(node);
                    frameNodeRef.current = node;
                    if (mediaRef) {
                      if (typeof mediaRef === "function") mediaRef(node);
                      else (mediaRef as any).current = node;
                    }
                  }}
                  className="flex-shrink-0 mb-3.5"
                  style={{ height: "36px" }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMediaTap?.(0, frameNodeRef.current);
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
                    frameNodeRef.current = node;
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

      {/* Body text — unico flessibile o primo flessibile (renderizzato qui solo se NON mini layout) */}
      {!shouldRenderMini && postContent && postContent.trim().length > 0 && (
        <div
          ref={(el) => {
            registerRef("essential-description")(el);
            if (bodyRef) {
              if (typeof bodyRef === "function") bodyRef(el);
              else (bodyRef as any).current = el;
            }
            if (bodyTextRef) {
              if (typeof bodyTextRef === "function") bodyTextRef(el);
              else (bodyTextRef as any).current = el;
            }
          }}
          className={cn("whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6]", isPoster && "text-center")}
          style={{
            fontFamily: "Inter, sans-serif",
            lineHeight: 1.55,
            textAlign: isPoster ? "center" : "left",
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
      {!shouldRenderMini && shouldShowApprofondisci && (
        <div className="flex-shrink-0 mt-2 mb-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenFullText("description");
            }}
            className="text-sm text-primary font-semibold active:opacity-60 transition-opacity block"
          >
            Approfondisci
          </button>
        </div>
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

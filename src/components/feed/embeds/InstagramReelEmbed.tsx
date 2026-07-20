import React, { memo, useMemo } from "react";
import { Play } from "lucide-react";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { cn, decodeHTMLEntities } from "@/lib/utils";
import { MediaFrame } from "@/components/shared/MediaFrame";
import { countPostWords, calculateMediaLayout } from "@/lib/mediaUtils";

interface InstagramReelEmbedProps {
  postTitle?: string;
  postContent?: string;
  sharedUrl?: string;
  sharedTitle?: string;
  articlePreview?: {
    title?: string;
    description?: string;
    image?: string;
    platform?: string;
  } | null;
  useStackLayout: boolean;
  emergencyScroll: boolean;
  bodyLineClamp: number;
  shouldShowApprofondisci: boolean;
  flexiblesStatus: any;

  // Callbacks
  onOpenFullText: (mode: "description" | "transcript") => void;
  registerRef: (id: string) => (node: HTMLElement | null) => void;

  // Refs
  bodyRef?: React.RefObject<any> | ((node: any) => void);
  bodyTextRef?: React.RefObject<any> | React.MutableRefObject<any> | ((node: any) => void);
  captionTextRef?: React.RefObject<any> | React.MutableRefObject<any> | ((node: any) => void);
  slotBottomRef?: React.RefObject<any> | ((node: any) => void);

  // New optional props for foreground media layout
  isNearActive?: boolean;
  isActive?: boolean;
  normalizedMedias?: any[];
  onMediaTap?: (index: number) => void;
  titleRef?: React.RefObject<any> | ((node: any) => void);
  mediaRef?: React.RefObject<any> | ((node: any) => void);
}

const InstagramReelEmbedInner = ({
  postTitle,
  postContent,
  sharedUrl,
  sharedTitle,
  articlePreview,
  useStackLayout,
  emergencyScroll,
  bodyLineClamp,
  shouldShowApprofondisci,
  flexiblesStatus,
  onOpenFullText,
  registerRef,
  bodyRef,
  bodyTextRef,
  captionTextRef,
  slotBottomRef,
  isNearActive,
  isActive,
  normalizedMedias,
  onMediaTap,
  titleRef,
  mediaRef,
}: InstagramReelEmbedProps) => {
  const mediaForFrame = useMemo(() => {
    const firstMedia = normalizedMedias?.[0];
    if (!firstMedia) return null;
    return {
      src: firstMedia.src,
      ratio: "9:16" as const,
      orientation: "portrait" as const,
      kind: "video" as const,
    };
  }, [normalizedMedias]);

  const hasValidMedia = !!mediaForFrame?.src;

  const wordCount = useMemo(() => {
    return countPostWords(postTitle || "", postContent || "");
  }, [postTitle, postContent]);

  const layout = mediaForFrame ? calculateMediaLayout(mediaForFrame, wordCount) : 'tall';
  const isMiniLayout = layout === "mini";
  const imageStep = flexiblesStatus?.["flexible-image"]?.step || "full";
  const shouldRenderMini = hasValidMedia && (isMiniLayout || imageStep === "mini");

  return (
    <div
      className={cn(
        "flex-1 min-h-0 flex flex-col justify-start w-full px-4 gap-3",
        emergencyScroll && "overflow-y-auto"
      )}
    >
      {/* Title */}
      {postTitle && postTitle.trim().length > 0 ? (
        <ClampedTitle
          as="h2"
          text={postTitle}
          maxLines={3}
          ref={titleRef || registerRef("essential-title")}
          className="uppercase mb-2 flex-shrink-0 self-start text-left"
          style={{
            fontFamily: "'Anton', 'Impact', sans-serif",
            fontSize: "clamp(30px, 8vw, 42px)",
            lineHeight: 0.92,
            letterSpacing: "-0.02em",
            color: "#FFFFFF",
            textAlign: "left",
          }}
        />
      ) : (
        <ClampedTitle
          as="h2"
          text={decodeHTMLEntities(articlePreview?.title || sharedTitle || "Instagram Reel")}
          maxLines={3}
          ref={titleRef || registerRef("essential-title")}
          className="text-xl font-bold text-immersive-foreground leading-tight mt-1 mb-2 flex-shrink-0 self-start text-left"
        />
      )}

      {shouldRenderMini ? (
        <div className="vstage-row w-full flex gap-4" style={{ minHeight: 192, flexShrink: 0 }}>
          <div className="v-col flex-1 min-w-0 flex flex-col">
            {postContent && postContent.trim().length > 0 && (
              <p
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
                className="self-start text-sm text-white/90 leading-relaxed mb-3 text-left flex-shrink-0 w-full"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: bodyLineClamp,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                <MentionText content={postContent} />
              </p>
            )}
            {flexiblesStatus["flexible-text"]?.step !== "hidden" && sharedTitle && (
              <p
                ref={(el) => {
                  registerRef("flexible-text")(el);
                  if (captionTextRef) {
                    if (typeof captionTextRef === "function") captionTextRef(el);
                    else (captionTextRef as any).current = el;
                  }
                }}
                className={cn(
                  "self-start leading-relaxed mb-3 text-left flex-shrink-0 w-full text-xs text-white/60",
                  flexiblesStatus["flexible-text"]?.step === "compact"
                    ? "line-clamp-2"
                    : "line-clamp-4"
                )}
              >
                <MentionText content={sharedTitle} />
              </p>
            )}
            {shouldShowApprofondisci && (
              <div className="flex-shrink-0 mt-2 mb-3 text-left self-start">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenFullText("description");
                  }}
                  className="text-sm font-semibold active:opacity-60 transition-opacity block text-primary"
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
            className={cn("flex-shrink-0", !hasValidMedia && "h-0 w-0 overflow-hidden")}
            style={hasValidMedia ? { alignSelf: "flex-start" } : undefined}
          >
            {hasValidMedia && mediaForFrame && (
              <MediaFrame
                media={mediaForFrame}
                variant="mini"
                onTap={() => { if (sharedUrl) window.open(sharedUrl, '_blank', 'noopener,noreferrer'); }}
              >
                <>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 42, height: 42, borderRadius: '50%', background: 'rgba(10,14,22,0.55)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', pointerEvents: 'none', zIndex: 2 }}>
                    <Play className="text-white fill-white" style={{ width: 16, height: 16, marginLeft: 2 }} />
                  </div>
                  <div style={{ position: 'absolute', left: 8, bottom: 8, display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', letterSpacing: '0.08em', fontWeight: 600, color: '#fff', background: 'rgba(10,14,22,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', padding: '4px 9px', borderRadius: '999px', pointerEvents: 'none', zIndex: 2 }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'linear-gradient(45deg, #F58529, #DD2A7B, #8134AF)', display: 'block' }} />
                    REEL
                  </div>
                </>
              </MediaFrame>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-3">
          {/* STAGE VERTICALE full-bleed */}
          <div
            ref={(node) => {
              registerRef("flexible-image")(node);
              if (mediaRef) {
                if (typeof mediaRef === "function") mediaRef(node);
                else (mediaRef as any).current = node;
              }
            }}
            className={cn("flex-shrink-0", hasValidMedia ? "w-full mb-1" : "h-0 w-0 overflow-hidden")}
          >
            {hasValidMedia && mediaForFrame && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (sharedUrl) window.open(sharedUrl, '_blank', 'noopener,noreferrer');
                }}
                className="relative"
                style={{
                  marginLeft: "-18px",
                  marginRight: "-18px",
                  height: "min(64svh, 560px)",
                  overflow: "hidden",
                  background: "#07090f",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url(${mediaForFrame.src})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    filter: "blur(28px) brightness(0.5) saturate(130%)",
                    transform: "scale(1.15)",
                  }}
                />
                <img
                  src={mediaForFrame.src}
                  loading="lazy"
                  alt=""
                  style={{
                    position: "relative",
                    zIndex: 1,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
                {/* Play glass */}
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "66px",
                    height: "66px",
                    borderRadius: "50%",
                    background: "rgba(10,14,22,0.55)",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    border: "1px solid rgba(255,255,255,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                >
                  <Play className="w-6 h-6 text-white fill-white" style={{ marginLeft: "2px" }} />
                </div>
                {/* Chip REEL */}
                <span
                  style={{
                    position: "absolute",
                    left: "10px",
                    bottom: "10px",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "10px",
                    letterSpacing: "0.08em",
                    fontWeight: 600,
                    color: "#fff",
                    background: "rgba(10,14,22,0.65)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    padding: "4px 9px",
                    borderRadius: "999px",
                    pointerEvents: "none",
                  }}
                >
                  <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "linear-gradient(45deg, #F58529, #DD2A7B, #8134AF)", display: "block" }} />
                  REEL
                </span>
              </div>
            )}
          </div>
          {/* META */}
          {hasValidMedia && (
            <div ref={slotBottomRef} className="flex items-center justify-between mt-3">
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                INSTAGRAM REEL
              </span>
              {sharedUrl && (
                <button
                  onClick={(e) => { e.stopPropagation(); window.open(sharedUrl, '_blank', 'noopener,noreferrer'); }}
                  className="inline-flex items-center gap-1.5 active:opacity-60 transition-opacity"
                >
                  <span style={{ width: "11px", height: "11px", borderRadius: "3px", background: "linear-gradient(45deg, #F58529, #DD2A7B, #8134AF)", display: "block" }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", letterSpacing: "0.08em", fontWeight: 600, background: "linear-gradient(45deg, #F58529, #DD2A7B, #8134AF)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                    APRI SU INSTAGRAM
                  </span>
                </button>
              )}
            </div>
          )}
          {/* Body / Caption / Approfondisci */}
          {postContent && postContent.trim().length > 0 && (
            <p
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
              className="self-start text-sm text-white/90 leading-relaxed mb-3 text-left flex-shrink-0 w-full"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: bodyLineClamp,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              <MentionText content={postContent} />
            </p>
          )}
          {flexiblesStatus["flexible-text"]?.step !== "hidden" && sharedTitle && (
            <p
              ref={(el) => {
                registerRef("flexible-text")(el);
                if (captionTextRef) {
                  if (typeof captionTextRef === "function") captionTextRef(el);
                  else (captionTextRef as any).current = el;
                }
              }}
              className={cn(
                "self-start leading-relaxed mb-3 text-left flex-shrink-0 w-full text-sm text-white/80",
                flexiblesStatus["flexible-text"]?.step === "compact"
                  ? "line-clamp-2"
                  : "line-clamp-4"
              )}
            >
              <MentionText content={sharedTitle} />
            </p>
          )}
          {shouldShowApprofondisci && (
            <div className="flex-shrink-0 mt-2 mb-3 text-left self-start">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFullText("description");
                }}
                className="text-sm font-semibold active:opacity-60 transition-opacity block text-primary"
              >
                Approfondisci
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const InstagramReelEmbed = memo(InstagramReelEmbedInner, (prevProps, nextProps) => {
  return (
    prevProps.isNearActive === nextProps.isNearActive &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.postTitle === nextProps.postTitle &&
    prevProps.postContent === nextProps.postContent &&
    prevProps.sharedUrl === nextProps.sharedUrl &&
    prevProps.sharedTitle === nextProps.sharedTitle &&
    prevProps.useStackLayout === nextProps.useStackLayout &&
    prevProps.emergencyScroll === nextProps.emergencyScroll &&
    prevProps.bodyLineClamp === nextProps.bodyLineClamp &&
    prevProps.shouldShowApprofondisci === nextProps.shouldShowApprofondisci &&
    prevProps.articlePreview?.title === nextProps.articlePreview?.title &&
    prevProps.articlePreview?.description === nextProps.articlePreview?.description &&
    prevProps.articlePreview?.image === nextProps.articlePreview?.image &&
    prevProps.articlePreview?.platform === nextProps.articlePreview?.platform &&
    prevProps.onMediaTap === nextProps.onMediaTap &&
    prevProps.flexiblesStatus?.["flexible-image"]?.step ===
      nextProps.flexiblesStatus?.["flexible-image"]?.step &&
    prevProps.flexiblesStatus?.["flexible-image"]?.height ===
      nextProps.flexiblesStatus?.["flexible-image"]?.height
  );
});

InstagramReelEmbed.displayName = "InstagramReelEmbed";

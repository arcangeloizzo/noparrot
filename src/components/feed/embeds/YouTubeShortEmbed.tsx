import React, { memo, useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { cn, decodeHTMLEntities } from "@/lib/utils";
import { MediaFrame } from "@/components/shared/MediaFrame";
import { Play, Maximize2, X } from "lucide-react";
import { countPostWords, calculateMediaLayout, extractYoutubeVideoId } from "@/lib/mediaUtils";
import type { UnifiedMedia } from "@/types/media";

interface YouTubeShortEmbedProps {
  isNearActive: boolean;
  isActive: boolean;
  normalizedMedias: UnifiedMedia[];
  articlePreview?: {
    title?: string;
    description?: string;
    image?: string;
    platform?: string;
  } | null;
  
  // Parent state / props
  postTitle?: string;
  postContent?: string;
  sharedUrl?: string;
  sharedTitle?: string;
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
  captionTextRef?: React.RefObject<any> | React.MutableRefObject<any> | ((node: any) => void);
  slotBottomRef?: React.RefObject<any> | ((node: any) => void);
}

const YouTubeShortEmbedInner = ({
  isNearActive,
  isActive,
  normalizedMedias = [],
  articlePreview,
  postTitle,
  postContent,
  sharedUrl,
  sharedTitle,
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
  captionTextRef,
  slotBottomRef,
}: YouTubeShortEmbedProps) => {
  const videoId = useMemo(() => {
    return sharedUrl ? extractYoutubeVideoId(sharedUrl) : null;
  }, [sharedUrl]);

  // Video playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [theaterOpen, setTheaterOpen] = useState(false);
  // 3-level thumbnail fallback states
  const [imageStatus, setImageStatus] = useState<'maxres' | 'hq' | 'placeholder'>('maxres');
  const [imgSrc, setImgSrc] = useState<string>("");

  useEffect(() => {
    setIsPlaying(false);
    setTheaterOpen(false);
    setImageStatus('maxres');
    if (videoId) {
      setImgSrc(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`);
    } else {
      setImgSrc("");
    }
  }, [videoId]);

  // Reset video if card is swiped away
  useEffect(() => {
    if (!isActive) {
      setIsPlaying(false);
      setTheaterOpen(false);
    }
  }, [isActive]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    if (img.naturalWidth === 120 && img.naturalHeight === 90) {
      if (imageStatus === 'maxres' && videoId) {
        setImageStatus('hq');
        setImgSrc(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
      }
    }
  };

  const handleImageError = () => {
    if (imageStatus === 'maxres' && videoId) {
      setImageStatus('hq');
      setImgSrc(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
    } else if (imageStatus === 'hq') {
      setImageStatus('placeholder');
      setImgSrc("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"); // transparent pixel
    }
  };

  const wordCount = useMemo(() => {
    return countPostWords(postTitle || "", postContent || "");
  }, [postTitle, postContent]);

  const mediaForFrame = useMemo(() => {
    return {
      src: imgSrc,
      ratio: "9:16" as const,
      orientation: "portrait" as const,
      kind: "video" as const,
    };
  }, [imgSrc]);

  // Deciding layout using standard photo mechanism (wordCount threshold in calculateMediaLayout)
  const layout = mediaForFrame ? calculateMediaLayout(mediaForFrame, wordCount) : 'tall';
  const isMiniLayout = layout === "mini";
  const imageStep = flexiblesStatus?.["flexible-image"]?.step || "full";
  const shouldRenderMini = isMiniLayout || imageStep === "mini";

  const playButtonSize = shouldRenderMini ? 42 : 58;
  const playIconSize = shouldRenderMini ? 16 : 24;

  const mediaOverlay = !isPlaying ? (
    <>
      {/* 3rd-level brand-colored placeholder card underneath if thumbnail loading failed */}
      {imageStatus === 'placeholder' && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #0f0f13 0%, #1e0a0d 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            zIndex: 1,
            pointerEvents: "none"
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "120px",
              height: "120px",
              background: "rgba(255, 0, 0, 0.1)",
              borderRadius: "50%",
              filter: "blur(24px)",
              pointerEvents: "none"
            }}
          />
          {/* YouTube icon */}
          <svg
            className="w-10 h-10 text-[#FF0000]"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ filter: "drop-shadow(0 2px 8px rgba(255,0,0,0.3))" }}
          >
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
            <polygon fill="white" points="9.545,15.568 15.818,12 9.545,8.432" />
          </svg>
          <span
            style={{
              fontSize: "11px",
              fontWeight: "bold",
              color: "rgba(255, 255, 255, 0.6)",
              letterSpacing: "0.05em",
              textTransform: "uppercase"
            }}
          >
            YouTube Shorts
          </span>
        </div>
      )}

      {/* Chip SHORTS basso-sx */}
      <div
        style={{
          position: "absolute",
          left: shouldRenderMini ? 8 : 10,
          bottom: shouldRenderMini ? 8 : 10,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: shouldRenderMini ? "9px" : "10px",
          letterSpacing: "0.08em",
          fontWeight: 600,
          color: "#fff",
          background: "rgba(10,14,22,0.65)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          padding: "4px 9px",
          borderRadius: "999px",
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
          <polygon fill="white" points="9.545,15.568 15.818,12 9.545,8.432" />
        </svg>
        SHORTS
      </div>

      {/* Play Overlay Glass */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: playButtonSize,
          height: playButtonSize,
          borderRadius: "50%",
          background: "rgba(10,14,22,0.55)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          cursor: "pointer",
          pointerEvents: "auto",
          zIndex: 2,
        }}
      >
        <Play 
          className="text-white fill-white" 
          style={{ 
            width: playIconSize, 
            height: playIconSize,
            marginLeft: shouldRenderMini ? 1.5 : 2
          }} 
        />
      </div>

      {/* Chip Espandi alto-dx */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          setTheaterOpen(true);
        }}
        style={{
          position: "absolute",
          top: shouldRenderMini ? 8 : 12,
          right: shouldRenderMini ? 8 : 12,
          width: shouldRenderMini ? 26 : 32,
          height: shouldRenderMini ? 26 : 32,
          borderRadius: "50%",
          background: "rgba(10,14,22,0.55)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          cursor: "pointer",
          pointerEvents: "auto",
          zIndex: 2,
        }}
      >
        <Maximize2 className="w-4 h-4 text-white" />
      </div>
    </>
  ) : (
    <iframe
      src={videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0` : ""}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        border: "none",
        borderRadius: 20,
        pointerEvents: "auto",
        zIndex: 4,
      }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      title="YouTube Shorts video"
    />
  );

  // Render when flexible image is in 'pill' step
  if (imageStep === "pill") {
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
            text={decodeHTMLEntities(articlePreview?.title || sharedTitle || "YouTube Short")}
            maxLines={3}
            ref={titleRef || registerRef("essential-title")}
            className="text-xl font-bold text-immersive-foreground leading-tight mt-1 mb-2 flex-shrink-0 self-start text-left"
          />
        )}

        {/* User Comment NoParrot */}
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

        {/* Caption Short */}
        {flexiblesStatus["flexible-text"]?.step !== "hidden" && articlePreview?.title && (
          <p
            ref={captionTextRef}
            className={cn(
              "self-start text-sm text-white/80 leading-relaxed mb-3 text-left flex-shrink-0 w-full",
              flexiblesStatus["flexible-text"]?.step === "compact"
                ? "line-clamp-2"
                : "line-clamp-4"
            )}
          >
            <MentionText content={decodeHTMLEntities(articlePreview.title)} />
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

        {/* Pill button */}
        <div
          ref={(node) => {
            registerRef("flexible-image")(node);
            if (mediaRef) {
              if (typeof mediaRef === "function") mediaRef(node);
              else (mediaRef as any).current = node;
            }
          }}
          className="flex-shrink-0 mb-3 self-start"
          style={{ height: "36px" }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (sharedUrl) {
                window.open(sharedUrl, "_blank", "noopener,noreferrer");
              }
            }}
            className="inline-flex h-9 items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/10 px-4 rounded-full text-white text-xs font-bold"
          >
            <span>📎 Vedi Shorts</span>
          </button>
        </div>
      </div>
    );
  }

  // Render when flexible image is in 'hidden' step
  if (imageStep === "hidden") {
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
            text={decodeHTMLEntities(articlePreview?.title || sharedTitle || "YouTube Short")}
            maxLines={3}
            ref={titleRef || registerRef("essential-title")}
            className="text-xl font-bold text-immersive-foreground leading-tight mt-1 mb-2 flex-shrink-0 self-start text-left"
          />
        )}

        {/* User Comment NoParrot */}
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

        {/* Caption Short */}
        {flexiblesStatus["flexible-text"]?.step !== "hidden" && articlePreview?.title && (
          <p
            ref={captionTextRef}
            className={cn(
              "self-start text-sm text-white/80 leading-relaxed mb-3 text-left flex-shrink-0 w-full",
              flexiblesStatus["flexible-text"]?.step === "compact"
                ? "line-clamp-2"
                : "line-clamp-4"
            )}
          >
            <MentionText content={decodeHTMLEntities(articlePreview.title)} />
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
      </div>
    );
  }

  // Render unified JSX tree to preserve DOM identity of MediaFrame and prevent scroll lag
  return (
    <>
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
          text={decodeHTMLEntities(articlePreview?.title || sharedTitle || "YouTube Short")}
          maxLines={3}
          ref={titleRef || registerRef("essential-title")}
          className="text-xl font-bold text-immersive-foreground leading-tight mt-1 mb-2 flex-shrink-0 self-start text-left"
        />
      )}

      {/* Content wrapper: row for mini layout, column for tall layout */}
      <div
        className={cn(
          shouldRenderMini ? "vstage-row w-full flex gap-4" : "w-full flex flex-col gap-3"
        )}
        style={shouldRenderMini ? { minHeight: 192, flexShrink: 0 } : undefined}
      >
        <div className={cn(shouldRenderMini ? "v-col flex-1 min-w-0 flex flex-col" : "w-full flex flex-col")}>
          {/* User Comment */}
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

          {/* Caption / Description */}
          {flexiblesStatus["flexible-text"]?.step !== "hidden" && articlePreview?.title && (
            <p
              ref={captionTextRef}
              className={cn(
                "self-start leading-relaxed mb-3 text-left flex-shrink-0 w-full",
                shouldRenderMini ? "text-xs text-white/60" : "text-sm text-white/80",
                flexiblesStatus["flexible-text"]?.step === "compact"
                  ? "line-clamp-2"
                  : "line-clamp-4"
              )}
            >
              <MentionText content={decodeHTMLEntities(articlePreview.title)} />
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

        {/* MediaWrapper: remains stable in DOM layout to prevent image unmounting and reloading */}
        <div
          ref={(node) => {
            registerRef("flexible-image")(node);
            if (mediaRef) {
              if (typeof mediaRef === "function") mediaRef(node);
              else (mediaRef as any).current = node;
            }
          }}
          className={cn("flex-shrink-0", shouldRenderMini ? "" : "w-full mb-1")}
          style={shouldRenderMini ? { alignSelf: "flex-start" } : { order: -1 }}
        >
          <MediaFrame
            media={mediaForFrame}
            variant={shouldRenderMini ? "mini" : "tall"}
            onTap={shouldRenderMini ? () => onMediaTap?.(0) : () => setIsPlaying(true)}
            onLoad={handleImageLoad}
            onError={handleImageError}
          >
            {mediaOverlay}
          </MediaFrame>
          {!shouldRenderMini && (
            <div ref={slotBottomRef} className="mt-3 flex items-center justify-between">
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10.5px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.5)",
                  fontWeight: 600,
                }}
              >
                YouTube Shorts
              </span>
              {sharedUrl && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(sharedUrl, "_blank", "noopener,noreferrer");
                  }}
                  className="inline-flex items-center gap-1.5 active:opacity-60 transition-opacity"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "10.5px",
                    letterSpacing: "0.08em",
                    fontWeight: 600,
                    color: "#ff6b7f",
                  }}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                    <polygon fill="#ff6b7f" points="9.545,15.568 15.818,12 9.545,8.432" />
                  </svg>
                  APRI SU YOUTUBE
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    {theaterOpen && videoId && createPortal(
      <div className="fixed inset-0 z-[70]" style={{ background: '#070b12' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.8, pointerEvents: 'none', background: 'radial-gradient(120% 60% at 50% 0%, rgba(228,30,82,0.22) 0%, transparent 60%), radial-gradient(120% 60% at 50% 100%, rgba(10,122,255,0.16) 0%, transparent 60%)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <iframe src={`https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`} style={{ width: 'min(100vw, calc(100svh * 0.5625))', height: 'min(100svh, calc(100vw * 1.7778))', border: 0 }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" title="YouTube Shorts theater" />
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'calc(12px + env(safe-area-inset-top)) 16px 20px', background: 'linear-gradient(180deg, rgba(5,8,14,0.7) 0%, transparent 100%)' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>YouTube Shorts</span>
          <button onClick={() => setTheaterOpen(false)} style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', color: '#fff', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X className="w-4 h-4" /></button>
        </div>
      </div>,
      document.body
    )}
    </>
  );
};

export const YouTubeShortEmbed = memo(YouTubeShortEmbedInner, (prevProps, nextProps) => {
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

YouTubeShortEmbed.displayName = "YouTubeShortEmbed";

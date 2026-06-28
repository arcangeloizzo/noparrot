import React, { memo, useState, useEffect, useMemo } from "react";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { CardExternalCTA } from "../CardExternalCTA";
import { cn, decodeHTMLEntities } from "@/lib/utils";
import { MediaFrame } from "@/components/shared/MediaFrame";
import { Play } from "lucide-react";
import { countPostWords, calculateMediaLayout, extractYoutubeVideoId } from "@/lib/mediaUtils";
import type { UnifiedMedia } from "@/types/media";

interface YouTubeShortEmbedProps {
  isNearActive: boolean;
  isActive: boolean;
  normalizedMedias: UnifiedMedia[];
  articlePreview?: {
    title?: string;
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
  // 3-level thumbnail fallback states
  const [imageStatus, setImageStatus] = useState<'maxres' | 'hq' | 'placeholder'>('maxres');
  const [imgSrc, setImgSrc] = useState<string>("");

  useEffect(() => {
    setIsPlaying(false);
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

      {/* Chip durata alto-sx */}
      <div
        style={{
          position: "absolute",
          top: shouldRenderMini ? 8 : 12,
          left: shouldRenderMini ? 8 : 12,
          background: "rgba(0,0,0,0.6)",
          padding: "3px 8px",
          borderRadius: 12,
          color: "white",
          fontSize: shouldRenderMini ? 10 : 11,
          fontWeight: "bold",
          fontFamily: "Inter, sans-serif",
          display: "flex",
          alignItems: "center",
          gap: 4,
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        <span style={{ fontSize: shouldRenderMini ? 8 : 10 }}>▶</span> SHORTS · 0:17
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
          background: "rgba(255, 255, 255, 0.15)",
          backdropFilter: "blur(8px)",
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
          onMediaTap?.(0);
        }}
        style={{
          position: "absolute",
          top: shouldRenderMini ? 8 : 12,
          right: shouldRenderMini ? 8 : 12,
          width: shouldRenderMini ? 26 : 30,
          height: shouldRenderMini ? 26 : 30,
          borderRadius: shouldRenderMini ? 13 : 15,
          background: "rgba(0,0,0,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: shouldRenderMini ? 13 : 14,
          cursor: "pointer",
          pointerEvents: "auto",
          zIndex: 2,
        }}
      >
        ⤢
      </div>
    </>
  ) : (
    <iframe
      src={videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : ""}
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
              fontFamily: "Impact, sans-serif",
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
              className="text-sm font-semibold hover:underline block text-[#FF0000]"
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

        {/* CTA */}
        {!useStackLayout && sharedUrl && (
          <div className="slot-bottom w-full mt-auto px-0" ref={slotBottomRef}>
            <CardExternalCTA
              platform="youtube"
              url={sharedUrl}
              mode="flow"
              ref={registerRef("essential-external-cta")}
            />
          </div>
        )}
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
              fontFamily: "Impact, sans-serif",
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
              className="text-sm font-semibold hover:underline block text-[#FF0000]"
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

        {/* CTA */}
        {!useStackLayout && sharedUrl && (
          <div className="slot-bottom w-full mt-auto px-0" ref={slotBottomRef}>
            <CardExternalCTA
              platform="youtube"
              url={sharedUrl}
              mode="flow"
              ref={registerRef("essential-external-cta")}
            />
          </div>
        )}
      </div>
    );
  }

  // Render when shouldRenderMini (side-by-side)
  if (shouldRenderMini) {
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
              fontFamily: "Impact, sans-serif",
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

        <div 
          className="vstage-row w-full flex gap-4"
          style={{ minHeight: 192, flexShrink: 0 }}
        >
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

            {flexiblesStatus["flexible-text"]?.step !== "hidden" && articlePreview?.title && (
              <p
                ref={captionTextRef}
                className={cn(
                  "self-start text-xs text-white/60 leading-relaxed mb-3 text-left flex-shrink-0 w-full",
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
                  className="text-sm font-semibold hover:underline block text-[#FF0000]"
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
              onLoad={handleImageLoad}
              onError={handleImageError}
            >
              {mediaOverlay}
            </MediaFrame>
          </div>
        </div>

        {/* CTA */}
        {!useStackLayout && sharedUrl && (
          <div className="slot-bottom w-full mt-auto px-0" ref={slotBottomRef}>
            <CardExternalCTA
              platform="youtube"
              url={sharedUrl}
              mode="flow"
              ref={registerRef("essential-external-cta")}
            />
          </div>
        )}
      </div>
    );
  }

  // Render when tall layout (stage)
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
            fontFamily: "Impact, sans-serif",
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
            className="text-sm font-semibold hover:underline block text-[#FF0000]"
          >
            Approfondisci
          </button>
        </div>
      )}

      {/* MediaFrame stage */}
      <div
        ref={(node) => {
          registerRef("flexible-image")(node);
          if (mediaRef) {
            if (typeof mediaRef === "function") mediaRef(node);
            else (mediaRef as any).current = node;
          }
        }}
        className="w-full flex-shrink-0 mb-3"
      >
        <MediaFrame
          media={mediaForFrame}
          variant="tall"
          onTap={() => setIsPlaying(true)}
          onLoad={handleImageLoad}
          onError={handleImageError}
        >
          {mediaOverlay}
        </MediaFrame>
      </div>

      {/* CTA */}
      {!useStackLayout && sharedUrl && (
        <div className="slot-bottom w-full mt-auto px-0" ref={slotBottomRef}>
          <CardExternalCTA
            platform="youtube"
            url={sharedUrl}
            mode="flow"
            ref={registerRef("essential-external-cta")}
          />
        </div>
      )}
    </div>
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

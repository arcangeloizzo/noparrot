import React, { memo, useMemo } from "react";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { CardExternalCTA } from "../CardExternalCTA";
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
          text={decodeHTMLEntities(articlePreview?.title || sharedTitle || "Instagram Reel")}
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
                "self-start leading-relaxed mb-3 text-left flex-shrink-0 w-full",
                shouldRenderMini ? "text-xs text-white/60" : "text-sm text-white/80",
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
                className="text-sm font-semibold hover:underline block text-[#E1306C]"
              >
                Approfondisci
              </button>
            </div>
          )}

          {/* CTA inside left column (only for mini layout) */}
          {shouldRenderMini && !useStackLayout && sharedUrl && (
            <div className="slot-bottom w-full mt-auto px-0" ref={slotBottomRef}>
              <CardExternalCTA
                platform="instagram"
                url={sharedUrl}
                mode="flow"
                ref={registerRef("essential-external-cta")}
              />
            </div>
          )}
        </div>

        {/* MediaWrapper: remains stable in DOM layout to prevent image unmounting and reloading */}
        {hasValidMedia && mediaForFrame && (
          <div
            ref={(node) => {
              registerRef("flexible-image")(node);
              if (mediaRef) {
                if (typeof mediaRef === "function") mediaRef(node);
                else (mediaRef as any).current = node;
              }
            }}
            className={cn("flex-shrink-0", shouldRenderMini ? "" : "w-full mb-3")}
            style={shouldRenderMini ? { alignSelf: "flex-start" } : undefined}
          >
            <MediaFrame
              media={mediaForFrame}
              variant={shouldRenderMini ? "mini" : "tall"}
              onTap={() => onMediaTap?.(0)}
            />
          </div>
        )}
      </div>

      {/* CTA below the content wrapper (only for tall layout) */}
      {!shouldRenderMini && !useStackLayout && sharedUrl && (
        <div className="slot-bottom w-full mt-auto px-0" ref={slotBottomRef}>
          <CardExternalCTA
            platform="instagram"
            url={sharedUrl}
            mode="flow"
            ref={registerRef("essential-external-cta")}
          />
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

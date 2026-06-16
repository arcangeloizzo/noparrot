import React, { memo } from "react";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { CardExternalCTA } from "../CardExternalCTA";
import { cn, decodeHTMLEntities } from "@/lib/utils";

interface YouTubeShortEmbedProps {
  isNearActive: boolean;
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
  
  // Refs
  bodyRef?: React.RefObject<any> | ((node: any) => void);
  captionTextRef?: React.RefObject<any> | React.MutableRefObject<any> | ((node: any) => void);
  slotBottomRef?: React.RefObject<any> | ((node: any) => void);
}

const YouTubeShortEmbedInner = ({
  isNearActive,
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
  bodyRef,
  captionTextRef,
  slotBottomRef,
}: YouTubeShortEmbedProps) => {
  return (
    <>
      <div
        className={cn(
          "flex-1 min-h-0 flex flex-col items-center justify-start w-full px-4 gap-3",
          emergencyScroll && "overflow-y-auto"
        )}
      >
        {/* post.title (titolo NoParrot dato dall'utente) */}
        {postTitle && postTitle.trim().length > 0 ? (
          <ClampedTitle
            as="h2"
            text={postTitle}
            maxLines={3}
            ref={registerRef("essential-title")}
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
            ref={registerRef("essential-title")}
            className="text-xl font-bold text-immersive-foreground leading-tight mt-1 mb-2 flex-shrink-0 self-start text-left"
          />
        )}

        {/* User Comment NoParrot — flessibile */}
        {postContent && postContent.trim().length > 0 && (
          <p
            ref={bodyRef}
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

        {/* Caption Short — articlePreview.title — flessibile */}
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

        {/* Approfondisci se body o caption clampati */}
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

      {/* Unified Card External CTA inside slot-bottom */}
      {!useStackLayout && sharedUrl && (
        <div className="slot-bottom w-full px-4" ref={slotBottomRef}>
          <CardExternalCTA
            platform="youtube"
            url={sharedUrl}
            mode="flow"
            ref={registerRef("essential-external-cta")}
          />
        </div>
      )}
    </>
  );
};

export const YouTubeShortEmbed = memo(YouTubeShortEmbedInner, (prevProps, nextProps) => {
  return (
    prevProps.isNearActive === nextProps.isNearActive &&
    prevProps.postTitle === nextProps.postTitle &&
    prevProps.postContent === nextProps.postContent &&
    prevProps.sharedUrl === nextProps.sharedUrl &&
    prevProps.sharedTitle === nextProps.sharedTitle &&
    prevProps.useStackLayout === nextProps.useStackLayout &&
    prevProps.emergencyScroll === nextProps.emergencyScroll &&
    prevProps.bodyLineClamp === nextProps.bodyLineClamp &&
    prevProps.shouldShowApprofondisci === nextProps.shouldShowApprofondisci &&
    JSON.stringify(prevProps.articlePreview) === JSON.stringify(nextProps.articlePreview) &&
    JSON.stringify(prevProps.flexiblesStatus) === JSON.stringify(nextProps.flexiblesStatus)
  );
});

YouTubeShortEmbed.displayName = "YouTubeShortEmbed";

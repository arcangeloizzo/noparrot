import React, { memo } from "react";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { CardExternalCTA } from "../CardExternalCTA";
import { cn, decodeHTMLEntities } from "@/lib/utils";

interface InstagramReelEmbedProps {
  postTitle?: string;
  postContent?: string;
  sharedUrl?: string;
  sharedTitle?: string;
  articlePreview?: {
    title?: string;
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
}: InstagramReelEmbedProps) => {
  return (
    <>
      <div
        className={cn(
          "flex-1 min-h-0 flex flex-col items-center justify-start w-full px-4 gap-3",
          emergencyScroll && "overflow-y-auto"
        )}
      >
        {/* Title */}
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
            text={decodeHTMLEntities(
              articlePreview?.title || sharedTitle || "Instagram Reel"
            )}
            maxLines={3}
            ref={registerRef("essential-title")}
            className="text-xl font-bold text-immersive-foreground leading-tight mt-1 mb-2 flex-shrink-0 self-start text-left"
          />
        )}

        {/* User Comment — flessibile */}
        {postContent && postContent.trim().length > 0 && (
          <p
            ref={(el) => {
              if (bodyRef) {
                if (typeof bodyRef === "function") {
                  bodyRef(el);
                } else {
                  (bodyRef as any).current = el;
                }
              }
              if (bodyTextRef) {
                if (typeof bodyTextRef === "function") {
                  bodyTextRef(el);
                } else {
                  (bodyTextRef as any).current = el;
                }
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

        {/* Caption — flessibile */}
        {flexiblesStatus["flexible-text"]?.step !== "hidden" && sharedTitle && (
          <p
            ref={(el) => {
              registerRef("flexible-text")(el);
              if (captionTextRef) {
                if (typeof captionTextRef === "function") {
                  captionTextRef(el);
                } else {
                  (captionTextRef as any).current = el;
                }
              }
            }}
            className={cn(
              "self-start text-sm text-white/80 leading-relaxed mb-3 text-left flex-shrink-0 w-full",
              flexiblesStatus["flexible-text"]?.step === "compact"
                ? "line-clamp-2"
                : "line-clamp-4"
            )}
          >
            <MentionText content={sharedTitle} />
          </p>
        )}

        {/* Approfondisci */}
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
      </div>

      {/* Unified Card External CTA inside slot-bottom */}
      {!useStackLayout && sharedUrl && (
        <div 
          className="slot-bottom w-full px-4" 
          style={{ marginTop: emergencyScroll ? 0 : undefined }}
          ref={slotBottomRef}
        >
          <CardExternalCTA
            platform="instagram"
            url={sharedUrl}
            mode="flow"
            ref={registerRef("essential-external-cta")}
          />
        </div>
      )}
    </>
  );
};

export const InstagramReelEmbed = memo(InstagramReelEmbedInner, (prevProps, nextProps) => {
  return (
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
    prevProps.flexiblesStatus?.["flexible-reshare-link-body"]?.step ===
      nextProps.flexiblesStatus?.["flexible-reshare-link-body"]?.step &&
    prevProps.flexiblesStatus?.["flexible-reshare-link-body"]?.height ===
      nextProps.flexiblesStatus?.["flexible-reshare-link-body"]?.height
  );
});

InstagramReelEmbed.displayName = "InstagramReelEmbed";

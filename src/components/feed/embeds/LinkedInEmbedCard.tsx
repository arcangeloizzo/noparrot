import React, { memo } from "react";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { CardExternalCTA } from "../CardExternalCTA";
import { LinkedInCard } from "../post-bodies/LinkedInCard";
import { cn } from "@/lib/utils";

interface LinkedInEmbedCardProps {
  articlePreview: any;
  isNearActive: boolean;
  
  // Parent state / props
  postTitle?: string;
  postContent?: string;
  sharedUrl?: string;
  sharedTitle?: string;
  previewImg?: string;
  useStackLayout: boolean;
  emergencyScroll: boolean;
  bodyLineClamp: number;
  shouldShowApprofondisci: boolean;
  linkedinEmbedStep: "full" | "compact" | "pill";
  flexiblesStatus: any;
  
  // Callbacks
  onOpenFullText: (mode: "description" | "transcript") => void;
  registerRef: (id: string) => (node: HTMLElement | null) => void;
  
  // Refs
  titleRef?: React.RefObject<any> | ((node: any) => void);
  bodyRef?: React.RefObject<any> | ((node: any) => void);
  bodyTextRef?: React.RefObject<any> | React.MutableRefObject<any> | ((node: any) => void);
  slotBottomRef?: React.RefObject<any> | ((node: any) => void);
}

const LinkedInEmbedCardInner = ({
  articlePreview,
  isNearActive,
  postTitle,
  postContent,
  sharedUrl,
  sharedTitle,
  previewImg,
  useStackLayout,
  emergencyScroll,
  bodyLineClamp,
  shouldShowApprofondisci,
  linkedinEmbedStep,
  flexiblesStatus,
  onOpenFullText,
  registerRef,
  titleRef,
  bodyRef,
  bodyTextRef,
  slotBottomRef,
}: LinkedInEmbedCardProps) => {
  const syntheticPost = {
    shared_url: sharedUrl,
    shared_title: sharedTitle,
    preview_img: previewImg,
  };

  return (
    <div
      className={cn(
        "flex-1 min-h-0 w-full flex flex-col justify-start",
        emergencyScroll && "overflow-y-auto"
      )}
    >
      {/* post.title (titolo NoParrot dato dall'utente) */}
      {!useStackLayout && postTitle && postTitle.trim().length > 0 && (
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

      {/* Commento utente flessibile (3 stati) */}
      {!useStackLayout && postContent && postContent.trim().length > 0 && (
        <div
          ref={bodyRef}
          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6] text-left flex-shrink-0"
          style={{
            fontFamily: "Inter, sans-serif",
            lineHeight: 1.55,
            display: "-webkit-box",
            WebkitLineClamp: bodyLineClamp,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          <MentionText content={postContent} />
        </div>
      )}

      {/* Approfondisci */}
      {!useStackLayout && shouldShowApprofondisci && (
        <div className="flex-shrink-0 mt-2 mb-3 text-left">
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

      <div className="slot-bottom" ref={slotBottomRef}>
        {/* LinkedIn embed (essenziale a stati) */}
        {(!useStackLayout || linkedinEmbedStep === "full") && (
          <div
            ref={
              useStackLayout
                ? registerRef("flexible-reshare-link-body")
                : registerRef("essential-linkedin-embed")
            }
            style={
              useStackLayout &&
              flexiblesStatus["flexible-reshare-link-body"]
                ? {
                    height: `${flexiblesStatus["flexible-reshare-link-body"].height}px`,
                    overflow: "hidden",
                  }
                : undefined
            }
            className="w-full mt-auto flex-shrink-0"
          >
            <LinkedInCard
              post={syntheticPost as any}
              articlePreview={articlePreview}
              useStackLayout={useStackLayout}
              embedStep={useStackLayout ? "full" : linkedinEmbedStep || "full"}
            />
          </div>
        )}

        {useStackLayout &&
          (linkedinEmbedStep === "pill" || linkedinEmbedStep === "compact") && (
            <div
              ref={
                useStackLayout
                  ? registerRef("flexible-reshare-link-body")
                  : registerRef("essential-linkedin-embed")
              }
              className="flex-shrink-0 mt-auto"
              style={{ height: "36px" }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (sharedUrl) {
                    window.open(sharedUrl, "_blank", "noopener,noreferrer");
                  }
                }}
                className="inline-flex h-9 items-center gap-1.5 bg-[#0A66C2] hover:bg-[#0A66C2]/90 border border-white/10 px-4 rounded-full text-white"
              >
                <span className="text-xs font-bold">📎 Apri LinkedIn</span>
              </button>
            </div>
          )}

        {useStackLayout && linkedinEmbedStep === "hidden" && (
          <div
            ref={registerRef("flexible-reshare-link-body")}
            style={{ height: 0, overflow: "hidden" }}
          />
        )}

        {!useStackLayout && sharedUrl && (
          <CardExternalCTA
            platform="linkedin"
            url={sharedUrl}
            mode="flow"
            ref={registerRef("essential-external-cta")}
          />
        )}
      </div>
    </div>
  );
};

export const LinkedInEmbedCard = memo(LinkedInEmbedCardInner, (prevProps, nextProps) => {
  return (
    prevProps.isNearActive === nextProps.isNearActive &&
    prevProps.postTitle === nextProps.postTitle &&
    prevProps.postContent === nextProps.postContent &&
    prevProps.sharedUrl === nextProps.sharedUrl &&
    prevProps.sharedTitle === nextProps.sharedTitle &&
    prevProps.previewImg === nextProps.previewImg &&
    prevProps.useStackLayout === nextProps.useStackLayout &&
    prevProps.emergencyScroll === nextProps.emergencyScroll &&
    prevProps.bodyLineClamp === nextProps.bodyLineClamp &&
    prevProps.shouldShowApprofondisci === nextProps.shouldShowApprofondisci &&
    prevProps.linkedinEmbedStep === nextProps.linkedinEmbedStep &&
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

LinkedInEmbedCard.displayName = "LinkedInEmbedCard";

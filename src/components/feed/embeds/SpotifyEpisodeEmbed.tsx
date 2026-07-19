import React, { memo } from "react";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { SpotifyPodcastCompactCard } from "../SpotifyPodcastCompactCard";
import { cn, decodeHTMLEntities } from "@/lib/utils";

interface SpotifyEpisodeEmbedProps {
  postTitle?: string;
  postContent?: string;
  sharedUrl?: string;
  sharedTitle?: string;
  articlePreview?: {
    image?: string;
    description?: string;
    title?: string;
    platform?: string;
  } | null;
  useStackLayout: boolean;
  emergencyScroll: boolean;
  bodyLineClamp: number;
  shouldShowApprofondisci: boolean;
  spotifyEpisodeStep: "full" | "pill" | "hidden";
  hasUserMedia: boolean;
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

const getHostnameFromUrl = (url: string | undefined): string => {
  if (!url) return "Fonte";
  try {
    const urlWithProtocol = url.startsWith("http") ? url : `https://${url}`;
    return new URL(urlWithProtocol).hostname;
  } catch {
    return "Fonte";
  }
};

const SpotifyEpisodeEmbedInner = ({
  postTitle,
  postContent,
  sharedUrl,
  sharedTitle,
  articlePreview,
  useStackLayout,
  emergencyScroll,
  bodyLineClamp,
  shouldShowApprofondisci,
  spotifyEpisodeStep,
  hasUserMedia,
  flexiblesStatus,
  onOpenFullText,
  registerRef,
  titleRef,
  bodyRef,
  bodyTextRef,
  slotBottomRef,
}: SpotifyEpisodeEmbedProps) => {
  return (
    <div
      className={cn(
        "flex-1 min-h-0 flex flex-col justify-start w-full",
        emergencyScroll && "overflow-y-auto"
      )}
    >
      {/* Title */}
      {!useStackLayout && postTitle && postTitle.trim().length > 0 && (
        <ClampedTitle
          as="h2"
          text={postTitle}
          maxLines={6}
          ref={titleRef}
          className="uppercase mb-2 flex-shrink-0"
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

      {/* Body text */}
      {!useStackLayout && postContent && postContent.trim().length > 0 && (
        <div
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

      {/* Approfondisci */}
      {!useStackLayout && shouldShowApprofondisci && (
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

      <div className="slot-bottom" ref={slotBottomRef}>
        {/* Spotify embed */}
        {spotifyEpisodeStep === "full" &&
          (hasUserMedia ? (
            <div
              ref={
                useStackLayout
                  ? registerRef("flexible-reshare-link-body")
                  : registerRef("essential-spotify")
              }
              style={
                useStackLayout && flexiblesStatus["flexible-reshare-link-body"]
                  ? {
                      height: `${flexiblesStatus["flexible-reshare-link-body"].height}px`,
                      overflow: "hidden",
                    }
                  : undefined
              }
              className="flex-shrink-0 mt-auto text-left"
            >
              <a
                href={sharedUrl || ""}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-9 items-center gap-1.5 bg-[#1DB954] px-4 rounded-full text-white"
              >
                <span className="text-white text-xs font-bold">🎙️ Apri il podcast</span>
              </a>
            </div>
          ) : (
            <div
              ref={
                useStackLayout
                  ? registerRef("flexible-reshare-link-body")
                  : registerRef("essential-spotify")
              }
              style={
                useStackLayout && flexiblesStatus["flexible-reshare-link-body"]
                  ? {
                      height: `${flexiblesStatus["flexible-reshare-link-body"].height}px`,
                      overflow: "hidden",
                    }
                  : undefined
              }
              className="flex-shrink-0 mt-auto w-full"
            >
              <SpotifyPodcastCompactCard
                imageUrl={articlePreview?.image || ""}
                podcastName={articlePreview?.description || getHostnameFromUrl(sharedUrl)}
                episodeTitle={decodeHTMLEntities(
                  articlePreview?.title || sharedTitle || ""
                )}
                spotifyUrl={sharedUrl || ""}
              />
            </div>
          ))}

        {spotifyEpisodeStep === "pill" && (
          <div
            ref={
              useStackLayout
                ? registerRef("flexible-reshare-link-body")
                : registerRef("essential-spotify")
            }
            className="flex-shrink-0 mt-auto text-left"
            style={{ height: "36px" }}
          >
            <a
              href={sharedUrl || ""}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-9 items-center gap-1.5 bg-[#1DB954] px-4 rounded-full"
            >
              <span className="text-white text-xs font-bold">🎙️ Apri il podcast</span>
            </a>
          </div>
        )}

        {useStackLayout && spotifyEpisodeStep === "hidden" && (
          <div
            ref={registerRef("flexible-reshare-link-body")}
            style={{ height: 0, overflow: "hidden" }}
          />
        )}
      </div>
    </div>
  );
};

export const SpotifyEpisodeEmbed = memo(SpotifyEpisodeEmbedInner, (prevProps, nextProps) => {
  return (
    prevProps.postTitle === nextProps.postTitle &&
    prevProps.postContent === nextProps.postContent &&
    prevProps.sharedUrl === nextProps.sharedUrl &&
    prevProps.sharedTitle === nextProps.sharedTitle &&
    prevProps.useStackLayout === nextProps.useStackLayout &&
    prevProps.emergencyScroll === nextProps.emergencyScroll &&
    prevProps.bodyLineClamp === nextProps.bodyLineClamp &&
    prevProps.shouldShowApprofondisci === nextProps.shouldShowApprofondisci &&
    prevProps.spotifyEpisodeStep === nextProps.spotifyEpisodeStep &&
    prevProps.hasUserMedia === nextProps.hasUserMedia &&
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

SpotifyEpisodeEmbed.displayName = "SpotifyEpisodeEmbed";

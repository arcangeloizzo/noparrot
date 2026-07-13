import React, { memo } from "react";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { SpotifyPodcastCompactCard } from "../SpotifyPodcastCompactCard";
import { cn, decodeHTMLEntities } from "@/lib/utils";

interface SpotifyTrackEmbedProps {
  title?: string;
  artist?: string;
  imageUrl?: string;
  trackUrl?: string;
  dominantColors?: string[];
  isNearActive: boolean;
  
  // Parent state / props
  postTitle?: string;
  postContent?: string;
  useStackLayout: boolean;
  emergencyScroll: boolean;
  bodyLineClamp: number;
  shouldShowApprofondisci: boolean;
  spotifyTrackStep: "full" | "pill" | "hidden";
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

const SpotifyTrackEmbedInner = ({
  title,
  artist,
  imageUrl,
  trackUrl,
  dominantColors,
  isNearActive,
  postTitle,
  postContent,
  useStackLayout,
  emergencyScroll,
  bodyLineClamp,
  shouldShowApprofondisci,
  spotifyTrackStep,
  hasUserMedia,
  flexiblesStatus,
  onOpenFullText,
  registerRef,
  titleRef,
  bodyRef,
  bodyTextRef,
  slotBottomRef,
}: SpotifyTrackEmbedProps) => {
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
          maxLines={3}
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
          ref={bodyRef}
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
            className="text-sm text-primary font-semibold hover:underline block"
          >
            Approfondisci
          </button>
        </div>
      )}

      <div className="slot-bottom" ref={slotBottomRef}>
        {/* Spotify track embed */}
        {spotifyTrackStep === "full" &&
          (hasUserMedia ? (
            <div
              ref={
                useStackLayout
                  ? registerRef("flexible-reshare-link-body")
                  : registerRef("essential-spotify-song")
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
              className="flex-shrink-0 mt-auto text-left w-full"
            >
              <a
                href={trackUrl || ""}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-9 items-center gap-1.5 bg-[#1DB954] px-4 rounded-full text-white"
              >
                <span className="text-white text-xs font-bold">
                  🎵 Ascolta su Spotify
                </span>
              </a>
            </div>
          ) : (
            <div
              ref={
                useStackLayout
                  ? registerRef("flexible-reshare-link-body")
                  : registerRef("essential-spotify-song")
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
              className="flex-shrink-0 mt-auto w-full"
            >
              <SpotifyPodcastCompactCard
                imageUrl={imageUrl || ""}
                podcastName={artist || "Spotify"}
                episodeTitle={decodeHTMLEntities(title || "")}
                spotifyUrl={trackUrl || ""}
              />
            </div>
          ))}

        {spotifyTrackStep === "pill" && (
          <div
            ref={
              useStackLayout
                ? registerRef("flexible-reshare-link-body")
                : registerRef("essential-spotify-song")
            }
            className="flex-shrink-0 mt-auto"
            style={{ height: "36px" }}
          >
            <a
              href={trackUrl || ""}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-9 items-center gap-1.5 bg-[#1DB954] px-4 rounded-full"
            >
              <span className="text-white text-xs font-bold">
                🎵 Ascolta su Spotify
              </span>
            </a>
          </div>
        )}

        {useStackLayout && spotifyTrackStep === "hidden" && (
          <div
            ref={registerRef("flexible-reshare-link-body")}
            style={{ height: 0, overflow: "hidden" }}
          />
        )}
      </div>
    </div>
  );
};

// Implement memoization with custom comparison function for optimization
export const SpotifyTrackEmbed = memo(SpotifyTrackEmbedInner, (prevProps, nextProps) => {
  return (
    prevProps.title === nextProps.title &&
    prevProps.artist === nextProps.artist &&
    prevProps.imageUrl === nextProps.imageUrl &&
    prevProps.trackUrl === nextProps.trackUrl &&
    prevProps.isNearActive === nextProps.isNearActive &&
    prevProps.postTitle === nextProps.postTitle &&
    prevProps.postContent === nextProps.postContent &&
    prevProps.useStackLayout === nextProps.useStackLayout &&
    prevProps.emergencyScroll === nextProps.emergencyScroll &&
    prevProps.bodyLineClamp === nextProps.bodyLineClamp &&
    prevProps.shouldShowApprofondisci === nextProps.shouldShowApprofondisci &&
    prevProps.spotifyTrackStep === nextProps.spotifyTrackStep &&
    prevProps.hasUserMedia === nextProps.hasUserMedia &&
    (prevProps.dominantColors === nextProps.dominantColors ||
      (prevProps.dominantColors?.length === nextProps.dominantColors?.length &&
        (prevProps.dominantColors || []).every(
          (val, idx) => val === nextProps.dominantColors[idx]
        ))) &&
    prevProps.flexiblesStatus?.["flexible-reshare-link-body"]?.step ===
      nextProps.flexiblesStatus?.["flexible-reshare-link-body"]?.step &&
    prevProps.flexiblesStatus?.["flexible-reshare-link-body"]?.height ===
      nextProps.flexiblesStatus?.["flexible-reshare-link-body"]?.height
  );
});

SpotifyTrackEmbed.displayName = "SpotifyTrackEmbed";

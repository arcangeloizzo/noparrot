import React, { memo, useState, useEffect } from "react";
import { Play } from "lucide-react";
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
  const spotifyId = trackUrl?.match(/(?:track|episode|show)\/([A-Za-z0-9]+)/)?.[1];
  const [playerActive, setPlayerActive] = useState(false);
  useEffect(() => { setPlayerActive(false); }, [trackUrl]);

  const decodedTitle = decodeHTMLEntities(title || "");
  let capsuleTitle = decodedTitle;
  let capsuleSub = artist || "";
  if (!capsuleSub && decodedTitle.includes(" - ")) {
    const idx = decodedTitle.indexOf(" - ");
    capsuleTitle = decodedTitle.slice(0, idx);
    capsuleSub = decodedTitle.slice(idx + 3);
  }

  const renderCapsuleOrEmbed = () => (
    playerActive && spotifyId ? (
      <div style={{ borderRadius: '14px', overflow: 'hidden' }}>
        <iframe
          src={`https://open.spotify.com/embed/track/${spotifyId}?theme=0`}
          style={{ width: '100%', height: '152px', border: 0, display: 'block' }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          title="Spotify player"
        />
      </div>
    ) : (
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (spotifyId) setPlayerActive(true);
          else if (trackUrl) window.open(trackUrl, '_blank', 'noopener,noreferrer');
        }}
        className="active:scale-[0.985] transition-transform cursor-pointer"
        style={{ position: 'relative', borderRadius: '18px', padding: '13px', display: 'flex', gap: '13px', alignItems: 'center', background: 'rgba(29,185,84,0.06)', border: '1px solid rgba(29,185,84,0.18)', overflow: 'hidden' }}
      >
        <div style={{ position: 'relative', width: '92px', height: '92px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, boxShadow: '0 8px 20px -8px rgba(0,0,0,0.6)' }}>
          <img src={imageUrl || ''} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,10,16,0.25)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(10,14,22,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'JetBrains Mono', monospace", fontSize: '9.5px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
            <i style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1DB954', display: 'block' }} />
            Spotify · Brano
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.25, marginBottom: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'rgba(236,241,247,0.96)' }}>{capsuleTitle}</div>
          {capsuleSub && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{capsuleSub}</div>
          )}
        </div>
        <div className="np-eq" style={{ marginLeft: 'auto', flexShrink: 0, alignSelf: 'flex-end', marginBottom: '2px' }}>
          <i /><i /><i /><i />
        </div>
      </div>
    )
  );

  const metaRow = (
    <div className="mt-3 flex items-center justify-between">
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>SPOTIFY</span>
      <button
        onClick={(e) => { e.stopPropagation(); if (trackUrl) window.open(trackUrl, '_blank', 'noopener,noreferrer'); }}
        className="inline-flex items-center gap-1.5 active:opacity-60 transition-opacity"
        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', letterSpacing: '0.08em', color: '#1DB954', fontWeight: 700 }}
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="#1DB954" aria-hidden="true">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.38-1.32 9.78-.66 13.5 1.62.36.18.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z"/>
        </svg>
        ASCOLTA SU SPOTIFY
      </button>
    </div>
  );

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

      {/* Capsula/Embed + META — sopra il body per il ramo full */}
      {!useStackLayout && spotifyTrackStep === "full" && !hasUserMedia && (
        <div
          ref={registerRef("essential-spotify-song")}
          className="flex-shrink-0 mb-3 w-full"
        >
          {renderCapsuleOrEmbed()}
          {metaRow}
        </div>
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
            className="text-sm text-primary font-semibold active:opacity-60 transition-opacity block"
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
          ) : useStackLayout ? (
            <div
              ref={registerRef("flexible-reshare-link-body")}
              style={
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
          ) : null)}

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

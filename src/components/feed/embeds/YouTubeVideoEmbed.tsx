import React, { memo, useState, useRef, useEffect } from "react";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { CardExternalCTA } from "../CardExternalCTA";
import { cn, decodeHTMLEntities } from "@/lib/utils";
import { Play, ExternalLink } from "lucide-react";
import { extractYoutubeVideoId } from "@/lib/mediaUtils";

interface YouTubeVideoEmbedProps {
  postId: string;
  postTitle?: string;
  postContent?: string;
  sharedUrl?: string;
  sharedTitle?: string;
  postPreviewImg?: string;
  articlePreview?: {
    title?: string;
    image?: string;
  } | null;
  useStackLayout: boolean;
  emergencyScroll: boolean;
  bodyLineClamp: number;
  shouldShowApprofondisci: boolean;
  youtubeEmbedStep: "full" | "compact" | "pill" | "hidden";
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



const YouTubeVideoEmbedInner = ({
  postId,
  postTitle,
  postContent,
  sharedUrl,
  sharedTitle,
  postPreviewImg,
  articlePreview,
  useStackLayout,
  emergencyScroll,
  bodyLineClamp,
  shouldShowApprofondisci,
  youtubeEmbedStep,
  hasUserMedia,
  flexiblesStatus,
  onOpenFullText,
  registerRef,
  titleRef,
  bodyRef,
  bodyTextRef,
  slotBottomRef,
}: YouTubeVideoEmbedProps) => {
  // Localized YouTube embed states
  const [youtubeEmbedActive, setYoutubeEmbedActive] = useState(false);
  const prevPostIdRef = useRef(postId);

  useEffect(() => {
    if (prevPostIdRef.current !== postId) {
      setYoutubeEmbedActive(false);
      prevPostIdRef.current = postId;
    }
  }, [postId]);

  return (
    <div
      className={cn(
        "flex-1 min-h-0 flex flex-col justify-start w-full",
        emergencyScroll && "overflow-y-auto"
      )}
    >
      {/* Title */}
      {postTitle && postTitle.trim().length > 0 ? (
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
      ) : (
        <ClampedTitle
          as="h2"
          text={decodeHTMLEntities(articlePreview?.title || sharedTitle)}
          maxLines={3}
          ref={titleRef}
          className="text-xl font-bold text-immersive-foreground leading-tight mt-1 mb-2 flex-shrink-0"
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
            className="text-sm text-primary font-semibold hover:underline block"
          >
            Approfondisci
          </button>
        </div>
      )}

      <div className="slot-bottom" ref={slotBottomRef}>
        {/* YouTube embed */}
        {youtubeEmbedStep === "full" && (
          <div
            ref={
              useStackLayout
                ? registerRef("flexible-reshare-link-body")
                : registerRef("essential-youtube")
            }
            style={
              useStackLayout && flexiblesStatus["flexible-reshare-link-body"]
                ? {
                    height: `${flexiblesStatus["flexible-reshare-link-body"].height}px`,
                    overflow: "hidden",
                  }
                : undefined
            }
            className="w-full mt-auto flex-shrink-0"
          >
            {!hasUserMedia && (
              <>
                {!youtubeEmbedActive ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setYoutubeEmbedActive(true);
                    }}
                    className="relative w-full rounded-2xl overflow-hidden border border-white/10 active:scale-[0.98] transition-transform"
                  >
                    <img
                      src={
                        articlePreview?.image ||
                        postPreviewImg ||
                        (sharedUrl
                          ? `https://img.youtube.com/vi/${extractYoutubeVideoId(
                              sharedUrl
                            )}/maxresdefault.jpg`
                          : "")
                      }
                      alt=""
                      width={1280}
                      height={720}
                      loading="lazy"
                      decoding="async"
                      className="w-full aspect-video object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="bg-red-600 p-4 rounded-full">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-3 bg-black/90 px-3 py-1.5 rounded-full flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-red-600"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                        <polygon fill="white" points="9.545,15.568 15.818,12 9.545,8.432" />
                      </svg>
                      <span className="text-white text-xs font-medium">YouTube</span>
                    </div>
                  </button>
                ) : (
                  <div className="w-full rounded-2xl overflow-hidden border border-white/10">
                    <div className="aspect-video">
                      <iframe
                        src={
                          sharedUrl
                            ? `https://www.youtube.com/embed/${extractYoutubeVideoId(
                                sharedUrl
                              )}?autoplay=1&mute=1&cc_load_policy=1&rel=0`
                            : ""
                        }
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                        title="YouTube video"
                      />
                    </div>
                  </div>
                )}

                {postTitle && postTitle.trim().length > 0 && (
                  <h1 className="text-xs font-semibold text-immersive-foreground line-clamp-1 mt-2 mb-1 text-left">
                    {decodeHTMLEntities(articlePreview?.title || sharedTitle)}
                  </h1>
                )}
              </>
            )}

            {useStackLayout && sharedUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(sharedUrl, "_blank", "noopener,noreferrer");
                }}
                className="inline-flex items-center gap-2 text-immersive-muted hover:text-immersive-foreground transition-colors mt-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="text-xs uppercase tracking-wider">Apri su YouTube</span>
              </button>
            )}
          </div>
        )}

        {youtubeEmbedStep === "compact" &&
          (hasUserMedia ? (
            useStackLayout && sharedUrl ? (
              <div
                ref={
                  useStackLayout
                    ? registerRef("flexible-reshare-link-body")
                    : registerRef("essential-youtube")
                }
                style={
                  useStackLayout && flexiblesStatus["flexible-reshare-link-body"]
                    ? {
                        height: `${flexiblesStatus["flexible-reshare-link-body"].height}px`,
                        overflow: "hidden",
                      }
                    : undefined
                }
                className="mt-auto flex-shrink-0 text-left"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(sharedUrl, "_blank", "noopener,noreferrer");
                  }}
                  className="inline-flex items-center gap-2 text-immersive-muted hover:text-immersive-foreground transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="text-xs uppercase tracking-wider">Apri su YouTube</span>
                </button>
              </div>
            ) : null
          ) : (
            <div
              ref={
                useStackLayout
                  ? registerRef("flexible-reshare-link-body")
                  : registerRef("essential-youtube")
              }
              style={
                useStackLayout && flexiblesStatus["flexible-reshare-link-body"]
                  ? {
                      height: `${flexiblesStatus["flexible-reshare-link-body"].height}px`,
                      overflow: "hidden",
                    }
                  : undefined
              }
              className={cn(
                "flex items-center gap-3 p-2 bg-card/40 rounded-lg mt-auto flex-shrink-0 border border-white/10 w-full",
                useStackLayout && "cursor-pointer active:scale-[0.98] transition-transform"
              )}
              onClick={
                useStackLayout && sharedUrl
                  ? (e) => {
                      e.stopPropagation();
                      window.open(sharedUrl, "_blank", "noopener,noreferrer");
                    }
                  : undefined
              }
            >
              {/* Thumbnail 80×45 (16:9) */}
              <div className="relative flex-shrink-0 w-20 h-[45px] rounded overflow-hidden bg-muted">
                <img
                  src={
                    articlePreview?.image ||
                    postPreviewImg ||
                    (sharedUrl
                      ? `https://img.youtube.com/vi/${extractYoutubeVideoId(
                          sharedUrl
                        )}/hqdefault.jpg`
                      : "")
                  }
                  width={1280}
                  height={720}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  alt=""
                />
                {/* Play icon centrato, piccolo */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Play className="w-5 h-5 text-white fill-white" />
                </div>
              </div>
              {/* Titolo + dominio a destra */}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate text-foreground">
                  {decodeHTMLEntities(articlePreview?.title || sharedTitle)}
                </p>
                <p className="text-xs text-muted-foreground font-sans">YouTube</p>
              </div>
            </div>
          ))}

        {useStackLayout && youtubeEmbedStep === "pill" && sharedUrl && (
          <div
            ref={
              useStackLayout
                ? registerRef("flexible-reshare-link-body")
                : registerRef("essential-youtube")
            }
            className="flex-shrink-0 mt-auto text-left"
            style={{ height: "36px" }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(sharedUrl, "_blank", "noopener,noreferrer");
              }}
              className="inline-flex items-center gap-2 text-immersive-muted hover:text-immersive-foreground transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="text-xs uppercase tracking-wider">Apri su YouTube</span>
            </button>
          </div>
        )}

        {useStackLayout && youtubeEmbedStep === "hidden" && (
          <div
            ref={registerRef("flexible-reshare-link-body")}
            style={{ height: 0, overflow: "hidden" }}
          />
        )}

        {!useStackLayout && sharedUrl && (
          <CardExternalCTA
            platform="youtube"
            url={sharedUrl}
            mode="flow"
            ref={registerRef("essential-external-cta")}
          />
        )}
      </div>
    </div>
  );
};

export const YouTubeVideoEmbed = memo(YouTubeVideoEmbedInner, (prevProps, nextProps) => {
  return (
    prevProps.postId === nextProps.postId &&
    prevProps.postTitle === nextProps.postTitle &&
    prevProps.postContent === nextProps.postContent &&
    prevProps.sharedUrl === nextProps.sharedUrl &&
    prevProps.sharedTitle === nextProps.sharedTitle &&
    prevProps.postPreviewImg === nextProps.postPreviewImg &&
    prevProps.useStackLayout === nextProps.useStackLayout &&
    prevProps.emergencyScroll === nextProps.emergencyScroll &&
    prevProps.bodyLineClamp === nextProps.bodyLineClamp &&
    prevProps.shouldShowApprofondisci === nextProps.shouldShowApprofondisci &&
    prevProps.youtubeEmbedStep === nextProps.youtubeEmbedStep &&
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

YouTubeVideoEmbed.displayName = "YouTubeVideoEmbed";

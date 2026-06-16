import React, { memo } from "react";
import { ExternalLink } from "lucide-react";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { CardExternalCTA } from "../CardExternalCTA";
import { cn, decodeHTMLEntities } from "@/lib/utils";

interface TwitterTweetEmbedProps {
  title?: string;
  isNearActive: boolean;
  
  // Article/Preview fields
  articlePreview?: {
    title?: string;
    content?: string;
    summary?: string;
    image?: string;
    author_name?: string;
    author_username?: string;
    author_avatar?: string;
    is_verified?: boolean;
  } | null;
  
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
  tweetEmbedStep: string;
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

const TwitterTweetEmbedInner = ({
  title,
  isNearActive,
  articlePreview,
  postTitle,
  postContent,
  sharedUrl,
  sharedTitle,
  previewImg,
  useStackLayout,
  emergencyScroll,
  bodyLineClamp,
  shouldShowApprofondisci,
  tweetEmbedStep,
  flexiblesStatus,
  onOpenFullText,
  registerRef,
  titleRef,
  bodyRef,
  bodyTextRef,
  slotBottomRef,
}: TwitterTweetEmbedProps) => {
  return (
    <>
      <div
        className={cn(
          "flex-1 min-h-0 w-full flex flex-col justify-start",
          emergencyScroll && "overflow-y-auto"
        )}
      >
        {/* post.title (titolo NoParrot) */}
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

        {/* Tweet Embed (essenziale a stati) - Renders inside scroll area */}
        {(!useStackLayout || tweetEmbedStep === "full") && (
          <div className="w-full flex-shrink-0 mb-3">
            {/* State: pill (only in non-stack mode when selected) */}
            {!useStackLayout && tweetEmbedStep === "pill" && (
              <button
                ref={registerRef("essential-tweet-embed")}
                onClick={(e) => {
                  e.stopPropagation();
                  if (sharedUrl) window.open(sharedUrl, "_blank", "noopener,noreferrer");
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-black/40 border border-white/20 hover:bg-black/60 transition-colors text-left flex-shrink-0"
                style={{ height: 50 }}
              >
                <div className="w-8 h-8 rounded-full bg-black flex-shrink-0 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">𝕏</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/60 uppercase tracking-wider">Tweet</p>
                  <p className="text-sm text-white truncate">
                    {decodeHTMLEntities(
                      articlePreview?.title || sharedTitle || "Visualizza su 𝕏"
                    )}
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-white/60 flex-shrink-0" />
              </button>
            )}

            {/* State: compact */}
            {!useStackLayout && tweetEmbedStep === "compact" && (
              <div
                ref={registerRef("essential-tweet-embed")}
                className="w-full p-4 rounded-2xl bg-black/40 border border-white/10 hover:border-white/20 transition-colors text-left flex-shrink-0"
                style={{ height: 130 }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center">
                      <span className="text-white text-xs font-bold">𝕏</span>
                    </div>
                    <span className="text-xs font-bold text-white/80">Twitter / 𝕏</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-white/40" />
                </div>
                <p className="text-sm text-white line-clamp-2 mb-2">
                  {decodeHTMLEntities(articlePreview?.title || sharedTitle || "")}
                </p>
                <a
                  href={sharedUrl || ""}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-blue-400 font-semibold hover:underline"
                >
                  Mostra tweet
                </a>
              </div>
            )}

            {/* State: full */}
            {tweetEmbedStep === "full" && (
              <div
                ref={
                  useStackLayout
                    ? registerRef("flexible-reshare-link-body")
                    : registerRef("essential-tweet-embed")
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
                className={cn(
                  "bg-gradient-to-br from-[#1DA1F2]/5 to-white/90 dark:from-[#15202B] dark:to-[#0d1117] rounded-3xl p-5 border border-black/5 dark:border-white/15 flex flex-col max-h-full flex-shrink-0",
                  useStackLayout && "cursor-pointer active:scale-[0.98] transition-transform"
                )}
                onClick={
                  useStackLayout
                    ? (e) => {
                        e.stopPropagation();
                        if (sharedUrl) {
                          window.open(sharedUrl, "_blank", "noopener,noreferrer");
                        }
                      }
                    : undefined
                }
              >
                {/* Author Row - Fixed height */}
                <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                  <div className="w-12 h-12 rounded-full border border-white/20 overflow-hidden bg-[#1DA1F2]/10 flex-shrink-0 flex items-center justify-center">
                    {articlePreview?.author_avatar ? (
                      <img
                        src={articlePreview.author_avatar}
                        alt=""
                        width={64}
                        height={64}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/50 text-xl font-bold">
                        {(
                          articlePreview?.author_name ||
                          articlePreview?.author_username ||
                          "X"
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1.5">
                      <p className="text-slate-900 dark:text-white font-semibold truncate text-sm">
                        {articlePreview?.author_name ||
                          articlePreview?.title?.replace("Post by ", "").replace("@", "") ||
                          "X User"}
                      </p>
                      {articlePreview?.is_verified && (
                        <div className="flex-shrink-0 w-[18px] h-[18px] rounded-full bg-[#1DA1F2] flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {articlePreview?.author_username && (
                      <p className="text-slate-500 dark:text-white/50 text-xs">
                        @{articlePreview.author_username}
                      </p>
                    )}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-white flex items-center justify-center flex-shrink-0">
                    <span className="text-black font-bold text-xs">𝕏</span>
                  </div>
                </div>

                {/* Tweet Text - clamped */}
                <div className="flex-shrink-0 min-h-0 overflow-hidden mb-2 text-left">
                  <p className="text-slate-900 dark:text-white text-sm leading-relaxed line-clamp-4">
                    {(articlePreview?.content || articlePreview?.summary || postContent || "")
                      .replace(/https?:\/\/t\.co\/\w+/g, "")
                      .replace(/https?:\/\/[^\s]+/g, "")
                      .replace(/\s{2,}/g, " ")
                      .trim()}
                  </p>
                </div>

                {/* Immagine media se presente, strip orizzontale (solo in modalità non-stack) */}
                {!useStackLayout && (articlePreview?.image || previewImg) && (
                  <div className="rounded-lg overflow-hidden flex-shrink min-h-0 mt-2">
                    <img
                      src={articlePreview?.image || previewImg}
                      alt=""
                      width={1200}
                      height={630}
                      loading="lazy"
                      decoding="async"
                      className="w-full"
                      style={{
                        height: 100,
                        objectFit: "cover",
                        objectPosition: "center",
                      }}
                    />
                  </div>
                )}

                {/* Open on X link button (Reshare Stack only) */}
                {useStackLayout && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (sharedUrl) {
                        window.open(sharedUrl, "_blank", "noopener,noreferrer");
                      }
                    }}
                    className="inline-flex items-center gap-2 text-immersive-muted hover:text-immersive-foreground transition-colors mt-2 self-start"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="text-xs uppercase tracking-wider">Apri su X</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unified Card External CTA inside slot-bottom */}
      <div className="slot-bottom w-full px-4" ref={slotBottomRef}>
        {!useStackLayout && sharedUrl && (
          <CardExternalCTA
            platform="twitter"
            url={sharedUrl}
            mode="flow"
            ref={registerRef("essential-external-cta")}
          />
        )}
        {useStackLayout && tweetEmbedStep === "pill" && (
          <div
            ref={registerRef("flexible-reshare-link-body")}
            className="flex-shrink-0 flex justify-center"
            style={{ height: "36px" }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (sharedUrl) {
                  window.open(sharedUrl, "_blank", "noopener,noreferrer");
                }
              }}
              className="inline-flex h-9 items-center gap-1.5 bg-[#000000] hover:bg-[#000000]/90 border border-white/10 px-4 rounded-full text-white"
            >
              <span className="text-xs font-bold">𝕏 Apri tweet</span>
            </button>
          </div>
        )}
        {useStackLayout && tweetEmbedStep === "hidden" && (
          <div
            ref={registerRef("flexible-reshare-link-body")}
            style={{ height: 0, overflow: "hidden" }}
          />
        )}
      </div>
    </>
  );
};

export const TwitterTweetEmbed = memo(TwitterTweetEmbedInner, (prevProps, nextProps) => {
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
    prevProps.tweetEmbedStep === nextProps.tweetEmbedStep &&
    JSON.stringify(prevProps.articlePreview) === JSON.stringify(nextProps.articlePreview) &&
    JSON.stringify(prevProps.flexiblesStatus) === JSON.stringify(nextProps.flexiblesStatus)
  );
});

TwitterTweetEmbed.displayName = "TwitterTweetEmbed";

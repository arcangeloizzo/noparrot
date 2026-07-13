import React, { memo, useMemo } from "react";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { QuotedEditorialCard } from "../QuotedEditorialCard";
import { SourceImageWithFallback } from "../SourceImageWithFallback";
import { MediaFrame } from "@/components/shared/MediaFrame";
import { ExternalLink } from "lucide-react";
import { cn, decodeHTMLEntities } from "@/lib/utils";
import { countPostWords, calculateMediaLayout, getCardImageUrl } from "@/lib/mediaUtils";

interface GenericArticleEmbedProps {
  postId: string;
  postTitle?: string;
  postContent?: string;
  sharedUrl?: string;
  sharedTitle?: string;
  articleContent?: string;
  previewImg?: string;
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
  articleStep: "full" | "compact" | "pill" | "hidden";
  isEditorialFocus: boolean;
  editorialSummary?: string | null;
  displayTrustScore?: any;
  hasUserMedia: boolean;
  flexiblesStatus: any;
  normalizedMedias: any[];

  // Callbacks
  onOpenFullText: (mode: "description" | "transcript") => void;
  registerRef: (id: string) => (node: HTMLElement | null) => void;
  navigate: (path: string) => void;

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

const GenericArticleEmbedInner = ({
  postId,
  postTitle,
  postContent,
  sharedUrl,
  sharedTitle,
  articleContent,
  previewImg,
  articlePreview,
  useStackLayout,
  emergencyScroll,
  bodyLineClamp,
  shouldShowApprofondisci,
  articleStep,
  isEditorialFocus,
  editorialSummary,
  displayTrustScore,
  hasUserMedia,
  flexiblesStatus,
  normalizedMedias,
  onOpenFullText,
  registerRef,
  navigate,
  titleRef,
  bodyRef,
  bodyTextRef,
  slotBottomRef,
}: GenericArticleEmbedProps) => {
  const wordCount = useMemo(() => {
    return countPostWords(postTitle || "", postContent || "");
  }, [postTitle, postContent]);

  // Check for article mini layout configuration
  const linkPreviewMedia = useMemo(() => {
    return normalizedMedias.find((m) => m.source === "link_preview");
  }, [normalizedMedias]);

  const hasPreviewMetadataTopLevel = false && !!linkPreviewMedia;
  const isArticleMiniActive =
    !hasUserMedia &&
    hasPreviewMetadataTopLevel &&
    !!linkPreviewMedia &&
    calculateMediaLayout(linkPreviewMedia, wordCount) === "mini";

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
      {!useStackLayout && !isArticleMiniActive && postContent && postContent.trim().length > 0 && (
        <div
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
      {!useStackLayout && !isArticleMiniActive && shouldShowApprofondisci && (
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
        {/* Embed content */}
        {articleStep === "full" && (
          <div
            ref={
              useStackLayout
                ? registerRef("flexible-reshare-link-body")
                : registerRef("essential-article")
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
            {isEditorialFocus ? (
              <QuotedEditorialCard
                title={decodeHTMLEntities(sharedTitle || "Il Punto")}
                summary={(() => {
                  const raw = articleContent || "";
                  const cleaned = raw.replace(/\[SOURCE:[\d,\s]+\]/g, "").trim();
                  if (cleaned.length > 20) return cleaned.substring(0, 260).trim() + "…";
                  if (editorialSummary) return editorialSummary.substring(0, 260).trim() + "…";
                  return undefined;
                })()}
                onClick={() => {
                  const focusId = sharedUrl?.replace("focus://daily/", "");
                  if (focusId) navigate(`/?focus=${focusId}`);
                }}
                trustScore={{ band: "ALTO", score: 90 }}
              />
            ) : (
              (() => {
                // KILL SWITCH 16/06: branch MediaFrame articoli generici ha edge case multipli su iPhone SE.
                const hasPreviewMetadata = false && !!linkPreviewMedia;
                const layoutMode =
                  hasPreviewMetadata && linkPreviewMedia
                    ? calculateMediaLayout(linkPreviewMedia, wordCount)
                    : null;
                const hasImage = !!linkPreviewMedia;
                const mediaForFrame = linkPreviewMedia || null;

                return (
                  <div
                    className="cursor-pointer active:scale-[0.98] transition-transform w-full flex flex-col items-start"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (sharedUrl) {
                        window.open(sharedUrl, "_blank", "noopener,noreferrer");
                      }
                    }}
                  >
                    {hasImage && !hasUserMedia && (
                      hasPreviewMetadata && mediaForFrame ? (
                        layoutMode === "mini" ? (
                          <div className="vstage-row w-full mb-3">
                            <div className="v-col">
                              {postContent && postContent.trim().length > 0 && (
                                <div
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
                              {shouldShowApprofondisci && (
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
                            </div>
                            <div
                              className="flex-shrink-0 animate-fade-in"
                              style={{ alignSelf: "flex-start" }}
                            >
                              <MediaFrame
                                media={mediaForFrame}
                                variant="mini"
                                onTap={() => {
                                  if (sharedUrl) {
                                    window.open(sharedUrl, "_blank", "noopener,noreferrer");
                                  }
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="w-full mb-3 animate-fade-in">
                            <MediaFrame
                              media={mediaForFrame}
                              variant={layoutMode}
                              onTap={() => {
                                if (sharedUrl) {
                                  window.open(sharedUrl, "_blank", "noopener,noreferrer");
                                }
                              }}
                            />
                          </div>
                        )
                      ) : (
                        <div className="w-full h-[140px] flex items-center justify-center mb-3 overflow-hidden rounded-xl">
                          <SourceImageWithFallback
                            src={getCardImageUrl(articlePreview?.image || previewImg, 600, 75)}
                            sharedUrl={sharedUrl}
                            isIntent={false}
                            trustScore={displayTrustScore}
                            hideOverlay={true}
                            platform={articlePreview?.platform}
                            hostname={getHostnameFromUrl(sharedUrl)}
                            className="h-full w-full object-cover rounded-xl"
                          />
                        </div>
                      )
                    )}

                    <div className="w-12 h-1 bg-slate-200 dark:bg-white/30 rounded-full mb-3 shrink-0" />

                    <div className="mb-2 shrink-0 text-left w-full">
                      <p className="text-base font-semibold text-slate-900 dark:text-white/90 leading-snug line-clamp-2">
                        {decodeHTMLEntities(
                          articlePreview?.title || sharedTitle || getHostnameFromUrl(sharedUrl)
                        )}
                      </p>
                    </div>

                    <div className="flex items-center text-slate-500 dark:text-white/70 mb-1 gap-2 shrink-0">
                      <ExternalLink className="w-3 h-3" />
                      <span className="uppercase font-bold tracking-widest text-[10px]">
                        {getHostnameFromUrl(sharedUrl)}
                      </span>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {articleStep === "compact" && (
          <div
            ref={
              useStackLayout
                ? registerRef("flexible-reshare-link-body")
                : registerRef("essential-article")
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
            <div
              className="flex flex-row items-center gap-2 bg-[rgba(255,255,255,0.06)] rounded-[8px] p-[8px_10px] w-full cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (isEditorialFocus) {
                  const focusId = sharedUrl?.replace("focus://daily/", "");
                  if (focusId) navigate(`/?focus=${focusId}`);
                } else if (sharedUrl) {
                  window.open(sharedUrl, "_blank", "noopener,noreferrer");
                }
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <span className="text-sm">📰</span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold truncate text-foreground">
                  {decodeHTMLEntities(
                    articlePreview?.title || sharedTitle || getHostnameFromUrl(sharedUrl)
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider font-mono">
                  {getHostnameFromUrl(sharedUrl)}
                </p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-white/40 shrink-0" />
            </div>
          </div>
        )}

        {articleStep === "pill" && (
          <div
            ref={
              useStackLayout
                ? registerRef("flexible-reshare-link-body")
                : registerRef("essential-article")
            }
            className="flex-shrink-0 mt-auto text-left"
            style={{ height: "36px" }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isEditorialFocus) {
                  const focusId = sharedUrl?.replace("focus://daily/", "");
                  if (focusId) navigate(`/?focus=${focusId}`);
                } else if (sharedUrl) {
                  window.open(sharedUrl, "_blank", "noopener,noreferrer");
                }
              }}
              className="inline-flex h-9 items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/10 px-4 rounded-full"
            >
              <span className="text-white text-xs font-bold">📰 Leggi articolo</span>
            </button>
          </div>
        )}

        {useStackLayout && articleStep === "hidden" && (
          <div
            ref={registerRef("flexible-reshare-link-body")}
            style={{ height: 0, overflow: "hidden" }}
          />
        )}
      </div>
    </div>
  );
};

export const GenericArticleEmbed = memo(GenericArticleEmbedInner, (prevProps, nextProps) => {
  return (
    prevProps.postId === nextProps.postId &&
    prevProps.postTitle === nextProps.postTitle &&
    prevProps.postContent === nextProps.postContent &&
    prevProps.sharedUrl === nextProps.sharedUrl &&
    prevProps.sharedTitle === nextProps.sharedTitle &&
    prevProps.articleContent === nextProps.articleContent &&
    prevProps.previewImg === nextProps.previewImg &&
    prevProps.useStackLayout === nextProps.useStackLayout &&
    prevProps.emergencyScroll === nextProps.emergencyScroll &&
    prevProps.bodyLineClamp === nextProps.bodyLineClamp &&
    prevProps.shouldShowApprofondisci === nextProps.shouldShowApprofondisci &&
    prevProps.articleStep === nextProps.articleStep &&
    prevProps.isEditorialFocus === nextProps.isEditorialFocus &&
    prevProps.editorialSummary === nextProps.editorialSummary &&
    prevProps.hasUserMedia === nextProps.hasUserMedia &&
    prevProps.articlePreview?.title === nextProps.articlePreview?.title &&
    prevProps.articlePreview?.description === nextProps.articlePreview?.description &&
    prevProps.articlePreview?.image === nextProps.articlePreview?.image &&
    prevProps.articlePreview?.platform === nextProps.articlePreview?.platform &&
    prevProps.displayTrustScore?.band === nextProps.displayTrustScore?.band &&
    prevProps.displayTrustScore?.score === nextProps.displayTrustScore?.score &&
    prevProps.flexiblesStatus?.["flexible-reshare-link-body"]?.height ===
      nextProps.flexiblesStatus?.["flexible-reshare-link-body"]?.height &&
    (prevProps.normalizedMedias === nextProps.normalizedMedias ||
      (prevProps.normalizedMedias?.length === nextProps.normalizedMedias?.length &&
        (prevProps.normalizedMedias || []).every(
          (val, idx) =>
            val.src === nextProps.normalizedMedias[idx].src &&
            val.ratio === nextProps.normalizedMedias[idx].ratio &&
            val.orientation === nextProps.normalizedMedias[idx].orientation &&
            val.kind === nextProps.normalizedMedias[idx].kind
        )))
  );
});

GenericArticleEmbed.displayName = "GenericArticleEmbed";

import React, { memo, useMemo } from "react";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { MentionText } from "../MentionText";
import { QuotedEditorialCard } from "../QuotedEditorialCard";
import { ExternalLink } from "lucide-react";
import { cn, decodeHTMLEntities } from "@/lib/utils";
import { countPostWords, getCardImageUrl } from "@/lib/mediaUtils";

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

  // Article mini layout was gated behind a KILL SWITCH (dead branch), keep flag as false.
  const isArticleMiniActive = false;

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

      {/* SOURCE embed — moved above body (Title → FONTE → Body → Approfondisci) */}
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
            className="w-full flex-shrink-0 mb-1"
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
                const heroImg = articlePreview?.image || previewImg;
                const hostname = getHostnameFromUrl(sharedUrl).replace("www.", "");
                const open = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (sharedUrl) window.open(sharedUrl, "_blank", "noopener,noreferrer");
                };

                return heroImg && !hasUserMedia ? (
                  <div
                    className="relative cursor-pointer overflow-hidden active:opacity-95 transition-opacity"
                    style={{ marginLeft: "-18px", marginRight: "-18px", background: "#0a0f18" }}
                    onClick={open}
                  >
                    <img
                      src={getCardImageUrl(heroImg, 1000, 75)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(0deg, rgba(6,10,17,0.88) 0%, rgba(6,10,17,0.25) 45%, transparent 70%)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "12px",
                        right: "12px",
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "rgba(10,14,22,0.55)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 16px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "10px",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          fontWeight: 600,
                          color: "#fff",
                          background: "rgba(10,14,22,0.6)",
                          backdropFilter: "blur(8px)",
                          WebkitBackdropFilter: "blur(8px)",
                          padding: "5px 10px",
                          borderRadius: "999px",
                          marginBottom: "9px",
                        }}
                      >
                        <i
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: "#10B981",
                            display: "block",
                          }}
                        />
                        {hostname}
                      </span>
                      <div
                        style={{
                          fontSize: "16.5px",
                          fontWeight: 700,
                          lineHeight: 1.3,
                          color: "#fff",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {decodeHTMLEntities(articlePreview?.title || sharedTitle || hostname)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="cursor-pointer active:opacity-90 transition-opacity"
                    style={{
                      borderRadius: "16px",
                      padding: "13px 15px",
                      display: "flex",
                      gap: "11px",
                      alignItems: "stretch",
                      background: "rgba(16,185,129,0.07)",
                      border: "1px solid rgba(16,185,129,0.2)",
                    }}
                    onClick={open}
                  >
                    <div style={{ width: "4px", borderRadius: "2px", background: "#10B981", flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "10px",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.5)",
                          fontWeight: 600,
                          marginBottom: "5px",
                        }}
                      >
                        {hostname}
                      </div>
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          lineHeight: 1.3,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          color: "rgba(236,241,247,0.96)",
                        }}
                      >
                        {decodeHTMLEntities(articlePreview?.title || sharedTitle || hostname)}
                      </div>
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
            className="w-full flex-shrink-0 mb-1"
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
            className="flex-shrink-0 text-left mb-3"
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
            className="text-sm text-primary font-semibold active:opacity-60 transition-opacity block"
          >
            Approfondisci
          </button>
        </div>
      )}

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

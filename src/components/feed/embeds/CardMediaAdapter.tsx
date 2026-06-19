import React, { memo } from "react";
import { UserUploadEmbed } from "./UserUploadEmbed";
import { TwitterTweetEmbed } from "./TwitterTweetEmbed";
import { LinkedInEmbedCard } from "./LinkedInEmbedCard";
import { YouTubeShortEmbed } from "./YouTubeShortEmbed";
import { YouTubeVideoEmbed } from "./YouTubeVideoEmbed";
import { SpotifyEpisodeEmbed } from "./SpotifyEpisodeEmbed";
import { SpotifyTrackEmbed } from "./SpotifyTrackEmbed";
import { GenericArticleEmbed } from "./GenericArticleEmbed";
import { InstagramReelEmbed } from "./InstagramReelEmbed";

interface CardMediaAdapterProps {
  // Routing flags
  isStandardPost: boolean;
  isTwitter: boolean;
  isLinkedIn: boolean;
  isYoutubeShort: boolean;
  isYoutube: boolean;
  isSpotifyEpisode: boolean;
  isSpotifyTrack: boolean;
  isGenericArticle: boolean;
  isInstagramReel: boolean;

  // Post & Data Props
  post: {
    id: string;
    title?: string;
    content?: string;
    media?: any[];
    shared_url?: string;
    shared_title?: string;
    article_content?: string;
    preview_img?: string;
  };
  articlePreview?: {
    title?: string;
    description?: string;
    image?: string;
    platform?: string;
  } | null;
  isNearActive: boolean;
  isActive: boolean;
  useStackLayout: boolean;
  emergencyScroll: boolean;
  bodyLineClamp: number;
  shouldShowApprofondisci: boolean;
  flexiblesStatus: any;
  hasUserMedia: boolean;
  displayTrustScore?: any;
  normalizedMedias: any[];
  isEditorialFocus: boolean;
  editorialSummary?: string | null;

  // Step variables
  tweetEmbedStep?: "full" | "compact" | "pill" | "hidden";
  linkedinEmbedStep?: "full" | "compact" | "pill" | "hidden";
  youtubeEmbedStep?: "full" | "compact" | "pill" | "hidden";
  spotifyEpisodeStep?: "full" | "compact" | "pill" | "hidden";
  spotifyTrackStep?: "full" | "compact" | "pill" | "hidden";
  articleStep?: "full" | "compact" | "pill" | "hidden";

  // Callbacks
  onOpenFullText: (mode: "description" | "transcript") => void;
  registerRef: (id: string) => (node: HTMLElement | null) => void;
  onMediaTap?: (index: number) => void;
  navigate: (path: string) => void;

  // Refs from parent
  titleRef?: React.RefObject<any> | ((node: any) => void);
  bodyRef?: React.RefObject<any> | ((node: any) => void);
  bodyTextRef?: React.RefObject<any> | ((node: any) => void);
  mediaRef?: React.RefObject<any> | ((node: any) => void);
  captionTextRef?: React.RefObject<any> | ((node: any) => void);
  slotBottomRef?: React.RefObject<any> | ((node: any) => void);
}

const CardMediaAdapterInner = ({
  isStandardPost,
  isTwitter,
  isLinkedIn,
  isYoutubeShort,
  isYoutube,
  isSpotifyEpisode,
  isSpotifyTrack,
  isGenericArticle,
  isInstagramReel,
  post,
  articlePreview,
  isNearActive,
  isActive,
  useStackLayout,
  emergencyScroll,
  bodyLineClamp,
  shouldShowApprofondisci,
  flexiblesStatus,
  hasUserMedia,
  displayTrustScore,
  normalizedMedias,
  isEditorialFocus,
  editorialSummary,
  tweetEmbedStep,
  linkedinEmbedStep,
  youtubeEmbedStep,
  spotifyEpisodeStep,
  spotifyTrackStep,
  articleStep,
  onOpenFullText,
  registerRef,
  onMediaTap,
  navigate,
  titleRef,
  bodyRef,
  bodyTextRef,
  mediaRef,
  captionTextRef,
  slotBottomRef,
}: CardMediaAdapterProps) => {
  // Helper to handle standard titleRef pattern: registerRef('essential-title') + parent titleRef update
  const handleTitleRefWithParent = (node: any) => {
    registerRef("essential-title")(node);
    if (titleRef) {
      if (typeof titleRef === "function") {
        titleRef(node);
      } else {
        (titleRef as any).current = node;
      }
    }
  };

  if (isStandardPost) {
    return (
      <UserUploadEmbed
        postTitle={post.title}
        postContent={post.content}
        postMedia={post.media}
        isNearActive={isNearActive}
        isActive={isActive}
        useStackLayout={useStackLayout}
        emergencyScroll={emergencyScroll}
        bodyLineClamp={bodyLineClamp}
        shouldShowApprofondisci={shouldShowApprofondisci}
        flexiblesStatus={flexiblesStatus}
        onOpenFullText={onOpenFullText}
        registerRef={registerRef}
        onMediaTap={onMediaTap}
        titleRef={handleTitleRefWithParent}
        bodyRef={bodyRef}
        bodyTextRef={bodyTextRef}
        mediaRef={mediaRef}
      />
    );
  }

  if (isTwitter) {
    return (
      <TwitterTweetEmbed
        articlePreview={articlePreview}
        isNearActive={isNearActive}
        postTitle={post.title}
        postContent={post.content}
        sharedUrl={post.shared_url}
        sharedTitle={post.shared_title}
        previewImg={post.preview_img}
        useStackLayout={useStackLayout}
        emergencyScroll={emergencyScroll}
        bodyLineClamp={bodyLineClamp}
        shouldShowApprofondisci={shouldShowApprofondisci}
        tweetEmbedStep={tweetEmbedStep || "full"}
        flexiblesStatus={flexiblesStatus}
        onOpenFullText={onOpenFullText}
        registerRef={registerRef}
        titleRef={titleRef}
        bodyRef={bodyRef}
        bodyTextRef={bodyTextRef}
        slotBottomRef={slotBottomRef}
      />
    );
  }

  if (isLinkedIn) {
    return (
      <LinkedInEmbedCard
        articlePreview={articlePreview}
        isNearActive={isNearActive}
        postTitle={post.title}
        postContent={post.content}
        sharedUrl={post.shared_url}
        sharedTitle={post.shared_title}
        previewImg={post.preview_img}
        useStackLayout={useStackLayout}
        emergencyScroll={emergencyScroll}
        bodyLineClamp={bodyLineClamp}
        shouldShowApprofondisci={shouldShowApprofondisci}
        linkedinEmbedStep={linkedinEmbedStep || "full"}
        flexiblesStatus={flexiblesStatus}
        onOpenFullText={onOpenFullText}
        registerRef={registerRef}
        titleRef={titleRef}
        bodyRef={bodyRef}
        bodyTextRef={bodyTextRef}
        slotBottomRef={slotBottomRef}
      />
    );
  }

  if (isYoutubeShort) {
    return (
      <YouTubeShortEmbed
        isNearActive={isNearActive}
        articlePreview={articlePreview}
        postTitle={post.title}
        postContent={post.content}
        sharedUrl={post.shared_url}
        sharedTitle={post.shared_title}
        useStackLayout={useStackLayout}
        emergencyScroll={emergencyScroll}
        bodyLineClamp={bodyLineClamp}
        shouldShowApprofondisci={shouldShowApprofondisci}
        flexiblesStatus={flexiblesStatus}
        onOpenFullText={onOpenFullText}
        registerRef={registerRef}
        bodyRef={bodyRef}
        captionTextRef={captionTextRef}
        slotBottomRef={slotBottomRef}
      />
    );
  }

  if (isYoutube) {
    return (
      <YouTubeVideoEmbed
        postId={post.id}
        postTitle={post.title}
        postContent={post.content}
        sharedUrl={post.shared_url}
        sharedTitle={post.shared_title}
        postPreviewImg={post.preview_img}
        articlePreview={articlePreview}
        useStackLayout={useStackLayout}
        emergencyScroll={emergencyScroll}
        bodyLineClamp={bodyLineClamp}
        shouldShowApprofondisci={shouldShowApprofondisci}
        youtubeEmbedStep={youtubeEmbedStep}
        hasUserMedia={hasUserMedia}
        flexiblesStatus={flexiblesStatus}
        onOpenFullText={onOpenFullText}
        registerRef={registerRef}
        titleRef={registerRef("essential-title")}
        bodyRef={bodyRef}
        bodyTextRef={bodyTextRef}
        slotBottomRef={slotBottomRef}
      />
    );
  }

  if (isSpotifyEpisode) {
    return (
      <SpotifyEpisodeEmbed
        postTitle={post.title}
        postContent={post.content}
        sharedUrl={post.shared_url}
        sharedTitle={post.shared_title}
        articlePreview={articlePreview}
        useStackLayout={useStackLayout}
        emergencyScroll={emergencyScroll}
        bodyLineClamp={bodyLineClamp}
        shouldShowApprofondisci={shouldShowApprofondisci}
        spotifyEpisodeStep={spotifyEpisodeStep}
        hasUserMedia={hasUserMedia}
        flexiblesStatus={flexiblesStatus}
        onOpenFullText={onOpenFullText}
        registerRef={registerRef}
        titleRef={handleTitleRefWithParent}
        bodyRef={bodyRef}
        bodyTextRef={bodyTextRef}
        slotBottomRef={slotBottomRef}
      />
    );
  }

  if (isSpotifyTrack) {
    return (
      <SpotifyTrackEmbed
        title={articlePreview?.title || post.shared_title || undefined}
        artist={articlePreview?.description || undefined}
        imageUrl={articlePreview?.image || post.preview_img || undefined}
        trackUrl={post.shared_url || undefined}
        isNearActive={isNearActive}
        postTitle={post.title}
        postContent={post.content}
        useStackLayout={useStackLayout}
        emergencyScroll={emergencyScroll}
        bodyLineClamp={bodyLineClamp}
        shouldShowApprofondisci={shouldShowApprofondisci}
        spotifyTrackStep={spotifyTrackStep as any}
        hasUserMedia={hasUserMedia}
        flexiblesStatus={flexiblesStatus}
        onOpenFullText={onOpenFullText}
        registerRef={registerRef}
        titleRef={titleRef}
        bodyRef={bodyRef}
        bodyTextRef={bodyTextRef}
        slotBottomRef={slotBottomRef}
      />
    );
  }

  if (isGenericArticle) {
    return (
      <GenericArticleEmbed
        postId={post.id}
        postTitle={post.title}
        postContent={post.content}
        sharedUrl={post.shared_url}
        sharedTitle={post.shared_title}
        articleContent={post.article_content}
        previewImg={post.preview_img}
        articlePreview={articlePreview}
        useStackLayout={useStackLayout}
        emergencyScroll={emergencyScroll}
        bodyLineClamp={bodyLineClamp}
        shouldShowApprofondisci={shouldShowApprofondisci}
        articleStep={articleStep || "full"}
        isEditorialFocus={isEditorialFocus}
        editorialSummary={editorialSummary}
        displayTrustScore={displayTrustScore}
        hasUserMedia={hasUserMedia}
        flexiblesStatus={flexiblesStatus}
        normalizedMedias={normalizedMedias}
        onOpenFullText={onOpenFullText}
        registerRef={registerRef}
        navigate={navigate}
        titleRef={handleTitleRefWithParent}
        bodyRef={bodyRef}
        bodyTextRef={bodyTextRef}
        slotBottomRef={slotBottomRef}
      />
    );
  }

  if (isInstagramReel) {
    return (
      <InstagramReelEmbed
        postTitle={post.title}
        postContent={post.content}
        sharedUrl={post.shared_url}
        sharedTitle={post.shared_title}
        articlePreview={articlePreview}
        useStackLayout={useStackLayout}
        emergencyScroll={emergencyScroll}
        bodyLineClamp={bodyLineClamp}
        shouldShowApprofondisci={shouldShowApprofondisci}
        flexiblesStatus={flexiblesStatus}
        onOpenFullText={onOpenFullText}
        registerRef={registerRef}
        bodyRef={bodyRef}
        bodyTextRef={bodyTextRef}
        captionTextRef={captionTextRef}
        slotBottomRef={slotBottomRef}
      />
    );
  }

  return null;
};

export const CardMediaAdapter = memo(CardMediaAdapterInner, (prevProps, nextProps) => {
  return (
    prevProps.isStandardPost === nextProps.isStandardPost &&
    prevProps.isTwitter === nextProps.isTwitter &&
    prevProps.isLinkedIn === nextProps.isLinkedIn &&
    prevProps.isYoutubeShort === nextProps.isYoutubeShort &&
    prevProps.isYoutube === nextProps.isYoutube &&
    prevProps.isSpotifyEpisode === nextProps.isSpotifyEpisode &&
    prevProps.isSpotifyTrack === nextProps.isSpotifyTrack &&
    prevProps.isGenericArticle === nextProps.isGenericArticle &&
    prevProps.isInstagramReel === nextProps.isInstagramReel &&
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.title === nextProps.post.title &&
    prevProps.post.content === nextProps.post.content &&
    prevProps.post.shared_url === nextProps.post.shared_url &&
    prevProps.post.shared_title === nextProps.post.shared_title &&
    prevProps.post.article_content === nextProps.post.article_content &&
    prevProps.post.preview_img === nextProps.post.preview_img &&
    prevProps.isNearActive === nextProps.isNearActive &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.useStackLayout === nextProps.useStackLayout &&
    prevProps.emergencyScroll === nextProps.emergencyScroll &&
    prevProps.bodyLineClamp === nextProps.bodyLineClamp &&
    prevProps.shouldShowApprofondisci === nextProps.shouldShowApprofondisci &&
    prevProps.hasUserMedia === nextProps.hasUserMedia &&
    prevProps.isEditorialFocus === nextProps.isEditorialFocus &&
    prevProps.editorialSummary === nextProps.editorialSummary &&
    prevProps.tweetEmbedStep === nextProps.tweetEmbedStep &&
    prevProps.linkedinEmbedStep === nextProps.linkedinEmbedStep &&
    prevProps.youtubeEmbedStep === nextProps.youtubeEmbedStep &&
    prevProps.spotifyEpisodeStep === nextProps.spotifyEpisodeStep &&
    prevProps.spotifyTrackStep === nextProps.spotifyTrackStep &&
    prevProps.articleStep === nextProps.articleStep &&
    JSON.stringify(prevProps.articlePreview) === JSON.stringify(nextProps.articlePreview) &&
    JSON.stringify(prevProps.flexiblesStatus) === JSON.stringify(nextProps.flexiblesStatus) &&
    JSON.stringify(prevProps.displayTrustScore) === JSON.stringify(nextProps.displayTrustScore) &&
    JSON.stringify(prevProps.normalizedMedias) === JSON.stringify(nextProps.normalizedMedias)
  );
});

CardMediaAdapter.displayName = "CardMediaAdapter";

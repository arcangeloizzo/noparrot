import { useState, useEffect, useRef, useMemo, memo, useLayoutEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { perfStore } from "@/lib/perfStore";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Trash2, Edit2, ExternalLink, Quote, ShieldCheck, Maximize2, Play, Zap, Flag, ShieldAlert, Repeat } from "lucide-react";
import { ReportContentDialog } from "./ReportContentDialog";
import { AdminRemoveDialog } from "./AdminRemoveDialog";
import { AnimatedHeart } from "@/components/ui/animated-heart";
import { useDominantColors } from "@/hooks/useDominantColors";
import { useCachedTrustScore } from "@/hooks/useCachedTrustScore";
import { useArticlePreview } from "@/hooks/useArticlePreview";
import { useTrustScore } from "@/hooks/useTrustScore";
import { PulseBadge } from "@/components/ui/pulse-badge";
import { TrustBadgeOverlay } from "@/components/ui/trust-badge-overlay";
import { UnanalyzableBadge } from "@/components/ui/unanalyzable-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

// UI Components
import { useCardLayout } from "@/contexts/CardLayoutContext";
import { CategoryChip } from "@/components/ui/category-chip";
import { getCategoryColor } from "@/config/categories";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { VoicePlayer } from "@/components/media/VoicePlayer";
import { ImmersiveVoicePlayerV2 } from "@/components/media/ImmersiveVoicePlayerV2";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuizModal } from "@/components/ui/quiz-modal";

// Feed Components
import { QuotedPostEmbed } from "./QuotedPostEmbed";
import { QuotedEditorialCard } from "./QuotedEditorialCard";
import { MentionText } from "./MentionText";
import { CardExternalCTA } from "./CardExternalCTA";
import { ReshareContextStack } from "./ReshareContextStack";
import { SpotifyGradientBackground } from "./SpotifyGradientBackground";
import { SpotifyPodcastCompactCard } from "./SpotifyPodcastCompactCard";
import { SpotifyTrackEmbed } from "./embeds/SpotifyTrackEmbed";
import { SpotifyEpisodeEmbed } from "./embeds/SpotifyEpisodeEmbed";
import { UserUploadEmbed } from "./embeds/UserUploadEmbed";
import { TwitterTweetEmbed } from "./embeds/TwitterTweetEmbed";
import { LinkedInEmbedCard } from "./embeds/LinkedInEmbedCard";
import { YouTubeShortEmbed } from "./embeds/YouTubeShortEmbed";
import { YouTubeVideoEmbed } from "./embeds/YouTubeVideoEmbed";
import { InstagramReelEmbed } from "./embeds/InstagramReelEmbed";
import { GenericArticleEmbed } from "./embeds/GenericArticleEmbed";
import { SourceImageWithFallback } from "./SourceImageWithFallback";
import { FullTextModal } from "./FullTextModal";
import { DynamicClampBody } from "./DynamicClampBody";
import { MediaPostExpandedSheet } from "./MediaPostExpandedSheet";
import { AcceptChallengeFlow } from "./AcceptChallengeFlow";
import { VoiceCastBody } from "./post-bodies/VoiceCastBody";
import { ChallengeBody } from "./post-bodies/ChallengeBody";
import { LinkedInCard } from "./post-bodies/LinkedInCard";
import { PollWidget } from "./PollWidget";
import { usePollForPost } from "@/hooks/usePollVote";

// Media Components
import { MediaGallery } from "@/components/media/MediaGallery";
import { MediaViewer } from "@/components/media/MediaViewer";
import { AmbientLayer } from "@/components/shared/AmbientLayer";
import { MediaFrame } from "@/components/shared/MediaFrame";

// Composer Components
import { SourceReaderGate } from "../composer/SourceReaderGate";
import { CommentsDrawer } from "./CommentsDrawer";

// Share Components
import { ShareSheet } from "@/components/share/ShareSheet";
import { UnifiedBadge } from "@/components/shared/UnifiedBadge";
import { ClampedTitle } from "@/components/shared/ClampedTitle";
import { PeoplePicker } from "@/components/share/PeoplePicker";

// Hooks & Utils
import { Post, useQuotedPost, useDeletePost } from "@/hooks/usePosts";
import { useToggleReaction } from "@/hooks/usePosts";
import { useAuth } from "@/contexts/AuthContext";
// Removed use-toast
import { toast } from "sonner";
import { TOASTS } from "@/constants/toast-messages";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { cn, getDisplayUsername, decodeHTMLEntities } from "@/lib/utils";
import { generateQA, fetchArticlePreview } from "@/lib/ai-helpers";
import { supabase } from "@/integrations/supabase/client";
import { useCreateThread } from "@/hooks/useMessageThreads";
import { useSendMessage } from "@/hooks/useMessages";
import { getWordCount, getPostFullText, getTestModeWithSource, getQuestionCountWithoutSource, getQuestionCountForIntentReshare } from "@/lib/gate-utils";
import { getMediaLayout, countPostWords, normalizeMedia, calculateMediaLayout, generateAmbientUrl, getAvatarImageUrl, getCardImageUrl, extractYoutubeVideoId } from "@/lib/mediaUtils";
import { useDoubleTap } from "@/hooks/useDoubleTap";
import { useReshareContextStack } from "@/hooks/useReshareContextStack";
import { useOriginalSource } from "@/hooks/useOriginalSource";
import { haptics } from "@/lib/haptics";
import { addBreadcrumb } from "@/lib/crashBreadcrumbs";
import { useChallengeResponses } from "@/hooks/useChallengeResponses";
import { useDynamicCardLayout, FlexibleElementConfig, CompressionStep } from "@/hooks/useDynamicCardLayout";
import { useLongPress } from "@/hooks/useLongPress";
import { ReactionPicker, reactionToEmoji, type ReactionType } from "@/components/ui/reaction-picker";
import { CardShell } from "@/components/shared/CardShell";
import { ReactionsSheet } from "@/components/feed/ReactionsSheet";

// Deep lookup imperativo per risolvere la fonte originale al click (indipendente da React Query)
const resolveOriginalSourceOnDemand = async (quotedPostId: string | null): Promise<{
  url: string;
  title: string | null;
  image: string | null;
} | null> => {
  if (!quotedPostId) return null;

  let currentId: string | null = quotedPostId;
  let depth = 0;
  const MAX_DEPTH = 10;

  while (currentId && depth < MAX_DEPTH) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, shared_url, shared_title, preview_img, quoted_post_id')
      .eq('id', currentId)
      .single();

    if (error || !data) break;

    // Found a post with a source URL
    if (data.shared_url) {
      return {
        url: data.shared_url,
        title: data.shared_title,
        image: data.preview_img,
      };
    }

    // Move to the next ancestor
    currentId = data.quoted_post_id;
    depth++;
  }

  return null;
};

interface ImmersivePostCardProps {
  post: Post;
  onRemove?: (postId: string) => void;  // Accepts postId for stable callback reference
  onQuoteShare?: (post: Post) => void;
  onEdit?: (post: Post) => void;
  /** Open comments drawer automatically when navigating from notifications */
  initialOpenComments?: boolean;
  /** Scroll to specific comment when opening drawer */
  scrollToCommentId?: string;
  /** Index of this card in the feed */
  index?: number;
  isActive?: boolean;
  isNearActive?: boolean;
  isStaff?: boolean;
}

const getHostnameFromUrl = (url: string | undefined): string => {
  if (!url) return 'Fonte';
  try {
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    return new URL(urlWithProtocol).hostname;
  } catch {
    return 'Fonte';
  }
};

const detectPlatformFromUrl = (url: string): string | undefined => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('tiktok')) return 'tiktok';
    if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'youtube';
    if (hostname.includes('twitter') || hostname.includes('x.com')) return 'twitter';
    if (hostname.includes('threads')) return 'threads';
    if (hostname.includes('linkedin')) return 'linkedin';
    if (hostname.includes('spotify')) return 'spotify';
    if (hostname.includes('instagram')) return 'instagram';
    return undefined;
  } catch {
    return undefined;
  }
};

const extractYoutubeVideoId = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    // youtu.be/VIDEO_ID
    if (urlObj.hostname.includes('youtu.be')) {
      return urlObj.pathname.slice(1).split('?')[0];
    }
    // youtube.com/watch?v=VIDEO_ID or youtube.com/shorts/VIDEO_ID
    if (urlObj.hostname.includes('youtube.com')) {
      if (urlObj.pathname.startsWith('/shorts/')) {
        return urlObj.pathname.split('/shorts/')[1].split('?')[0];
      }
      return urlObj.searchParams.get('v');
    }
    return null;
  } catch {
    return null;
  }
};

// Helper to detect if user text is similar to article title (avoids duplication)
const isTextSimilarToTitle = (userText: string, title: string): boolean => {
  if (!userText || !title) return false;
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const normalizedUser = normalize(userText);
  const normalizedTitle = normalize(title);
  // If one contains the other or they are very similar
  return normalizedUser.includes(normalizedTitle) ||
    normalizedTitle.includes(normalizedUser) ||
    normalizedUser === normalizedTitle;
};

// Helper to detect if user text is similar to ANY extracted article content (title, description, content, summary)
// This prevents showing duplicated text when the system auto-filled post.content with extracted text
const isTextSimilarToArticleContent = (userText: string, articlePreview: any): boolean => {
  if (!userText || !articlePreview) return false;

  const normalize = (s: string) => s?.toLowerCase().replace(/[^\w\sàèéìòù]/g, '').replace(/\s+/g, ' ').trim() || '';
  const normalizedUser = normalize(userText);

  if (normalizedUser.length < 10) return false; // Very short text is likely user-written

  // Extract meaningful keywords (filter out stop words and short words)
  const stopWords = new Set(['il', 'la', 'i', 'le', 'un', 'una', 'di', 'da', 'a', 'in', 'con', 'su', 'per', 'che', 'non', 'è', 'uso', 'della', 'del', 'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'for', 'on', 'at', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very']);
  const extractKeywords = (text: string) =>
    normalize(text).split(' ').filter(w => w.length > 3 && !stopWords.has(w));

  // Check against all possible extracted fields
  const fieldsToCheck = [
    articlePreview.title,
    articlePreview.description,
    articlePreview.content,
    articlePreview.summary,
    articlePreview.excerpt
  ].filter(Boolean);

  for (const field of fieldsToCheck) {
    const normalizedField = normalize(field);
    if (normalizedField.length < 10) continue;

    // If one contains the other (substring match)
    if (normalizedUser.includes(normalizedField) || normalizedField.includes(normalizedUser)) {
      return true;
    }

    // Check word overlap (>80% of words match)
    const userWords = new Set(normalizedUser.split(' ').filter(w => w.length > 2));
    const fieldWords = new Set(normalizedField.split(' ').filter(w => w.length > 2));
    if (userWords.size > 0 && fieldWords.size > 0) {
      const overlap = [...userWords].filter(w => fieldWords.has(w)).length;
      const overlapRatio = overlap / Math.min(userWords.size, fieldWords.size);
      if (overlapRatio > 0.8) return true;
    }
  }

  // NEW: Keyword thematic matching - detect if text shares ≥60% of keywords with title
  const userKeywords = extractKeywords(userText);
  const titleKeywords = extractKeywords(articlePreview?.title || '');

  if (userKeywords.length > 3 && titleKeywords.length > 3) {
    const userKeywordSet = new Set(userKeywords);
    const sharedKeywords = titleKeywords.filter(k => userKeywordSet.has(k));
    if (sharedKeywords.length / titleKeywords.length >= 0.6) return true;
  }

  // Headline pattern detection - text ending with "..." is strongly indicative of auto-fill
  const endsWithEllipsis = /\.{3}$|…$/.test(userText.trim());
  const looksLikeHeadline = endsWithEllipsis ||
    (/^[A-ZÀÈÉÌÒÙ]/.test(userText) && userText.split(/[.!?]/).filter(Boolean).length <= 2);

  if (looksLikeHeadline && userKeywords.length >= 2) {
    const titleKeywordSet = new Set(titleKeywords);
    const sharedKeywords = userKeywords.filter(k => titleKeywordSet.has(k));
    // For truncated headlines (ending with ...), 2 shared keywords is enough
    // For other headline patterns, require 3
    const threshold = endsWithEllipsis ? 2 : 3;
    if (sharedKeywords.length >= threshold) return true;
  }

  return false;
};

const ImmersivePostCardInner = ({
  post,
  onRemove,
  onQuoteShare,
  onEdit,
  initialOpenComments = false,
  scrollToCommentId,
  index = 0,
  isActive = false,
  isNearActive = true,
  isStaff = false,
}: ImmersivePostCardProps) => {
  // Track renders via ref increment (no useEffect deps issue)
  const renderCountRef = useRef(0);
  renderCountRef.current++;
  if (perfStore.getState().enabled) {
    perfStore.incrementPostCard();
  }
  const { user } = useAuth();
  const { availableHeight } = useCardLayout();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toggleReaction = useToggleReaction();
  const deletePost = useDeletePost();
  const { data: quotedPost } = useQuotedPost(post.quoted_post_id);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const createThread = useCreateThread();
  const sendMessage = useSendMessage();
  const isOwnPost = user?.id === post.author.id;
  const { data: pollData } = usePollForPost(post.id, { enabled: isActive });
  const canEdit = isOwnPost &&
    (post.reactions?.hearts || 0) === 0 &&
    (post.reactions?.comments || 0) === 0 &&
    (post.shares_count || 0) === 0;

  // Image gating: only load images for cards near the active index
  const shouldLoadImages = isNearActive;

  // Article preview via React Query hook (cached, prefetched)
  const urlToPreview = post.shared_url || quotedPost?.shared_url;
  const { data: articlePreviewData, isLoading: isPreviewLoading } = useArticlePreview(urlToPreview, { enabled: isNearActive });

  // ===== HARDENING 2: Detect if we're waiting for preview data =====
  const isWaitingForPreview = isPreviewLoading && !!urlToPreview;

  // Build article preview with fallbacks - use 'any' for compatibility with existing code
  const articlePreview: any = useMemo(() => {
    // Priority 1: Use articlePreviewData if it has an image
    if (articlePreviewData?.image) {
      return articlePreviewData;
    }

    // Priority 2: Use DB-stored preview_img as fallback (denormalized at publish time)
    const dbImage = post.preview_img || quotedPost?.preview_img;
    if (dbImage) {
      return {
        ...(articlePreviewData || {}),
        platform: articlePreviewData?.platform || (urlToPreview ? detectPlatformFromUrl(urlToPreview) : undefined),
        title: articlePreviewData?.title || post.shared_title || quotedPost?.shared_title || getHostnameFromUrl(urlToPreview),
        description: articlePreviewData?.description || '',
        image: dbImage,
        previewImg: dbImage,
      };
    }

    // Priority 3: articlePreviewData without image (still useful for title/description)
    if (articlePreviewData) {
      return articlePreviewData;
    }

    if (!urlToPreview) return null;

    // Fallback to basic info if hook hasn't resolved yet
    return {
      platform: detectPlatformFromUrl(urlToPreview),
      title: post.shared_title || quotedPost?.shared_title || getHostnameFromUrl(urlToPreview),
      description: '',
      image: '',
    };
  }, [articlePreviewData, urlToPreview, post.shared_title, post.preview_img, quotedPost?.shared_title, quotedPost?.preview_img]);

  // Line-height effettiva del body text in pixel.
  // Deriva da: fontSize 14px × lineHeight 1.55 = 21.7px.
  // Se modifichi fontSize o lineHeight nello stile inline del body, aggiorna anche questo.
  const BODY_LINE_HEIGHT_PX = 14 * 1.55;

  const isSpotify = articlePreview?.platform === 'spotify';
  const isSpotifyEpisode = isSpotify && (
    post.shared_url?.includes('/episode/') ||
    post.shared_url?.includes('/show/') ||
    false
  );

  /**
   * IMPORTANTE — Confine geometrico di availableHeight:
   *
   * Il CardLayoutContext calcola availableHeight sottraendo dal viewport:
   *  - safe-area-inset-top + 154px (Header globale 72px + HeaderRail 82px)
   *  - safe-area-inset-bottom + 164px (BottomNav 64px + Spacing 36px + ActionRail 64px)
   *
   * Conseguenza: HeaderRail e ActionRail GIÀ NON sono dentro availableHeight.
   * L'hook useDynamicCardLayout misura ed include come essenziali SOLO gli elementi
   * posizionati DENTRO il ContentRail (titolo, embed, body, player, CTA).
   *
   * NON agganciare registerRef('essential-*') a HeaderRail o ActionRail: causerebbe
   * doppia sottrazione e collasso del budget flessibili.
   */
  // Hook config and call are defined downstream below variable definitions to prevent TDZ.

  // Gate states
  const [showReader, setShowReader] = useState(false);
  const [readerClosing, setReaderClosing] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [showAnalysisOverlay, setShowAnalysisOverlay] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [readerSource, setReaderSource] = useState<any>(null);
  const [quizData, setQuizData] = useState<any>(null);
  const [gateStep, setGateStep] = useState<string>('idle');

  // Comments state - use initialOpenComments for auto-open from notifications
  const [showComments, setShowComments] = useState(initialOpenComments);

  // YouTube embed state (moved inside YouTubeVideoEmbed)

  // Share states
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showAdminRemoveDialog, setShowAdminRemoveDialog] = useState(false);
  const [shareAction, setShareAction] = useState<'feed' | 'friend' | null>(null);

  // Editorial summary fallback (for legacy posts without article_content)
  const [editorialSummary, setEditorialSummary] = useState<string | null>(null);

  // Full text modal for long posts
  const [showFullText, setShowFullText] = useState(false);
  const [fullTextMode, setFullTextMode] = useState<'description' | 'transcript'>('description');
  const openFullTextDrawer = (mode: 'description' | 'transcript' = 'description') => {
    setFullTextMode(mode);
    setShowFullText(true);
  };
  const [showMediaExpandedSheet, setShowMediaExpandedSheet] = useState(false);

  // Caption expansion state for long Instagram/social captions
  const [showFullCaption, setShowFullCaption] = useState(false);
  const CAPTION_TRUNCATE_LENGTH = 120;

  // Reactions sheet state
  const [showReactionsSheet, setShowReactionsSheet] = useState(false);

  // Challenge flow state
  const [showChallengeFlow, setShowChallengeFlow] = useState(false);

  // F. Internal scroll ref for content rail
  // contentRailRef removed, using midRef from useDynamicCardLayout

  // G. Lazy Mount Flags (Performance Optimization)
  // Prevents mounting dozens of complex Radix UI portals per post until they are actually opened,
  // massively improving feed scroll performance while keeping exit animations intact.
  const hasMountedShare = useRef(false);
  const hasMountedPeople = useRef(false);
  const hasMountedMediaExpand = useRef(false);
  const hasMountedFullText = useRef(false);
  const hasMountedFullCaption = useRef(false);
  const hasMountedReactions = useRef(false);
  const hasMountedReport = useRef(false);
  const hasMountedAdmin = useRef(false);
  const hasMountedReactionPicker = useRef(false);
  const hasMountedChallenge = useRef(false);
  const retriedPreviewUrl = useRef<string | null>(null);

  // Trigger refetch for missing preview images on active cards
  // This helps recover from temporary extraction failures
  useEffect(() => {
    // Skip se abbiamo già ritentato questa URL
    if (retriedPreviewUrl.current === urlToPreview) return;

    if (isNearActive && !isPreviewLoading && urlToPreview && !articlePreview?.image && !post.preview_img) {
      // Only invalidate if we have a URL but no image after loading
      const timeout = setTimeout(() => {
        retriedPreviewUrl.current = urlToPreview;  // Marca PRIMA dell'invalidate
        queryClient.invalidateQueries({ queryKey: ['article-preview', urlToPreview] });
      }, 2000); // Wait 2s before retrying to avoid rapid-fire requests
      return () => clearTimeout(timeout);
    }
  }, [isNearActive, isPreviewLoading, urlToPreview, articlePreview?.image, post.preview_img, queryClient]);

  // Fetch editorial summary for legacy posts (without article_content stored)
  useEffect(() => {
    const loadEditorialSummary = async () => {
      // Only fetch if this is an editorial share without article_content
      if (!post.shared_url?.startsWith('focus://daily/')) {
        setEditorialSummary(null);
        return;
      }

      // Check if article_content is already populated
      const raw = post.article_content || '';
      const cleaned = raw.replace(/\[SOURCE:[\d,\s]+\]/g, '').trim();
      if (cleaned.length > 20) {
        setEditorialSummary(null); // Already have content
        return;
      }

      // Extract focusId and fetch summary from daily_focus
      const focusId = post.shared_url.replace('focus://daily/', '');
      if (!focusId) return;

      try {
        const { data } = await supabase
          .from('daily_focus')
          .select('summary')
          .eq('id', focusId)
          .maybeSingle();

        if (data?.summary) {
          setEditorialSummary(data.summary);
        }
      } catch (err) {
        console.warn('[ImmersivePostCard] Failed to fetch editorial summary:', err);
      }
    };

    loadEditorialSummary();
  }, [post.shared_url, post.article_content]);

  // YouTube transition reset effect (moved inside YouTubeVideoEmbed)

  // Get source from quoted post if current post doesn't have one (2 levels)
  const effectiveSharedUrl = post.shared_url || quotedPost?.shared_url;
  const effectivePreviewImg = post.preview_img || quotedPost?.preview_img;
  const effectiveSharedTitle = decodeHTMLEntities(post.shared_title || quotedPost?.shared_title);

  // For multi-level reshares, find the original source deep in the chain
  // NOTE: Hook called unconditionally first, condition handled inside
  const quotedPostWordCount = quotedPost?.content?.trim().split(/\s+/).length || 0;
  const isReshareWithShortCommentEarly = !!quotedPost && quotedPostWordCount < 30;
  const isReshareWithSourceEarly = !!quotedPost && !!(quotedPost.shared_url || post.shared_url);
  // For Intent posts, don't use stack layout - show QuotedPostCard with text-first layout instead
  const isQuotedIntentPost = !!quotedPost?.is_intent;
  const useStackLayoutEarly = !isQuotedIntentPost && (isReshareWithShortCommentEarly || isReshareWithSourceEarly);

  // Gate logic: ALWAYS search for original source for reshares without direct source
  // Independent from layout - required for Comprehension Gate to find the original URL
  const needsDeepSourceLookup = !!post.quoted_post_id && !effectiveSharedUrl;

  const { data: originalSource } = useOriginalSource(
    needsDeepSourceLookup ? post.quoted_post_id : null,
    { enabled: isNearActive }
  );

  // Final effective source: prefer direct, fallback to deep chain search
  const finalSourceUrl = effectiveSharedUrl || originalSource?.url;
  const finalSourceTitle = effectiveSharedTitle || originalSource?.title;
  const finalSourceImage = effectivePreviewImg || originalSource?.image;
  const earlyIsInstagramReel = post.post_type === 'instagram_reel';
  const earlyHasUserMedia = !!post.media && post.media.length > 0;
  const earlyBackgroundImageUrl = earlyHasUserMedia 
    ? post.media[0].url
    : earlyIsInstagramReel 
      ? (post.preview_img || articlePreview?.image || null)
      : null;

  const reelVirtualMedia = earlyIsInstagramReel && !earlyHasUserMedia && earlyBackgroundImageUrl ? [{
    id: 'reel-preview',
    type: 'image' as const,
    url: earlyBackgroundImageUrl,
  }] : null;

  const finalSourceMedia = post.media?.length 
    ? post.media 
    : (reelVirtualMedia 
      ? reelVirtualMedia 
      : (quotedPost?.media?.length ? quotedPost.media : originalSource?.media));

  // For reshares: lookup cached trust score directly from DB (zero AI calls)
  // Use finalSourceUrl which includes deep chain sources
  const { data: cachedTrustScore } = useCachedTrustScore(finalSourceUrl, { enabled: isNearActive });

  // Trust score via React Query hook (cached, with AI fallback)
  const isTwitterUrl = post.shared_url?.includes('x.com') || post.shared_url?.includes('twitter.com');
  const { data: calculatedTrustScore } = useTrustScore(post.shared_url, {
    postText: post.content,
    authorUsername: articlePreview?.author_username,
    isVerified: articlePreview?.is_verified,
    // Skip if reshare (use cached), Twitter URL without preview, or card not near active index
    skip: !!cachedTrustScore || (isTwitterUrl && !articlePreview) || !isNearActive
  });

  // Use cached trust score for reshares, or calculated for original posts
  // Hide trust score entirely for AI institutional profiles
  const isAiAuthor = !!post.author.is_ai_institutional;
  const displayTrustScore = isAiAuthor ? undefined : (cachedTrustScore || calculatedTrustScore);

  // Reaction picker state
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const likeButtonRef = useRef<HTMLButtonElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);

  const handleHeart = (e?: React.MouseEvent, reactionType: ReactionType | 'heart' = 'heart') => {
    e?.stopPropagation();
    haptics.light();
    // For like reactions, always use 'heart' as the base type for posts
    toggleReaction.mutate({ postId: post.id, reactionType: reactionType as any });
  };

  // Long-press to open the reaction picker; tap to toggle the current reaction.
  // The picker itself owns scroll-lock, auto-close timeout and outside-tap handling.
  const likeButtonHandlers = useLongPress({
    threshold: 450,
    onLongPress: () => setShowReactionPicker(true),
    onTap: () => {
      const currentType = post.user_reactions?.myReactionType || 'heart';
      handleHeart(undefined, currentType);
    },
  });

  const [showHeartAnimation, setShowHeartAnimation] = useState(false);

  const { handleTap: handleDoubleTap } = useDoubleTap({
    onDoubleTap: () => {
      if (!post.user_reactions?.has_hearted) {
        handleHeart();
        setShowHeartAnimation(true);
        // AnimatedHeart handles its own exit via AnimatePresence, but we keep state sync
        setTimeout(() => setShowHeartAnimation(false), 800);
      }
    }
  });

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.light();
    toggleReaction.mutate({ postId: post.id, reactionType: 'bookmark' });
  };

  const getAvatarContent = () => {
    if (post.author.avatar_url) {
      return (
        <img
          src={getAvatarImageUrl(post.author.avatar_url)}
          alt={post.author.full_name || post.author.username}
          width={96}
          height={96}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
      );
    }

    const initial = (post.author.full_name || post.author.username).charAt(0).toUpperCase();
    const bgColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500'];
    const colorIndex = post.author.username.charCodeAt(0) % bgColors.length;

    return (
      <div className={`${bgColors[colorIndex]} w-full h-full flex items-center justify-center text-white font-bold text-lg`}>
        {initial}
      </div>
    );
  };

  // Share handlers
  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.warning(TOASTS.AUTH_REQUIRED.description, {
        action: TOASTS.AUTH_REQUIRED.action
      });
      return;
    }
    setShowShareSheet(true);
  };

  const handleShareToFeed = async () => {
    setShareAction('feed');

    // [UX FIX] Bypass gate if current user is the post author
    // No point testing someone on their own content
    if (user?.id === post.author.id) {
      console.log('[Gate] Bypassing gate - user is post author');
      addBreadcrumb('gate_bypass', { reason: 'author_is_user' });
      onQuoteShare?.({
        ...post,
        _originalSources: Array.isArray(post.sources) ? post.sources : [],
        _gatePassed: true
      });
      toast.success(TOASTS.SHARE_READY.description);
      return;
    }

    const userText = getPostFullText(post);
    const userWordCount = getWordCount(userText);

    // Use finalSourceUrl to include sources from quoted posts and deep chains
    if (finalSourceUrl) {
      await startComprehensionGate();
      return;
    }

    const questionCount = getQuestionCountWithoutSource(userWordCount);

    if (questionCount === 0) {
      onQuoteShare?.({ ...post, _originalSources: Array.isArray(post.sources) ? post.sources : [], _gatePassed: true });
    } else {
      toast.info(TOASTS.READ_REQUIRED.description);
      await startComprehensionGateForPost();
    }
  };

  const handleShareToFriend = async () => {
    setShareAction('friend');

    // [UX FIX] Bypass gate if current user is the post author
    if (user?.id === post.author.id) {
      console.log('[Gate] Bypassing gate for friend share - user is post author');
      addBreadcrumb('gate_bypass', { reason: 'author_is_user_friend' });
      setShowPeoplePicker(true);
      return;
    }

    const userText = getPostFullText(post);
    const userWordCount = getWordCount(userText);

    // Use finalSourceUrl to include sources from quoted posts and deep chains
    if (finalSourceUrl) {
      await startComprehensionGate();
      return;
    }

    const questionCount = getQuestionCountWithoutSource(userWordCount);

    if (questionCount === 0) {
      setShowPeoplePicker(true);
    } else {
      toast.info(TOASTS.READ_REQUIRED.description);
      await startComprehensionGateForPost();
    }
  };

  const startComprehensionGateForPost = async () => {
    if (!user) return;
    setReaderSource({
      id: post.id,
      state: 'reading' as const,
      url: `post://${post.id}`,
      title: post.author.full_name || post.author.username,
      content: post.content,
      isOriginalPost: true,
      // Pass author info for display in reader
      author: post.author.username,
      authorFullName: post.author.full_name,
      authorAvatar: post.author.avatar_url,
    });
    setShowReader(true);
  };

  const goDirectlyToGateForPost = async () => {
    // Direct gate for text-only posts when already read (bypasses reader)
    if (!user) return;

    let userText = getPostFullText(post);
    let gateSourceType: 'text' | 'ocr' | 'editorial' = 'text';
    let qaSourceRef: any = undefined;

    // [FIX] 1. Check for Editorial Share (focus://)
    // If the post shares an editorial, we must gate on the EDITORIAL content, not the user's caption
    if (post.shared_url?.startsWith('focus://daily/')) {
      console.log('[Gate] Detected Editorial share, fetching content...');
      setShowAnalysisOverlay(true);

      const focusId = post.shared_url.replace('focus://daily/', '');
      const { data } = await supabase
        .from('daily_focus')
        .select('title, deep_content, summary')
        .eq('id', focusId)
        .maybeSingle();

      setShowAnalysisOverlay(false);

      if (data && (data.deep_content || data.summary)) {
        // Found editorial content! Use it for the gate
        const editorialContent = (data.deep_content || data.summary || '')
          .replace(/\[SOURCE:[\d,\s]+\]/g, '')
          .trim();

        if (editorialContent.length > 50) {
          userText = editorialContent; // Override text for QA generation
          gateSourceType = 'editorial';
          qaSourceRef = {
            kind: 'url',
            id: post.shared_url,
            url: post.shared_url
          };
        }
      }
    }

    // [FIX] 2. Check for Media OCR/Transcript
    // If no editorial, check if media has extracted text (e.g. OCR)
    if (gateSourceType === 'text' && post.media && post.media.length > 0) {
      // Find media with significant extracted text
      const mediaWithText = post.media.find((m: any) =>
        m.extracted_status === 'done' &&
        m.extracted_text &&
        m.extracted_text.length > 120
      );

      if (mediaWithText) {
        userText = mediaWithText.extracted_text; // Override text for QA generation
        gateSourceType = 'ocr';
        qaSourceRef = {
          kind: mediaWithText.extracted_kind || 'ocr',
          id: mediaWithText.id,
          url: mediaWithText.url
        };
      }
    }

    // Calculate requirements based on the RESOLVED content (User Text, Editorial, or OCR)
    const effectiveWordCount = getWordCount(userText);

    // For Editorial/OCR, we force 3 questions (SOURCE_ONLY equivalent)
    // For simple text, we use existing logic
    let questionCount = 0;

    if (gateSourceType === 'editorial' || gateSourceType === 'ocr') {
      questionCount = 3;
    } else {
      questionCount = getQuestionCountWithoutSource(effectiveWordCount);
    }

    console.log('[Gate] goDirectlyToGateForPost resolved:', {
      gateSourceType,
      effectiveWordCount,
      questionCount
    });

    // If no questions needed, go straight to composer
    if (questionCount === 0) {
      onQuoteShare?.({ ...post, _originalSources: Array.isArray(post.sources) ? post.sources : [], _gatePassed: true });
      toast.success(TOASTS.SHARE_READY.description);
      return;
    }

    // [UX CHANGE] Use overlay instead of toast
    setShowAnalysisOverlay(true);

    try {
      const result = await generateQA({
        contentId: post.id,
        title: post.author.full_name || post.author.username,
        summary: userText, // Use the resolved text (Editorial/OCR/Caption)
        userText: userText || '',
        questionCount: questionCount as 1 | 3,
        qaSourceRef, // Pass the source ref if available
      });

      // Hide overlay
      setShowAnalysisOverlay(false);

      if (result.insufficient_context) {
        toast.info(TOASTS.GATE_INSUFFICIENT_CONTENT.description);
        onQuoteShare?.({ ...post, _originalSources: Array.isArray(post.sources) ? post.sources : [], _gatePassed: true });
        return;
      }

      if (!result || result.error || !result.questions?.length) {
        toast.error(result?.error || TOASTS.ERROR_GENERIC.description);
        return;
      }

      setQuizData({ qaId: result.qaId, questions: result.questions, sourceUrl: `post://${post.id}` });
      setShowQuiz(true);
    } catch (error) {
      setShowAnalysisOverlay(false);
      toast.error(TOASTS.ERROR_GENERIC.description);
    }
  };

  const startComprehensionGate = async () => {
    if (!user) return;

    // [UX FIX] Bypass gate if current user is the post author
    if (user.id === post.author.id) {
      console.log('[Gate] Bypassing startComprehensionGate - user is post author');
      addBreadcrumb('gate_bypass', { reason: 'author_is_user_gate' });
      if (shareAction === 'feed') {
        onQuoteShare?.({
          ...post,
          _originalSources: Array.isArray(post.sources) ? post.sources : [],
          _gatePassed: true
        });
      } else {
        setShowPeoplePicker(true);
      }
      toast.success(TOASTS.SHARE_READY.description);
      return;
    }

    // On-demand deep lookup: garantisce di avere la fonte anche se hook non ha finito
    let resolvedSourceUrl = finalSourceUrl;

    if (!resolvedSourceUrl && post.quoted_post_id) {
      // Use overlay for loading source
      setShowAnalysisOverlay(true);
      const deepSource = await resolveOriginalSourceOnDemand(post.quoted_post_id);
      setShowAnalysisOverlay(false);

      if (deepSource?.url) {
        resolvedSourceUrl = deepSource.url;
      }
    }

    if (!resolvedSourceUrl) {
      // Nessuna fonte trovata nella catena - fail-closed: non permettiamo share
      toast.error('Impossibile trovare la fonte');
      setShareAction(null);
      return;
    }

    // === GESTIONE ESPLICITA PER "Il Punto" (focus://daily/...) ===
    if (resolvedSourceUrl.startsWith('focus://daily/')) {
      const focusId = resolvedSourceUrl.replace('focus://daily/', '');

      // Fetch contenuto editoriale dal DB
      let editorialContent: string | undefined = undefined;
      let editorialTitle = 'Il Punto';

      if (!editorialContent || editorialContent.length < 50) {
        const { data } = await supabase
          .from('daily_focus')
          .select('title, deep_content, summary')
          .eq('id', focusId)
          .maybeSingle();

        if (data) {
          editorialTitle = data.title || 'Il Punto';
          // Pulisci markers [SOURCE:N] dal contenuto
          editorialContent = (data.deep_content || data.summary || '')
            .replace(/\[SOURCE:[\d,\s]+\]/g, '')
            .trim();
        }
      }

      if (!editorialContent || editorialContent.length < 50) {
        toast.error('Contenuto editoriale non disponibile');
        setShareAction(null);
        return;
      }

      // Apri reader con contenuto editoriale reale
      setReaderSource({
        id: focusId,
        state: 'reading' as const,
        url: `editorial://${focusId}`,  // Usa editorial:// per il quiz
        title: editorialTitle,
        content: editorialContent,
        articleContent: editorialContent,
        summary: editorialContent.substring(0, 200),
        isEditorial: true,
        platform: 'article',
        contentQuality: 'complete',
        qaSourceRef: {
          kind: 'url',
          id: `editorial://${focusId}`,
          url: `editorial://${focusId}`,
        }
      });
      setShowReader(true);
      return;
    }

    try {
      const host = new URL(resolvedSourceUrl).hostname.toLowerCase();
      // LinkedIn removed - iframe will fallback to Preview Card if blocked by CSP
      const isBlockedPlatform = host.includes('instagram.com') || host.includes('facebook.com') || host.includes('m.facebook.com') || host.includes('fb.com') || host.includes('fb.watch');

      // Check if current post OR quoted post is an Intent post
      const isCurrentPostIntent = post.is_intent;
      const isQuotedPostIntent = quotedPost?.is_intent;

      // For Intent posts (is_intent = true), show reader first to let user read content
      // Intent posts are created with minimum 30 words, so gate is always required
      if ((isCurrentPostIntent || isQuotedPostIntent) && isBlockedPlatform) {
        // Use the Intent post's content (either current or quoted)
        const intentPost = isCurrentPostIntent ? post : quotedPost;
        const userText = [intentPost?.title, intentPost?.content].filter(Boolean).join('\n\n') || '';
        const userWordCount = getWordCount(userText);

        // Intent posts always require gate (min 30 words guaranteed at creation)
        // Use < 30 instead of <= 30 because 30 words is the minimum threshold
        if (userWordCount < 30) {
          // Fallback for edge cases - shouldn't happen for valid Intent posts
          onQuoteShare?.({ ...post, _gatePassed: true });
          toast.info('Post pronto per la condivisione');
          return;
        }

        const questionCount = getQuestionCountForIntentReshare(userWordCount);

        // Show reader first for Intent posts with >=30 words
        setReaderSource({
          id: intentPost?.id || post.id,
          state: 'reading' as const,
          url: `post://${intentPost?.id || post.id}`,
          title: intentPost?.author?.full_name || intentPost?.author?.username || 'Post utente',
          content: userText,
          isOriginalPost: true,
          isIntentPost: true,
          questionCount,
          author: intentPost?.author?.username,
          authorFullName: intentPost?.author?.full_name,
          authorAvatar: intentPost?.author?.avatar_url,
        });
        setShowReader(true);
        return;
      }

      // For non-Intent posts with blocked platform links, show toast and open externally
      if (isBlockedPlatform) {
        toast.info('Link non supportato nel Reader — Instagram e Facebook non sono supportati. Apertura in nuova scheda.');
        window.open(resolvedSourceUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch { }

    toast.info('Caricamento contenuto...');

    const preview = await fetchArticlePreview(resolvedSourceUrl);
    let hostname = '';
    try { hostname = new URL(resolvedSourceUrl).hostname.replace('www.', ''); } catch { }

    // FIX: Build qaSourceRef for server-side content fetching
    // Use preview.qaSourceRef if available, otherwise construct from URL
    const buildQaSourceRef = (url: string, platform?: string) => {
      // If preview already has qaSourceRef, use it
      if (preview?.qaSourceRef) return preview.qaSourceRef;

      // Platform-specific refs
      if (platform === 'youtube' || hostname.includes('youtube') || hostname.includes('youtu.be')) {
        const videoId = extractYoutubeVideoId(url);
        if (videoId) return { kind: 'youtubeId' as const, id: videoId, url };
      }
      if (platform === 'spotify' || hostname.includes('spotify')) {
        const spotifyMatch = url.match(/(track|episode|show)\/([a-zA-Z0-9]+)/);
        if (spotifyMatch) return { kind: 'spotifyId' as const, id: spotifyMatch[2], url };
      }
      if (platform === 'twitter' || hostname.includes('twitter') || hostname.includes('x.com')) {
        const tweetMatch = url.match(/status\/(\d+)/);
        if (tweetMatch) return { kind: 'tweetId' as const, id: tweetMatch[1], url };
      }
      // Default: generic URL ref
      return { kind: 'url' as const, id: url, url };
    };

    const detectedPlatform = preview?.platform || detectPlatformFromUrl(resolvedSourceUrl);
    const qaSourceRef = buildQaSourceRef(resolvedSourceUrl, detectedPlatform);

    setReaderSource({
      ...preview,
      id: post.id,
      state: 'reading' as const,
      url: resolvedSourceUrl,
      title: preview?.title || finalSourceTitle || `Contenuto da ${hostname}`,
      content: preview?.content || preview?.description || preview?.summary || preview?.excerpt || post.content || '',
      summary: preview?.summary || preview?.description || 'Apri il link per visualizzare il contenuto completo.',
      image: preview?.image || finalSourceImage || '',
      platform: detectedPlatform,
      contentQuality: preview?.contentQuality || 'minimal',
      qaSourceRef: qaSourceRef,  // FIX: Include qaSourceRef for generateQA
    });
    setShowReader(true);
  };

  const closeReaderSafely = async () => {
    setReaderClosing(true);
    try {
      const gateRoot = document.querySelector('[data-reader-gate-root="true"]') as HTMLElement | null;
      const iframes = (gateRoot ? gateRoot.querySelectorAll('iframe') : document.querySelectorAll('iframe'));
      iframes.forEach((iframe) => {
        try { (iframe as HTMLIFrameElement).src = 'about:blank'; } catch { }
      });
    } catch { }
    await new Promise((resolve) => setTimeout(resolve, 50));
    setShowReader(false);
    setReaderClosing(false);
    setReaderLoading(false);
    setReaderSource(null);
    setShareAction(null);
  };

  const handleReaderComplete = async () => {
    if (!readerSource || !user) return;
    setGateStep('reader:loading');
    setReaderLoading(true);
    setShowAnalysisOverlay(true); // [ANIMATION] Show overlay during generation
    console.log('[Gate] handleReaderComplete started', {
      isIntentPost: readerSource.isIntentPost,
      isOriginalPost: readerSource.isOriginalPost,
      isEditorial: readerSource.isEditorial,
      url: readerSource.url?.substring(0, 50)
    });

    // Safety timeout - 30 seconds max
    const timeoutId = setTimeout(() => {
      console.error('[Gate] TIMEOUT: Quiz generation exceeded 30 seconds');
      toast.error('La generazione del quiz ha impiegato troppo tempo. Riprova.');
      setReaderLoading(false);
      setReaderClosing(false);
      setGateStep('idle');
    }, 30000);

    try {
      // Check contenuto minimo per fonti esterne (non Intent, non OriginalPost)
      const isEditorial = readerSource.isEditorial || readerSource.url?.startsWith('editorial://');

      if (!readerSource.isOriginalPost && !readerSource.isIntentPost && !isEditorial) {
        const hasContent = readerSource.content || readerSource.summary || readerSource.articleContent;
        const platform = readerSource.platform;

        // Platforms with rich metadata: let backend decide even if content is empty
        const platformsWithMetadata = ['spotify', 'youtube', 'tiktok', 'twitter'];
        const hasRichMetadata = platformsWithMetadata.includes(platform || '');

        if (!hasContent && !hasRichMetadata) {
          console.log('[Gate] Content missing and not a rich metadata platform');
          toast.error(TOASTS.GATE_INSUFFICIENT_CONTENT.description);
          setReaderLoading(false);
          setShowAnalysisOverlay(false);
          clearTimeout(timeoutId);
          return;
        }
      }

      const isOriginalPost = readerSource.isOriginalPost;
      const userText = getPostFullText(post);
      const userWordCount = getWordCount(userText);

      let testMode: 'SOURCE_ONLY' | 'MIXED' | 'USER_ONLY' | undefined;
      let questionCount: 1 | 3 | undefined;

      // [FIX] For Editorials, force 3 questions (SOURCE_ONLY)
      if (isEditorial) {
        testMode = 'SOURCE_ONLY';
        questionCount = 3;
      } else if (isOriginalPost) {
        questionCount = getQuestionCountWithoutSource(userWordCount) as 1 | 3;
      } else {
        testMode = getTestModeWithSource(userWordCount);
      }

      console.log('[Gate] Generating QA with params:', {
        userWordCount,
        testMode,
        questionCount,
        isOriginalPost,
        isEditorial,
        qaSourceRef: readerSource.qaSourceRef
      });

      // 2️⃣ GENERA QA MENTRE IL READER È ANCORA APERTO
      const result = await generateQA({
        contentId: post.id,
        title: readerSource.title,
        summary: (isOriginalPost || isEditorial) ? (readerSource.content || readerSource.summary || post.content) : undefined,
        userText: userText || '',
        questionCount,
        testMode,
        qaSourceRef: readerSource.qaSourceRef,
        sourceUrl: readerSource.url,
      });

      clearTimeout(timeoutId);

      console.log('[Gate] generateQA result', {
        hasQuestions: !!result?.questions,
        questionCount: result?.questions?.length,
        error: result?.error,
        insufficient_context: result?.insufficient_context
      });

      // 3️⃣ GESTISCI ERRORI PRIMA DI CHIUDERE
      if (result.insufficient_context) {
        toast.info(TOASTS.GATE_INSUFFICIENT_CONTENT.description);
        setShowAnalysisOverlay(false);
        await closeReaderSafely();
        onQuoteShare?.(post);
        return;
      }

      if (!result) {
        console.error('[Gate] generateQA returned null/undefined');
        toast.error('Risposta non valida dal server');
        setReaderLoading(false);
        setShowAnalysisOverlay(false);
        return; // Reader resta aperto
      }

      if (result.error) {
        console.error('[Gate] generateQA error:', result.error);

        // [HARDENING] Spotify/YouTube Fallback Strategy
        // If transcript fails, allow intent mode fallback
        const isSpotify = readerSource.platform === 'spotify' || readerSource.url?.includes('spotify') || false;

        if (isSpotify || result.error?.toLowerCase().includes('transcript') || result.error?.toLowerCase().includes('trascrizione')) {
          console.log('[Gate] Quiz failed, activating fallback to Intent Mode');
          toast.warning('Trascrizione non disponibile. Aggiungi la tua opinione (30 parole) per condividere.');

          setShowAnalysisOverlay(false);
          await closeReaderSafely();
          // Pass specific flags to Composer to enforce Intent Mode
          onQuoteShare?.({
            ...post,
            _forceIntentMode: true,
            _gatePassed: true,
          } as any);
          return;
        }

        toast.error(result.error);
        setReaderLoading(false);
        setShowAnalysisOverlay(false);
        return; // Reader resta aperto
      }

      if (!result.questions || !Array.isArray(result.questions) || result.questions.length === 0) {
        console.error('[Gate] Invalid questions array:', result.questions);
        toast.error('Quiz non valido, riprova');
        setReaderLoading(false);
        setShowAnalysisOverlay(false);
        return; // Reader resta aperto
      }

      const invalidQuestion = result.questions.find(q => !q.id || !q.stem || !q.choices);
      if (invalidQuestion) {
        console.error('[Gate] Invalid question format:', invalidQuestion);
        toast.error('Formato domanda non valido');
        setReaderLoading(false);
        setShowAnalysisOverlay(false);
        return; // Reader resta aperto
      }

      // 4️⃣ SALVA sourceUrl PRIMA di chiudere
      const sourceUrl = readerSource.url || '';

      console.log('[Gate] Quiz generated, transitioning...', {
        questionCount: result.questions.length,
        sourceUrl,
      });

      // 5️⃣ OVERLAY APPROACH (iOS-safe): monta il quiz SOPRA al reader, poi chiudi il reader
      setGateStep('quiz:mount');

      setQuizData({
        qaId: result.qaId, // Server-generated qaId for secure validation
        questions: result.questions,
        sourceUrl,
      });
      setShowQuiz(true);

      // STEP B: aspetta 1 frame per garantire che il quiz sia renderizzato
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      // STEP C: ora possiamo chiudere il reader in sicurezza (dietro al quiz)
      setGateStep('reader:closing');
      setReaderClosing(true);
      await new Promise((resolve) => setTimeout(resolve, 50));

      setGateStep('reader:unmount');
      setShowReader(false);
      setReaderLoading(false);
      setReaderSource(null);

      // STEP D: reset closing + stato finale
      setReaderClosing(false);
      setGateStep('quiz:shown');

      console.log('[Gate] Quiz mounted successfully');
    } catch (error) {
      setGateStep('error');
      console.error('[Gate] Error in handleReaderComplete:', error);
      toast.error(TOASTS.ERROR_GENERIC.description);
      setReaderLoading(false);
      setShowAnalysisOverlay(false);
      setReaderClosing(false);
      clearTimeout(timeoutId);
    }
  };

  const handleQuizSubmit = async (answers: Record<string, string>) => {
    if (!user || !quizData) return { passed: false, score: 0, total: 0, wrongIndexes: [] };

    try {
      console.log('Quiz submitted:', { answers, postId: post.id, sourceUrl: quizData.sourceUrl });

      // SECURITY HARDENED: Use qaId for deterministic server-side validation
      const { data, error } = await supabase.functions.invoke('submit-qa', {
        body: {
          qaId: quizData.qaId, // Server-generated qaId
          postId: post.id,
          sourceUrl: quizData.sourceUrl,
          answers,
          gateType: 'share'
        }
      });

      console.log('Quiz validation response:', { data, error });

      if (error) {
        console.error('Quiz validation error:', error);
        throw error;
      }

      // SECURITY HARDENED: Server is the ONLY source of truth - no client-side overrides
      const passed = data.passed;

      console.log('Quiz result details:', {
        score: data.score,
        total: data.total,
        errors: data.total - data.score,
        percentage: ((data.score / data.total) * 100).toFixed(0) + '%',
        passed
      });

      if (passed) {
        // [FIX] Update local state
        // onGatePassed?.();
        // We wait for onComplete from QuizModal.
      } else {
        console.warn('Test failed');
        addBreadcrumb('quiz_closed', { via: 'failed' });
        // We do NOT close the quiz here. We wait for user to click "Close" in QuizModal.
      }

      return data;
    } catch (error) {
      console.error('Error validating quiz:', error);
      toast.error(TOASTS.ERROR_GENERIC.description);
      addBreadcrumb('quiz_closed', { via: 'error' });
      return { passed: false, score: 0, total: 0, wrongIndexes: [] };
    }
  };

  // [NEW] Handle Quiz Completion
  const handleQuizComplete = (passed: boolean) => {
    if (passed) {
      const currentShareAction = shareAction;
      setShowQuiz(false);
      setQuizData(null);
      setShowAnalysisOverlay(false);
      setGateStep('idle');

      // If quiz was for challenge respond, open the challenge flow
      if (quizData?.onChallengeRespond) {
        setShowChallengeFlow(true);
        setShareAction(null);
        return;
      }

      if (currentShareAction === 'feed') {
        onQuoteShare?.({ ...post, _originalSources: Array.isArray(post.sources) ? post.sources : [], _gatePassed: true });
      } else if (currentShareAction === 'friend') {
        setShowPeoplePicker(true);
      }
      setShareAction(null);
    } else {
      setShowQuiz(false);
      setQuizData(null);
      setShareAction(null);
      setGateStep('idle');
    }
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: it });
  const normalizedMedias = useMemo(
    () => normalizeMedia(post, articlePreview),
    [post, articlePreview]
  );
  const hasMedia = (post.media && post.media.length > 0);
  const hasLink = !!post.shared_url;
  const isSpotifyTrack = isSpotify && !isSpotifyEpisode;
  const isTwitter = articlePreview?.platform === 'twitter' || detectPlatformFromUrl(post.shared_url || '') === 'twitter';
  const isLinkedIn = articlePreview?.platform === 'linkedin' || detectPlatformFromUrl(post.shared_url || '') === 'linkedin';
  const isYoutubeShort = !!(
    post.shared_url && 
    post.shared_url.includes('/shorts/') && 
    (post.shared_url.includes('youtube.com') || post.shared_url.includes('youtu.be'))
  );
  const isYoutube = (articlePreview?.platform === 'youtube' ||
    (post.shared_url?.includes('youtube.com') || post.shared_url?.includes('youtu.be'))) &&
    !isYoutubeShort;
  const isMediaOnlyPost = hasMedia && !hasLink;
  const mediaUrl = post.media?.[0]?.url;
  const isVideoMedia = post.media?.[0]?.type === 'video';

  const downscaledPostMedia = useMemo(() => {
    if (!post.media) return [];
    return post.media.map(item => ({
      ...item,
      url: getCardImageUrl(item.url, 1200, 75),
      thumbnail_url: item.thumbnail_url ? getCardImageUrl(item.thumbnail_url, 1200, 75) : undefined
    }));
  }, [post.media]);

  const downscaledMediaUrl = useMemo(() => {
    return getCardImageUrl(mediaUrl, 1200, 75);
  }, [mediaUrl]);
  const backgroundImage = !isMediaOnlyPost ? (articlePreview?.image || post.preview_img || (post.media?.[0]?.url || quotedPost?.media?.[0]?.url || quotedPost?.preview_img)) : undefined;
  
  const isInstagramReel = post.post_type === 'instagram_reel';
  const hasUserMedia = !!post.media && post.media.length > 0;
  // TAPPO TEMPORANEO (giu 2026) — il pattern foreground-nascosto+background-bleed è
  // obsoleto vs spec v1.1 §5.1 (matrice orientation-driven). Verrà sostituito dai
  // sotto-blocchi B (MediaFrame) + C (rendering single image) + E (VerticalStage).
  // Per ora: solo Reel/Short mantengono background-bleed; upload utente torna a
  // renderizzare il foreground come prima del blocco AmbientLayer generalizzato.
  const shouldUseBlurredBg = isInstagramReel;

  const backgroundImageUrl = hasUserMedia 
    ? post.media[0].url
    : isInstagramReel 
      ? (post.preview_img || articlePreview?.image || null)
      : isYoutubeShort
        ? (
            articlePreview?.image || 
            post.preview_img || 
            (post.shared_url ? `https://img.youtube.com/vi/${extractYoutubeVideoId(post.shared_url)}/maxresdefault.jpg` : null)
          )
        : null;

  const overlayGradient = isInstagramReel
    ? 'linear-gradient(135deg, rgba(131, 58, 180, 0.15) 0%, rgba(253, 29, 29, 0.12) 50%, rgba(247, 119, 55, 0.10) 100%)'
    : isYoutubeShort
      ? 'linear-gradient(135deg, rgba(255, 0, 0, 0.15) 0%, rgba(40, 40, 40, 0.12) 100%)'
      : null;

  const isVoicePost = post.post_type === 'voice';
  const hasValidChallengeData = !!post.challenge && !!(post.challenge.voice_post || post.voice_post);
  const isChallengePost = post.post_type === 'challenge' && hasValidChallengeData;
  const isAudioPost = isVoicePost || isChallengePost;

  const activeVoicePost = isChallengePost ? (post.challenge?.voice_post || post.voice_post) : post.voice_post;
  const challengeIdForResponses = isChallengePost ? post.challenge?.id || null : null;

  const hasVoiceTitle = Boolean(activeVoicePost?.title);
  const voiceTitle = hasVoiceTitle ? activeVoicePost?.title : '';
  const voiceContent = hasVoiceTitle ? activeVoicePost?.body_text : post.content;

  const hasChallengeTitle = Boolean(post.challenge?.title);
  const challengeTitle = hasChallengeTitle ? post.challenge?.title : '';
  const challengeContent = hasChallengeTitle ? post.challenge?.body_text : post.content;

  // B. Adaptive Image Height
  const hasAudioPlayer = !!(activeVoicePost);
  const cardHasTitle = !!(post.title || activeVoicePost?.title);
  const hasLongBody = (post.content?.length || 0) > 120 || (activeVoicePost?.body_text?.length || 0) > 120;
  
  let imageHeightClass = 'img-default';
  if (hasAudioPlayer && cardHasTitle) {
    imageHeightClass = 'img-minimal';
  } else if (hasLongBody || hasAudioPlayer) {
    imageHeightClass = 'img-compact';
  }
  const { responses: challengeResponses, userVote, voteForResponse, removeVote } = useChallengeResponses(challengeIdForResponses, { enabled: isActive });
  const [challengeDrawerOpen, setChallengeDrawerOpen] = useState(false);

  // Challenge countdown
  const challengeExpiresAt = isChallengePost ? post.challenge?.expires_at : null;
  const [challengeCountdown, setChallengeCountdown] = useState('');
  const challengeMsRemaining = challengeExpiresAt
    ? new Date(challengeExpiresAt).getTime() - Date.now()
    : 0;
  const isChallengeUrgent = challengeMsRemaining > 0 && challengeMsRemaining < 2 * 60 * 60 * 1000;
  const isChallengeExpired = challengeExpiresAt
    ? new Date(challengeExpiresAt) < new Date()
    : false;

  useEffect(() => {
    if (!challengeExpiresAt) return;
    const update = () => {
      const ms = new Date(challengeExpiresAt).getTime() - Date.now();
      if (ms <= 0) { setChallengeCountdown('Chiusa'); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      if (h > 24) setChallengeCountdown(`${Math.floor(h / 24)}g ${h % 24}h`);
      else setChallengeCountdown(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [challengeExpiresAt]);
  // Ensure text-only really means NO media and NO link in either post
  const isTextOnly = !hasMedia && !hasLink && !quotedPost?.shared_url && !isAudioPost;
  const isIntentPost = !!post.is_intent;
  const articleTitle = decodeHTMLEntities(articlePreview?.title || post.shared_title || '');
  // Show user text ONLY if it's genuinely different from title AND extracted content
  // AI institutional profiles bypass these heuristics: their bodies are always editorially distinct
  const shouldShowUserText = hasLink && post.content && (
    isAiAuthor ||
    (!isTextSimilarToTitle(post.content, articleTitle) &&
     !isTextSimilarToArticleContent(post.content, articlePreview))
  );

  // Reshare Stack logic: detect if this is a reshare where the QUOTED POST has short comment (<30 words)
  // (quotedPostWordCount already computed early for hook ordering)
  const isReshareWithShortComment = !!quotedPost && quotedPostWordCount < 30;

  // New: detect if reshare has a source (URL) - use stack layout for any length
  const isReshareWithSource = !!quotedPost && !!(quotedPost.shared_url || post.shared_url);

  // Use stack layout for: short comments OR reshares with source (any comment length)
  // BUT NOT for Intent posts - show QuotedPostCard with text-first layout instead
  // Use stack layout for ALL reshares (except Intent posts which have their own special layout)
  const useStackLayout = !!quotedPost && !isQuotedIntentPost;

  // Deep chain source preview is now handled by useArticlePreview hook via urlToPreview

  // Fetch context stack for ALL reshares (show chain for any reshare)
  const { data: contextStack = [] } = useReshareContextStack(post.quoted_post_id);

  // Extract dominant colors from media - skip for cards not near active index
  const { primary: dominantPrimary, secondary: dominantSecondary } = useDominantColors(isMediaOnlyPost ? mediaUrl : undefined, { skip: !isNearActive });

  // D. Media text block replacement
  const hasAnyVisualMedia = !!(post.media?.[0]?.url || quotedPost?.media?.[0]?.url || post.shared_url || post.voice_post || post.challenge?.voice_post);
  const renderBodyText = (content: string | undefined | null, hasTitle: boolean) => {
    if (!content || content.trim().length === 0) return null;
    
    if (hasAnyVisualMedia) {
      const shouldTruncateMediaPost = content.length > 120;
      return (
        <div style={{ zIndex: 10, position: 'relative' }}>
          <div style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            lineHeight: 1.45,
            color: 'rgba(255, 255, 255, 0.55)',
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            <MentionText content={content} />
          </div>
          {shouldTruncateMediaPost && (
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                color: '#0A7AFF',
                fontWeight: 600,
                marginTop: '4px',
                cursor: 'pointer'
              }}
              onClick={(e) => { e.stopPropagation(); setShowMediaExpandedSheet(true); }}
            >
              Approfondisci
            </div>
          )}
        </div>
      );
    }

    return (
      <div 
        className={cn(
          "whitespace-pre-wrap break-words ",
          hasTitle ? "text-[14px] text-[#7A8FA6]" : "text-lg sm:text-xl font-normal text-slate-600 dark:text-white/90 leading-snug tracking-wide text-pretty"
        )}
        style={hasTitle ? { fontFamily: 'Inter, sans-serif', lineHeight: 1.55, textAlign: 'left' } : {}}
      >
        <DynamicClampBody
          containerRef={midRef}
          content={content}
          onShowFull={() => openFullTextDrawer('description')}
          enabled={isNearActive}
          lineHeightPx={hasTitle ? 22 : 28}
          minLines={2}
          fadeColor="#0d1117"
        />
      </div>
    );
  };

  const isStandardPost = !hasLink && !isAudioPost && !isIntentPost && !useStackLayout;
  const isGenericArticle = hasLink && 
    !isSpotify && 
    !isYoutube && 
    !isTwitter && 
    !isLinkedIn && 
    !isAudioPost && 
    !isInstagramReel &&
    !useStackLayout;

  const linkPreviewMedia = normalizedMedias.find(m => m.source === 'link_preview');

  // SINGLE SOURCE OF TRUTH: kill switch globale per MediaFrame branch generic article.
  // Se vuoi rimuovere il kill switch in futuro, cambia false → true qui E nelle due IIFE locali (~riga 3135 e ~riga 4420).
  // Vedi CICATRICE: MediaFrame branch generic article disabilitato per edge case multipli iPhone SE.
  const hasPreviewMetadataTopLevel = false && !!linkPreviewMedia;

  const postWordCount = countPostWords(post.title, post.content);
  const isArticleMiniActive = isGenericArticle 
    && hasPreviewMetadataTopLevel
    && !!linkPreviewMedia 
    && calculateMediaLayout(linkPreviewMedia, postWordCount) === 'mini';

  const hasImage = isStandardPost && (post.preview_img || (post.media && post.media.length > 0));

  const isEditorialFocus = isGenericArticle && post.shared_url?.startsWith('focus://');
  const articleFullHeight = isEditorialFocus 
    ? (editorialSummary || post.article_content ? 240 : 120)
    : ((articlePreview?.image || post.preview_img) ? 240 : 100);

  const essentialsConfig = useMemo(() => {
    if (useStackLayout) {
      return [
        { id: 'essential-title' }
      ];
    }
    if (isSpotifyEpisode) {
      return [
        { id: 'essential-title' },
        {
          id: 'essential-spotify',
          states: [
            { id: 'full', height: 100 },
            { id: 'pill', height: 36 }
          ]
        }
      ];
    }
    if (isSpotifyTrack) {
      return [
        { id: 'essential-title' },
        {
          id: 'essential-spotify-song',
          states: [
            { id: 'full', height: 100 },
            { id: 'pill', height: 36 }
          ]
        }
      ];
    }
    if (isYoutubeShort) {
      return [
        { id: 'essential-title' },
        { id: 'essential-external-cta' }
      ];
    }
    if (isYoutube) {
      return [
        { id: 'essential-title' },
        {
          id: 'essential-youtube',
          states: [
            { id: 'full', height: 200 },
            { id: 'compact', height: 80 }
          ]
        },
        { id: 'essential-external-cta' }
      ];
    }
    if (isGenericArticle) {
      return [
        { id: 'essential-title' },
        {
          id: 'essential-article',
          states: [
            { id: 'full', height: articleFullHeight },
            { id: 'compact', height: 64 },
            { id: 'pill', height: 36 }
          ]
        }
      ];
    }
    if (isInstagramReel) {
      return [
        { id: 'essential-title' },
        { id: 'essential-external-cta' }
      ];
    }
    if (isStandardPost || isIntentPost) {
      return [
        { id: 'essential-title' }
      ];
    }
    if (isVoicePost) {
      return [
        { id: 'essential-title' },
        {
          id: 'essential-voice-player',
          states: [
            { id: 'standard', height: 260 },
            { id: 'compact', height: 80 }
          ]
        }
      ];
    }
    if (isChallengePost) {
      const isAuthor = user?.id === post.author.id;
      return [
        { id: 'essential-title' },
        { id: 'essential-challenge-player' },
        { id: 'essential-polarization' },
        ...(!isAuthor ? [{ id: 'essential-cta-accept' }] : [])
      ];
    }
    if (isLinkedIn) {
      return [
        { id: 'essential-title' },
        {
          id: 'essential-linkedin-embed',
          states: [
            { id: 'full', height: 320 },
            { id: 'compact', height: 170 },
            { id: 'pill', height: 50 }
          ]
        },
        { id: 'essential-external-cta' }
      ];
    }
    if (isTwitter) {
      return [
        { id: 'essential-title' },
        {
          id: 'essential-tweet-embed',
          states: [
            { id: 'full', height: 250 },
            { id: 'compact', height: 130 },
            { id: 'pill', height: 50 }
          ]
        },
        { id: 'essential-external-cta' }
      ];
    }
    return [];
  }, [
    isSpotifyEpisode,
    isSpotifyTrack,
    isYoutube,
    isYoutubeShort,
    isGenericArticle,
    isStandardPost,
    isInstagramReel,
    isIntentPost,
    isVoicePost,
    isChallengePost,
    isLinkedIn,
    isTwitter,
    voiceTitle,
    challengeTitle,
    articleFullHeight,
    useStackLayout,
    user?.id
  ]);

  const flexiblesConfig = useMemo(() => {
    if (useStackLayout) {
      const config: FlexibleElementConfig[] = [];
      config.push({
        id: 'flexible-reshare-quoted-body',
        compressionSteps: ['full', 'clamped', 'hidden'] as CompressionStep[],
        minReadabilityHeight: 60,
        fallbackHeight: 120
      });
      if (hasLink) {
        config.push({
          id: 'flexible-reshare-link-body',
          compressionSteps: ['full', 'compact', 'hidden'] as CompressionStep[],
          minReadabilityHeight: 40,
          fallbackHeight: 80
        });
      }
      return config;
    }
    if (isYoutubeShort) {
      const arr: FlexibleElementConfig[] = [];
      if (!shouldUseBlurredBg) {
        arr.push({
          id: 'flexible-image',
          compressionSteps: ['full'] as CompressionStep[],
          minReadabilityHeight: 100,
          fallbackHeight: 200
        });
      }
      return arr;
    }
    if (isSpotifyEpisode || isSpotifyTrack || isYoutube || isGenericArticle) {
      return [];
    }
    if (isStandardPost) {
      const arr: FlexibleElementConfig[] = [];
      if (hasImage && !shouldUseBlurredBg) {
        arr.push({
          id: 'flexible-image',
          compressionSteps: ['full', 'pill', 'hidden'] as CompressionStep[],
          minReadabilityHeight: 100,
          fallbackHeight: 200
        });
      }
      return arr;
    }
    if (isVoicePost) {
      const arr: FlexibleElementConfig[] = [];
      const hasAttachedImage = post.media && post.media.length > 0;
      if (hasAttachedImage && !shouldUseBlurredBg) {
        arr.push({
          id: 'flexible-image',
          compressionSteps: ['full', 'pill', 'hidden'] as CompressionStep[],
          minReadabilityHeight: 100,
          fallbackHeight: 200
        });
      }
      return arr;
    }
    if (isChallengePost) {
      const arr: FlexibleElementConfig[] = [];
      const hasAttachedImage = post.media && post.media.length > 0;
      if (hasAttachedImage && !shouldUseBlurredBg) {
        arr.push({
          id: 'flexible-image',
          compressionSteps: ['full', 'pill', 'hidden'] as CompressionStep[],
          minReadabilityHeight: 100,
          fallbackHeight: 200
        });
      }
      return arr;
    }
    if (isLinkedIn || isTwitter) {
      return [];
    }
    if (isInstagramReel) {
      const config: FlexibleElementConfig[] = [];
      if (!shouldUseBlurredBg) {
        config.push({
          id: 'flexible-image',
          compressionSteps: ['full', 'compact', 'hidden'] as CompressionStep[],
          minReadabilityHeight: 45,
          fallbackHeight: 200
        });
      }
      return config;
    }
    if (isIntentPost) {
      return [];
    }
    return [];
  }, [isSpotifyEpisode, isSpotifyTrack, isYoutube, isYoutubeShort, isGenericArticle, isStandardPost, isInstagramReel, isIntentPost, isVoicePost, isChallengePost, isLinkedIn, isTwitter, hasImage, post.media, shouldUseBlurredBg, useStackLayout]);

  const priorityConfig = useMemo(() => {
    if (useStackLayout) {
      const priority: string[] = [];
      if (hasLink) {
        priority.push('flexible-reshare-link-body');
      }
      priority.push('flexible-reshare-quoted-body');
      return priority;
    }
    if (isStandardPost) {
      return (hasImage && !shouldUseBlurredBg) ? ['flexible-image'] : [];
    }
    if (isVoicePost || isChallengePost) {
      const hasAttachedImage = post.media && post.media.length > 0;
      return (hasAttachedImage && !shouldUseBlurredBg) ? ['flexible-image'] : [];
    }
    if (isInstagramReel || isYoutubeShort) {
      return !shouldUseBlurredBg ? ['flexible-image'] : [];
    }
    return [];
  }, [isSpotifyEpisode, isSpotifyTrack, isYoutube, isYoutubeShort, isGenericArticle, isStandardPost, isInstagramReel, isIntentPost, isVoicePost, isChallengePost, isLinkedIn, isTwitter, hasImage, post.media, shouldUseBlurredBg, useStackLayout]);

  const {
    status: layoutStatus,
    essentialStates,
    flexiblesStatus,
    showDrawerCta,
    emergencyScroll,
    isCaptionTruncated,
    registerRef,
    headerRef,
    badgeRef,
    midRef,
    bottomRef,
    layoutMode,
    bodyLineClamp,
    showApprofondisci,
    titleRef,
    bodyRef,
    mediaRef,
    slotBottomRef,
    subBarRef
  } = useDynamicCardLayout({
    availableHeight: (isInstagramReel || isYoutube || isLinkedIn || isTwitter) 
      ? availableHeight - 75 
      : availableHeight,
    essentials: essentialsConfig,
    flexibles: flexiblesConfig,
    compressionPriority: priorityConfig,
    postId: post.id,
    enabled: isNearActive,
    cacheKeyExtra: `${post.title || ''}_${post.content || ''}_${post.media?.length || 0}_${articlePreview?.image || ''}`
  });

  const tweetEmbedStep = useStackLayout 
    ? flexiblesStatus['flexible-reshare-link-body']?.step 
    : essentialStates['essential-tweet-embed'];
  const linkedinEmbedStep = useStackLayout 
    ? flexiblesStatus['flexible-reshare-link-body']?.step 
    : essentialStates['essential-linkedin-embed'];
  const youtubeEmbedStep = useStackLayout 
    ? (flexiblesStatus['flexible-reshare-link-body']?.step === 'compact' ? 'compact' : (flexiblesStatus['flexible-reshare-link-body']?.step === 'hidden' ? 'hidden' : 'full'))
    : essentialStates['essential-youtube'];
  const spotifyEpisodeStep = useStackLayout 
    ? (flexiblesStatus['flexible-reshare-link-body']?.step === 'compact' ? 'pill' : (flexiblesStatus['flexible-reshare-link-body']?.step === 'hidden' ? 'hidden' : 'full'))
    : essentialStates['essential-spotify'];
  const spotifyTrackStep = useStackLayout 
    ? (flexiblesStatus['flexible-reshare-link-body']?.step === 'compact' ? 'pill' : (flexiblesStatus['flexible-reshare-link-body']?.step === 'hidden' ? 'hidden' : 'full'))
    : essentialStates['essential-spotify-song'];
  const articleStep = useStackLayout 
    ? (flexiblesStatus['flexible-reshare-link-body']?.step === 'compact' ? 'compact' : (flexiblesStatus['flexible-reshare-link-body']?.step === 'hidden' ? 'hidden' : 'full'))
    : essentialStates['essential-article'];

  // DOM checks for text truncation delegate to useDynamicCardLayout
  const bodyTextRef = useRef<HTMLParagraphElement | HTMLDivElement | null>(null);
  const captionTextRef = useRef<HTMLParagraphElement | HTMLDivElement | null>(null);

  const isReshareCompressed = useStackLayout && (
    (flexiblesStatus['flexible-reshare-comment'] && flexiblesStatus['flexible-reshare-comment'].step !== 'full') ||
    (flexiblesStatus['flexible-reshare-quoted-body'] && flexiblesStatus['flexible-reshare-quoted-body'].step !== 'full') ||
    (flexiblesStatus['flexible-reshare-link-body'] && flexiblesStatus['flexible-reshare-link-body'].step !== 'full')
  );

  const shouldShowApprofondisci = showApprofondisci || isCaptionTruncated || isReshareCompressed;

  // Update lazy mount refs (placed here to avoid TDZ for state variables declared after the refs)
  if (showShareSheet) hasMountedShare.current = true;
  if (showPeoplePicker) hasMountedPeople.current = true;
  if (showMediaExpandedSheet) hasMountedMediaExpand.current = true;
  if (showFullText) hasMountedFullText.current = true;
  if (showFullCaption) hasMountedFullCaption.current = true;
  if (showReactionsSheet) hasMountedReactions.current = true;
  if (showReportDialog) hasMountedReport.current = true;
  if (showAdminRemoveDialog) hasMountedAdmin.current = true;
  if (showReactionPicker) hasMountedReactionPicker.current = true;
  if (showChallengeFlow) hasMountedChallenge.current = true;

  const getAmbientProps = (): {
    media?: { src: string; kind: 'reel-short' | 'photo-user' | 'og-image' | 'thumbnail' };
    category?: string;
    preset?: 'auto' | 'editorial' | 'spotify';
    spotifyTrackInfo?: { albumArtUrl: string; audioFeatures?: any };
  } => {
    // If it's a reshare/repost, inherit ambient from original source/parent
    if (quotedPost) {
      const src = originalSource || quotedPost;
      
      // 1. Is the original post "Il Punto" (Editorial)?
      const srcSharedUrl = src.url !== undefined ? src.url : (src as any).shared_url;
      const isSrcEditorial = srcSharedUrl?.startsWith('focus://');
      if (isSrcEditorial) {
        return { preset: 'editorial' };
      }

      // 2. Is the original post Spotify?
      const isSrcSpotify = srcSharedUrl?.includes('spotify.com');
      const isSrcSpotifyEpisode = isSrcSpotify && (srcSharedUrl?.includes('/episode/') || srcSharedUrl?.includes('/show/'));
      if (isSrcSpotify && !isSrcSpotifyEpisode) {
        // spotify track
        const artUrl = src.image !== undefined ? src.image : (src as any).preview_img;
        return {
          preset: 'spotify',
          spotifyTrackInfo: {
            albumArtUrl: artUrl || '',
            audioFeatures: (src as any).articlePreview?.audioFeatures
          }
        };
      }
      if (isSrcSpotifyEpisode) {
        // spotify episode: preset='spotify' if podcast artwork exists, otherwise category
        const artUrl = src.image !== undefined ? src.image : (src as any).preview_img;
        if (artUrl) {
          return {
            preset: 'spotify',
            spotifyTrackInfo: { albumArtUrl: artUrl }
          };
        } else {
          const cat = src.category !== undefined ? src.category : (src as any).category;
          return { category: getCategoryColor(cat) };
        }
      }

      // 3. Does original post have media?
      const srcMediaUrl = src.media?.[0]?.url || (src.image !== undefined ? src.image : (src as any).preview_img);
      const srcPostType = src.postType !== undefined ? src.postType : (src as any).post_type;
      const srcCat = src.category !== undefined ? src.category : (src as any).category;
      const fallbackCategory = getCategoryColor(srcCat);
      
      if (srcMediaUrl) {
        if (srcPostType === 'instagram_reel') {
          return { media: { src: generateAmbientUrl(srcMediaUrl), kind: 'reel-short' }, category: fallbackCategory };
        }
        
        // YouTube short?
        const isSrcYoutubeShort = srcSharedUrl && srcSharedUrl.includes('/shorts/') && (srcSharedUrl.includes('youtube.com') || srcSharedUrl.includes('youtu.be'));
        if (isSrcYoutubeShort) {
          return { media: { src: generateAmbientUrl(srcMediaUrl), kind: 'reel-short' }, category: fallbackCategory };
        }
        
        // Vertical video upload?
        const isSrcVideo = src.media?.[0]?.type === 'video' || (src as any).post_media?.[0]?.media?.type === 'video';
        if (srcPostType === 'voice' || srcPostType === 'challenge' || isSrcVideo) {
          const isVoiceOrVertical = srcPostType === 'voice' || isSrcVideo;
          if (isVoiceOrVertical) {
            return { media: { src: generateAmbientUrl(srcMediaUrl), kind: 'reel-short' }, category: fallbackCategory };
          }
        }
        
        // Is it user uploaded photo/carousel?
        const hasSrcUserMedia = src.media && src.media.length > 0;
        if (hasSrcUserMedia && !srcSharedUrl) {
          return { media: { src: generateAmbientUrl(srcMediaUrl), kind: 'photo-user' }, category: fallbackCategory };
        }
        
        // YouTube std?
        const isSrcYoutube = srcSharedUrl && (srcSharedUrl.includes('youtube.com') || srcSharedUrl.includes('youtu.be'));
        if (isSrcYoutube) {
          return { media: { src: generateAmbientUrl(srcMediaUrl), kind: 'thumbnail' }, category: fallbackCategory };
        }

        // Twitter / LinkedIn / standard article with preview image:
        const isSrcTwitter = srcSharedUrl?.includes('x.com') || srcSharedUrl?.includes('twitter.com');
        const isSrcLinkedIn = srcSharedUrl?.includes('linkedin.com');
        if (isSrcTwitter || isSrcLinkedIn) {
          return { media: { src: generateAmbientUrl(srcMediaUrl), kind: 'og-image' }, category: fallbackCategory };
        }

        // Standard OG image:
        return { media: { src: generateAmbientUrl(srcMediaUrl), kind: 'og-image' }, category: fallbackCategory };
      }

      // 4. No media in original -> use its category
      return { category: fallbackCategory };
    }

    // --- Post non ricondiviso (Post standard) ---

    // 1. Il Punto (Editorial)
    if (isEditorialFocus) {
      return { preset: 'editorial' };
    }

    // 2. Spotify Track
    if (isSpotifyTrack) {
      return {
        preset: 'spotify',
        spotifyTrackInfo: {
          albumArtUrl: generateAmbientUrl(articlePreview?.image || post.preview_img || ''),
          audioFeatures: articlePreview?.audioFeatures
        }
      };
    }

    // 3. Spotify Episode
    if (isSpotifyEpisode) {
      const artUrl = articlePreview?.image || post.preview_img;
      if (artUrl) {
        return {
          preset: 'spotify',
          spotifyTrackInfo: { albumArtUrl: generateAmbientUrl(artUrl) }
        };
      } else {
        return { category: getCategoryColor(post.category) };
      }
    }

    // 4. Vertical media (Instagram Reel, YouTube Short, User uploaded vertical video/photo)
    if (shouldUseBlurredBg && backgroundImageUrl) {
      return {
        media: {
          src: generateAmbientUrl(backgroundImageUrl),
          kind: 'reel-short'
        },
        category: getCategoryColor(post.category)
      };
    }

    // 5. Media Only post (User photos/videos upload, no link)
    if (isMediaOnlyPost && mediaUrl && !isAudioPost) {
      return {
        media: {
          src: generateAmbientUrl(mediaUrl),
          kind: 'photo-user'
        },
        category: getCategoryColor(post.category)
      };
    }

    // 6. Voicecast / Voice Post with artwork
    if (isVoicePost && !isChallengePost) {
      const artworkSrc = post.media?.[0]?.url || post.preview_img;
      if (artworkSrc) {
        return {
          media: {
            src: generateAmbientUrl(artworkSrc),
            kind: 'photo-user'
          },
          category: getCategoryColor(post.category)
        };
      } else {
        return { category: getCategoryColor(post.category) };
      }
    }

    // 7. Youtube Std / Article / Embed with preview image
    const stdImageUrl = articlePreview?.image || post.preview_img || post.media?.[0]?.url;
    if (stdImageUrl && hasLink) {
      if (isYoutube) {
        return {
          media: {
            src: generateAmbientUrl(stdImageUrl),
            kind: 'thumbnail'
          },
          category: getCategoryColor(post.category)
        };
      }
      
      return {
        media: {
          src: generateAmbientUrl(stdImageUrl),
          kind: 'og-image'
        },
        category: getCategoryColor(post.category)
      };
    }

    // 8. Text Only / Poll / Challenge / Fallback (No Media)
    return { category: getCategoryColor(post.category) };
  };

  return (
    <>
      <div
        ref={registerRef('card-container')}
        className="h-[100dvh] w-full relative overflow-hidden bg-immersive transition-colors duration-500"
        style={{ isolation: 'isolate', contain: 'layout style size' }}
        onClick={handleDoubleTap}
      >
        {/* Global card scrim (NoParrot Feed UI Spec v1 §2.2) */}
        <div className="card-scrim" aria-hidden="true" />
        <AmbientLayer {...getAmbientProps()} isActive={isActive} />
        
        {/* Urban texture overlay - applied to all backgrounds (GPU-friendly static PNG) */}
        <div className="absolute inset-0 z-[1] opacity-[0.015] pointer-events-none urban-noise-overlay" />

        {/* Cinematic Fade Overlay - seamless card-to-card transitions */}
        <div
          className="absolute inset-0 z-[2] pointer-events-none cinematic-fade-overlay"
        />

        {/* Heart animation */}
        <AnimatedHeart
          isVisible={showHeartAnimation}
          onAnimationComplete={() => setShowHeartAnimation(false)}
        />

        {/* Content Layer */}
        <div className="relative z-10 w-full h-full pointer-events-none">

          <div
            className="absolute top-0 left-0 right-0 z-40 pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
              height: 'calc(env(safe-area-inset-top) + 180px)'
            }}
          />

          <div
            className="absolute bottom-0 left-0 right-0 z-40 pointer-events-none"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
              height: 'calc(4rem + env(safe-area-inset-bottom) + 120px)'
            }}
          />

          <CardShell>
            {/* [Rail 1] HeaderRail: Fixed top overlay with gradient fade */}
            <CardShell.Header ref={headerRef}>
              <div className="flex justify-between items-start w-full pb-5">
              <div
                className="flex items-center gap-3 cursor-pointer relative z-[60] min-w-0 pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  navigate(`/profile/${post.author.id}`);
                }}
              >
                <div className="w-10 h-10 rounded-full border border-white/20 bg-white/10 overflow-hidden flex-shrink-0">
                  {getAvatarContent()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-slate-900 dark:text-white font-bold text-sm truncate">
                    {post.author.full_name || getDisplayUsername(post.author.username)}
                  </span>
                  <span className="text-slate-500 dark:text-gray-400 text-xs truncate flex items-center gap-1.5">
                    {timeAgo}
                  </span>
                </div>
              </div>
                


            {/* Menu */}
            {isOwnPost ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-black/20 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white pointer-events-auto">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {canEdit && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit?.(post);
                      }}
                      className="text-foreground focus:text-foreground mb-1"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Modifica
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePost.mutate(post.id, {
                        onSuccess: () => {
                          toast.success('Post eliminato');
                          onRemove?.(post.id);
                        },
                        onError: () => {
                          toast.error(TOASTS.ERROR_GENERIC.description);
                        }
                      });
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Elimina post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-black/20 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white pointer-events-auto">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowReportDialog(true);
                    }}
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    Segnala contenuto
                  </DropdownMenuItem>
                  {isStaff && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAdminRemoveDialog(true);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <ShieldAlert className="w-4 h-4 mr-2" />
                      Rimuovi contenuto (Admin)
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            </div>
          </CardShell.Header>

          <CardShell.Badge ref={badgeRef}>
                {/* 1. Voce AI Badge (if AI profile) */}
                {post.author.is_ai_institutional && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="flex-shrink-0 transition-all duration-200 active:scale-[0.97] cursor-pointer"
                      >
                        <UnifiedBadge kind="ai-voice">✦ Voce AI</UnifiedBadge>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Voce AI</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 text-sm text-muted-foreground">
                        <p>
                          Questo profilo è una <strong className="text-foreground">Voce AI di NoParrot</strong>: un'identità editoriale alimentata da intelligenza artificiale che seleziona, approfondisce e commenta contenuti nel proprio ambito tematico.
                        </p>
                        <p>
                          <strong className="text-foreground">Come funziona:</strong> ogni Voce AI ha una personalità, un tono e un'area di competenza definiti. I post vengono generati a partire da fonti verificabili — articoli, podcast, report — che vengono letti e analizzati integralmente prima della pubblicazione. Le fonti sono sempre linkate e consultabili.
                        </p>
                        <p>
                          <strong className="text-foreground">Cosa non è:</strong> le Voci AI non fanno fact-checking, non producono giornalismo e non sostituiscono la lettura delle fonti originali. Sono spunti editoriali per stimolare la curiosità e il confronto.
                        </p>
                        <p className="text-xs pt-2 border-t border-border text-muted-foreground">
                          Il Comprehension Gate si applica anche ai contenuti delle Voci AI: per commentare o ricondividere, devi prima dimostrare di aver compreso.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                {/* 2. Voicecast Badge (if Voice Post) */}
                {!useStackLayout && isVoicePost && (
                  <UnifiedBadge kind="voicecast">🎙 Voicecast</UnifiedBadge>
                )}

                {/* 3. Challenge Badge (if Challenge Post) */}
                {!useStackLayout && isChallengePost && (
                  <div className="flex items-center gap-2">
                    <UnifiedBadge kind="challenge">⚡ Challenge</UnifiedBadge>
                    {challengeCountdown && (
                      <span style={{ 
                        color: isChallengeExpired ? 'rgba(241,245,249,0.4)' : isChallengeUrgent ? '#FF8A3D' : 'rgba(241,245,249,0.4)', 
                        fontSize: 13,
                        fontWeight: isChallengeUrgent ? 700 : 500,
                        marginLeft: 4
                      }}>
                        · {isChallengeExpired ? '⏱ Chiusa' : `⏱ Scade tra ${challengeCountdown}`}
                      </span>
                    )}
                  </div>
                )}

                {/* 4. Spotify / Trust Score / Category Badges */}
                {!post.author.is_ai_institutional && (
                  <>
                    {hasLink && isSpotifyTrack && articlePreview?.popularity !== undefined && (
                      <PulseBadge
                        popularity={articlePreview.popularity}
                        size="sm"
                      />
                    )}
                    
                    {hasLink && (post.is_intent || (post as any).verified_by === 'user_intent') && !post.shared_url?.startsWith('focus://') && (
                      <div className="flex-shrink-0">
                        <UnanalyzableBadge />
                      </div>
                    )}
                    
                    {hasLink && displayTrustScore && !post.shared_url?.startsWith('focus://') && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all flex-shrink-0 outline-none"
                            style={{
                              color: displayTrustScore.band === 'ALTO' ? '#FFD464' :
                                     displayTrustScore.band === 'MEDIO' ? '#F59E0B' :
                                     '#E41E52'
                            }}
                          >
                            <ShieldCheck className="w-[26px] h-[26px] flex-shrink-0" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Trust Score</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 text-sm text-muted-foreground">
                            <p>
                              Il Trust Score indica il livello di affidabilità delle fonti citate,
                              <strong className="text-foreground"> non la verità o la qualità del contenuto</strong>.
                            </p>
                            <p>È calcolato automaticamente e può contenere errori.</p>
                            {displayTrustScore.reasons && displayTrustScore.reasons.length > 0 && (
                              <div className="pt-3 border-t border-border">
                                <p className="font-medium text-foreground mb-2">Perché questo punteggio:</p>
                                <ul className="space-y-1.5">
                                  {displayTrustScore.reasons.map((reason: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-primary mt-0.5">•</span>
                                      <span>{reason}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <p className="text-xs pt-2 border-t border-border text-muted-foreground">
                              Valuta la qualità delle fonti e la coerenza col contenuto. Non è fact-checking.
                            </p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </>
                )}
              </CardShell.Badge>

              <CardShell.Mid ref={midRef} layoutMode={layoutMode}>
                <div 
                  className="w-full flex flex-col relative z-[1] pointer-events-auto flex-1 min-h-0"
                  style={{ maxHeight: `${availableHeight}px` }}
                >


              {/* Voice Post Body (non-challenge) layout component */}
              {!useStackLayout && isVoicePost && activeVoicePost && (
                <VoiceCastBody
                  postId={post.id}
                  emergencyScroll={emergencyScroll || false}
                  voiceTitle={voiceTitle}
                  voiceContent={voiceContent || ''}
                  bodyLineClamp={bodyLineClamp}
                  shouldShowApprofondisci={shouldShowApprofondisci}
                  hasMedia={hasMedia}
                  media={post.media}
                  shouldUseBlurredBg={shouldUseBlurredBg}
                  flexibleImageStep={flexiblesStatus['flexible-image']?.step}
                  flexibleImageHeight={flexiblesStatus['flexible-image']?.height}
                  isVideoMedia={isVideoMedia}
                  mediaUrl={mediaUrl}
                  carouselIndex={carouselIndex}
                  isActive={isActive}
                  essentialVoicePlayerState={essentialStates['essential-voice-player']}
                  audioUrl={activeVoicePost?.audio_url || ''}
                  durationSeconds={activeVoicePost?.duration_seconds || 0}
                  transcriptStatus={activeVoicePost?.transcript_status}
                  transcript={activeVoicePost?.transcript}
                  openFullTextDrawer={openFullTextDrawer}
                  registerRef={registerRef}
                  setSelectedMediaIndex={setSelectedMediaIndex}
                  setCarouselIndex={setCarouselIndex}
                  bodyRef={bodyRef}
                  bodyTextRef={bodyTextRef}
                  mediaRef={mediaRef}
                  slotBottomRef={slotBottomRef}
                />
              )}

              {/* Challenge Post Body inline layout */}
              {!useStackLayout && isChallengePost && activeVoicePost && post.challenge && (
                <div 
                  className={cn(
                    "w-full flex flex-col pt-2 pb-16 flex-1 min-h-0 justify-start",
                    emergencyScroll && "overflow-y-auto"
                  )}
                >
                  {/* Header Essenziale: Badge + Title */}
                  <div ref={registerRef('essential-title')} className="w-full flex flex-col flex-shrink-0">


                    {/* Title se esiste */}
                    {challengeTitle && challengeTitle.trim().length > 0 && (
                      <ClampedTitle
                        as="h2"
                        text={challengeTitle}
                        maxLines={3}
                        className="uppercase mb-3 flex-shrink-0"
                        style={{
                          fontFamily: 'Impact, sans-serif',
                          fontSize: 'clamp(30px, 8vw, 42px)',
                          lineHeight: 0.92,
                          letterSpacing: '-0.02em',
                          color: '#FFFFFF',
                          textAlign: 'left',
                        }}
                      />
                    )}
                  </div>

                  {/* Description flessibile se esiste */}
                  {challengeContent && challengeContent.trim().length > 0 && (
                    <div 
                      ref={(el) => {
                        (bodyRef as any).current = el;
                        bodyTextRef.current = el;
                      }} 
                      className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6] text-left flex-shrink-0"
                      style={{ 
                        fontFamily: 'Inter, sans-serif', 
                        lineHeight: 1.55,
                        display: '-webkit-box',
                        WebkitLineClamp: bodyLineClamp,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      <MentionText content={challengeContent} />
                    </div>
                  )}

                  {/* Approfondisci subito dopo description (se non c'è description, dopo title) */}
                  {shouldShowApprofondisci && (
                    <div className="flex-shrink-0 mt-2 mb-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); openFullTextDrawer('description'); }}
                        className="text-sm text-primary font-semibold hover:underline block"
                      >
                        Approfondisci
                      </button>
                    </div>
                  )}

                  {/* Image/Media flessibile */}
                  {hasMedia && post.media && post.media.length > 0 && !shouldUseBlurredBg && (
                    <>
                      {flexiblesStatus['flexible-image']?.step === 'full' && (
                        <div 
                          ref={(node) => {
                            registerRef('flexible-image')(node);
                            (mediaRef as any).current = node;
                          }}
                          className="relative flex-shrink-0 w-full flex items-center justify-center overflow-hidden mb-3 rounded-xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)] cursor-pointer"
                          style={{ height: `${flexiblesStatus['flexible-image'].height}px` }}
                          onClick={post.media.length === 1 ? (e) => {
                            e.stopPropagation();
                            setSelectedMediaIndex(0);
                          } : undefined}
                        >
                          {downscaledPostMedia.length === 1 ? (
                            isVideoMedia ? (
                              <div className="relative w-full h-full flex items-center justify-center">
                                <img
                                  src={downscaledPostMedia[0]?.thumbnail_url || downscaledMediaUrl}
                                  alt=""
                                  width={(post.media?.[0] as any)?.width || 1080}
                                  height={(post.media?.[0] as any)?.height || 1080}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-contain"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-white p-3 rounded-full shadow-lg">
                                    <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <img
                                src={downscaledMediaUrl}
                                alt=""
                                width={(post.media?.[0] as any)?.width || 1080}
                                height={(post.media?.[0] as any)?.height || 1080}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-contain"
                              />
                            )
                          ) : (
                            <MediaGallery
                              media={downscaledPostMedia}
                              onClick={(_, index) => setSelectedMediaIndex(index)}
                              initialIndex={carouselIndex}
                              onIndexChange={setCarouselIndex}
                              className="h-full w-full object-contain"
                              isActive={isActive}
                            />
                          )}
                        </div>
                      )}
                      
                      {flexiblesStatus['flexible-image']?.step === 'pill' && (
                        <div 
                          ref={(node) => {
                            registerRef('flexible-image')(node);
                            (mediaRef as any).current = node;
                          }}
                          className="flex-shrink-0 mb-3" 
                          style={{ height: '36px' }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMediaIndex(0);
                            }}
                            className="inline-flex h-9 items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/10 px-4 rounded-full text-white text-xs font-bold"
                          >
                            <span>📎 Vedi {isVideoMedia ? 'video' : 'immagine'}</span>
                          </button>
                        </div>
                      )}

                      {flexiblesStatus['flexible-image']?.step === 'hidden' && (
                        <div 
                          ref={(node) => {
                            registerRef('flexible-image')(node);
                            (mediaRef as any).current = node;
                          }}
                          style={{ height: 0, overflow: 'hidden' }} 
                        />
                      )}
                    </>
                  )}

                  {/* Player, polarization, CTAs inside slot-bottom */}
                  <div className="slot-bottom" ref={slotBottomRef}>
                    {/* Player audio compact (essential-challenge-player) */}
                    <div ref={registerRef('essential-challenge-player')} className="w-full mt-auto flex-shrink-0">
                      {isActive ? (
                        <VoicePlayer 
                          compact 
                          audioUrl={activeVoicePost?.audio_url || ''}
                          durationSeconds={activeVoicePost?.duration_seconds || 0}
                          transcript={activeVoicePost?.transcript}
                          transcriptStatus={activeVoicePost?.transcript_status as any}
                          accentColor="#E41E52"
                          onShowTranscript={() => openFullTextDrawer('transcript')}
                        />
                      ) : (
                        <div className="w-full h-[36px] rounded-lg bg-white/5 border border-white/10 animate-pulse flex items-center justify-center text-[10px] text-white/30">
                          Caricamento player vocale...
                        </div>
                      )}
                    </div>

                    {/* Polarization bar (essential-polarization) */}
                    <div ref={registerRef('essential-polarization')} className="mt-4 px-1 flex-shrink-0" style={{ height: '80px' }}>
                      <div className="flex items-end justify-between mb-1.5" style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        <span style={{ color: '#0A7AFF' }}>
                          A FAVORE ({Math.round(((post.challenge.votes_for || 0) / Math.max(1, (post.challenge.votes_for || 0) + (post.challenge.votes_against || 0))) * 100)}%)
                        </span>
                        <span style={{ color: '#FFD464' }}>
                          CONTRO ({Math.round(((post.challenge.votes_against || 0) / Math.max(1, (post.challenge.votes_for || 0) + (post.challenge.votes_against || 0))) * 100)}%)
                        </span>
                      </div>
                      <div className="flex overflow-hidden" style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}>
                        <div style={{ width: `${Math.round(((post.challenge.votes_for || 0) / Math.max(1, (post.challenge.votes_for || 0) + (post.challenge.votes_against || 0))) * 100)}%`, background: 'linear-gradient(90deg, #0A7AFF, #3D9AFF)', borderRadius: '4px 0 0 4px' }} />
                        <div style={{ width: `${Math.round(((post.challenge.votes_against || 0) / Math.max(1, (post.challenge.votes_for || 0) + (post.challenge.votes_against || 0))) * 100)}%`, background: 'linear-gradient(90deg, #F5C842, #FFD464)', borderRadius: '0 4px 4px 0' }} />
                      </div>
                      
                      {/* Challenge Responses Button */}
                      {challengeResponses.length > 0 && (
                        <div className="mt-2 flex justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setChallengeDrawerOpen(true);
                            }}
                            className="flex items-center justify-center gap-1.5 py-1 px-4 rounded-full text-xs font-semibold text-slate-300 hover:text-white transition-all hover:bg-white/5"
                          >
                            <Zap className="w-3 h-3 text-[#E41E52]" />
                            Vedi {challengeResponses.length} rispost{challengeResponses.length === 1 ? 'a' : 'e'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* CTA "Accetta la sfida" (essential-cta-accept) */}
                    {(() => {
                      const isExpired = post.challenge?.status === 'expired' || post.challenge?.status === 'closed' || new Date(post.challenge?.expires_at || '') < new Date();
                      const isAuthor = user?.id === post.author.id;
                      const hasResponded = challengeResponses.some(r => r.user_id === user?.id);
                      const isDisabled = isExpired || hasResponded;

                      return !isAuthor ? (
                        <button
                          ref={registerRef('essential-cta-accept')}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isDisabled) return;
                            // Trigger challenge respond flow
                            const handleRespond = async () => {
                              const transcriptText = activeVoicePost?.transcript || post.content;
                              const wordCount = getWordCount(transcriptText);
                              const questionCount = getQuestionCountWithoutSource(wordCount);
                              if (questionCount === 0) {
                                setShowChallengeFlow(true);
                                return;
                              }
                              setShowAnalysisOverlay(true);
                              try {
                                const result = await generateQA({
                                  contentId: post.id,
                                  title: post.author.full_name || post.author.username,
                                  summary: transcriptText,
                                  userText: transcriptText || '',
                                  questionCount,
                                });
                                setShowAnalysisOverlay(false);
                                if (result.insufficient_context) {
                                  toast.info("Trascrizione non sufficiente per il test.");
                                  setShowChallengeFlow(true);
                                    return;
                                 }
                                 if (!result || result.error || !result.questions?.length) {
                                   toast.error(result?.error || "Errore generico");
                                   return;
                                 }
                                 setQuizData({ qaId: result.qaId, questions: result.questions, sourceUrl: `post://${post.id}`, onChallengeRespond: true });
                                 setShowQuiz(true);
                               } catch {
                                 setShowAnalysisOverlay(false);
                                 toast.error("Errore generico");
                               }
                             };
                             handleRespond();
                           }}
                           disabled={isDisabled}
                           className={cn(
                             "relative w-full mt-2 rounded-full font-bold text-sm tracking-wide overflow-hidden transition-all flex-shrink-0 flex items-center justify-center",
                             isDisabled ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-[0.98]"
                           )}
                           style={{
                             height: '48px',
                             background: isDisabled ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #E41E52, #FF6B35)',
                             color: isDisabled ? 'rgba(255,255,255,0.3)' : 'white',
                             border: isDisabled ? '1px solid rgba(255,255,255,0.1)' : 'none',
                           }}
                         >
                           {!isDisabled && (
                             <span className="absolute inset-0" style={{
                               background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                               backgroundSize: '200% 100%',
                               animation: 'shimmer 2.5s ease-in-out infinite',
                             }} />
                           )}
                           <span className="relative z-10">
                             {hasResponded ? '✓ Hai già risposto' : isExpired ? '⚡ Sfida chiusa' : '⚡ Accetta la sfida'}
                           </span>
                         </button>
                       ) : null;
                     })()}
                  </div>

                  {/* Response Drawer */}
                  <Drawer open={challengeDrawerOpen} onOpenChange={setChallengeDrawerOpen}>
                    <DrawerContent className="max-h-[85vh]">
                      <DrawerHeader>
                        <DrawerTitle className="flex items-center justify-center gap-2">
                          <Zap className="w-5 h-5" style={{ color: '#E41E52' }} />
                          {challengeResponses.length} rispost{challengeResponses.length === 1 ? 'a' : 'e'} alla challenge
                        </DrawerTitle>
                      </DrawerHeader>
                      <ScrollArea className="flex-1 overflow-auto px-4 pb-6" style={{ maxHeight: 'calc(85vh - 80px)' }}>
                        <div className="space-y-3">
                          {challengeResponses.map((resp) => (
                            <div
                              key={resp.id}
                              className="rounded-xl p-4"
                              style={{
                                background: 'hsl(var(--muted) / 0.5)',
                                border: '1px solid hsl(var(--border))',
                              }}
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <Avatar className="w-7 h-7">
                                  <AvatarImage src={getAvatarImageUrl(resp.user.avatar_url) || undefined} />
                                  <AvatarFallback className="text-[10px] bg-muted">
                                    {(resp.user.full_name || resp.user.username).charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-semibold text-foreground">
                                  {resp.user.full_name || resp.user.username}
                                </span>
                                <span
                                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ml-auto"
                                  style={{
                                     background: resp.stance === 'for' ? 'rgba(10,122,255,0.15)' : 'rgba(255,212,100,0.15)',
                                     color: resp.stance === 'for' ? '#0A7AFF' : '#FFD464',
                                  }}
                                >
                                  {resp.stance === 'for' ? 'A favore' : 'Contro'}
                                </span>
                              </div>
                              <VoicePlayer
                                audioUrl={resp.voice_post.audio_url}
                                durationSeconds={resp.voice_post.duration_seconds}
                                waveformData={resp.voice_post.waveform_data}
                                transcript={resp.voice_post.transcript}
                                transcriptStatus={resp.voice_post.transcript_status as any}
                                accentColor={resp.stance === 'for' ? '#0A7AFF' : '#FFD464'}
                              />
                              <div className="flex items-center justify-between mt-3">
                                <span className="text-xs text-muted-foreground">
                                  {resp.argument_votes} vot{resp.argument_votes === 1 ? 'o' : 'i'}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (userVote?.challenge_response_id === resp.id) {
                                      removeVote();
                                    } else if (!userVote) {
                                      voteForResponse(resp.id);
                                    }
                                  }}
                                  disabled={!!userVote && userVote.challenge_response_id !== resp.id}
                                  className={cn(
                                    "text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5",
                                    userVote?.challenge_response_id === resp.id
                                      ? "bg-primary/20 text-primary hover:bg-destructive/20 hover:text-destructive"
                                      : userVote
                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                        : "bg-muted hover:bg-accent text-foreground"
                                  )}
                                >
                                  {userVote?.challenge_response_id === resp.id ? (
                                    <span className="flex items-center gap-1">
                                      <span className="group-hover:hidden">✓ Votato</span>
                                      <span className="hidden group-hover:inline">✗ Rimuovi voto</span>
                                    </span>
                                  ) : (
                                    '🏆 Miglior argomento'
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </DrawerContent>
                  </Drawer>
                </div>
              )}

              {/* Stack Layout: User comment first - Plain text for standard */}
              {useStackLayout && !isAudioPost && !isChallengePost && (post.content || post.title) && post.content !== post.shared_title && (
                <div className="mb-1 flex flex-col gap-1 w-full flex-shrink-0">
                  {/* Title */}
                  {post.title && post.title.trim().length > 0 && (
                    <ClampedTitle
                      as="h2"
                      text={post.title}
                      maxLines={3}
                      className="uppercase mb-1"
                      style={{
                        fontFamily: 'Impact, sans-serif',
                        fontSize: 'clamp(30px, 8vw, 42px)',
                        lineHeight: 0.92,
                        letterSpacing: '-0.02em',
                        color: '#FFFFFF',
                        textAlign: 'left',
                      }}
                    />
                  )}
                  {post.content && post.content.trim().length > 0 && (
                    <>
                      {(!flexiblesStatus['flexible-reshare-comment'] || flexiblesStatus['flexible-reshare-comment'].step === 'full') && (
                        <div 
                          ref={(el) => { registerRef('flexible-reshare-comment')(el); bodyTextRef.current = el; }}
                          className={cn(
                            "whitespace-pre-wrap break-words",
                            post.title && post.title.trim().length > 0 ? "text-[14px] text-[#7A8FA6]" : "text-base sm:text-lg text-slate-600 dark:text-white/90 leading-snug tracking-wide"
                          )}
                          style={post.title && post.title.trim().length > 0 ? { fontFamily: 'Inter, sans-serif', lineHeight: 1.55, textAlign: 'left' } : {}}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}
                      {flexiblesStatus['flexible-reshare-comment']?.step === 'clamped' && (
                        <div 
                          ref={(el) => { registerRef('flexible-reshare-comment')(el); bodyTextRef.current = el; }}
                          className={cn(
                            "whitespace-pre-wrap break-words overflow-hidden",
                            post.title && post.title.trim().length > 0 ? "text-[14px] text-[#7A8FA6]" : "text-base sm:text-lg text-slate-600 dark:text-white/90 leading-snug tracking-wide"
                          )}
                          style={{
                            ...(post.title && post.title.trim().length > 0 ? { fontFamily: 'Inter, sans-serif', lineHeight: 1.55, textAlign: 'left' } : {}),
                            height: `${flexiblesStatus['flexible-reshare-comment'].height}px`,
                            display: '-webkit-box',
                            WebkitLineClamp: Math.max(1, Math.floor(flexiblesStatus['flexible-reshare-comment'].height / (post.title && post.title.trim().length > 0 ? 22 : 26))),
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}
                      {flexiblesStatus['flexible-reshare-comment']?.step === 'hidden' && (
                        <div ref={registerRef('flexible-reshare-comment')} style={{ height: 0, overflow: 'hidden' }} />
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Intent Post (non-stack): Quote Block style for posts with is_intent flag */}
              {!useStackLayout && post.is_intent && post.content && (
                <div className="flex flex-col w-full flex-shrink-0">
                  <div 
                    ref={(el) => {
                      (bodyRef as any).current = el;
                      bodyTextRef.current = el;
                    }}
                    className="border-l-4 border-primary/60 bg-card/10 px-3 sm:px-4 py-2 sm:py-3 rounded-r-lg mb-4 sm:mb-6 overflow-hidden"
                    style={{ 
                      display: '-webkit-box',
                      WebkitLineClamp: bodyLineClamp,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    <p className="text-base sm:text-lg font-normal text-slate-600 dark:text-white/90 leading-snug tracking-wide">
                      <MentionText content={post.content} />
                    </p>
                  </div>
                  {shouldShowApprofondisci && (
                    <div className="flex-shrink-0 mt-2 mb-3 text-left">
                      <button
                        onClick={(e) => { e.stopPropagation(); openFullTextDrawer('description'); }}
                        className="text-sm text-primary font-semibold hover:underline block"
                      >
                        Approfondisci
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Reshare indicator label — content shown via QuotedPostCard below */}
              {quotedPost && !isQuotedIntentPost && (
                <div className="mt-0.5 flex items-center gap-1.5 text-white/40">
                  <Repeat className="w-3 h-3" />
                  <span className="text-[11px] font-medium">ha condiviso</span>
                </div>
              )}

              {/* User Text Content - Show for link posts (if different from article title) - NON stack layout */}
              {/* User Text - Skip for intent posts (already rendered above) */}
              {!useStackLayout && ((shouldShowUserText) || (post.title && post.title.trim().length > 0)) && !post.is_intent && !isTextOnly && !isSpotifyEpisode && !isSpotifyTrack && !isGenericArticle && !isYoutube && !isLinkedIn && !isTwitter && !isInstagramReel && hasLink && (
                <div className="mb-4 flex-shrink-0 flex flex-col gap-1 z-10 relative">
                  {/* Title */}
                  {post.title && post.title.trim().length > 0 && (
                    <ClampedTitle
                      as="h2"
                      text={post.title}
                      maxLines={3}
                      className="uppercase mb-1"
                      style={{
                        fontFamily: 'Impact, sans-serif',
                        fontSize: 'clamp(30px, 8vw, 42px)',
                        lineHeight: 0.92,
                        letterSpacing: '-0.02em',
                        color: '#FFFFFF',
                        textAlign: 'left',
                      }}
                    />
                  )}
                  {/* Content */}
                  {shouldShowUserText && post.content && post.content.trim().length > 0 && renderBodyText(post.content, !!(post.title && post.title.trim().length > 0))}
                </div>
              )}

              {/* User Text for normal reshares (long quoted comment, no source): show current user's comment ABOVE the QuotedPostCard */}
              {!useStackLayout && quotedPost && !hasLink && (post.content || post.title) && (
                <div className="mb-6 flex flex-col gap-1 flex-shrink-0 relative z-10">
                  {/* Title */}
                  {post.title && post.title.trim().length > 0 && (
                    <ClampedTitle
                      as="h2"
                      text={post.title}
                      maxLines={3}
                      className="uppercase mb-1"
                      style={{
                        fontFamily: 'Impact, sans-serif',
                        fontSize: 'clamp(30px, 8vw, 42px)',
                        lineHeight: 0.92,
                        letterSpacing: '-0.02em',
                        color: '#FFFFFF',
                        textAlign: 'left',
                      }}
                    />
                  )}
                  {post.content && post.content.trim().length > 0 && renderBodyText(post.content, !!(post.title && post.title.trim().length > 0))}
                </div>
              )}

              {isStandardPost ? (
                <UserUploadEmbed
                  postTitle={post.title}
                  postContent={post.content}
                  postMedia={post.media}
                  normalizedMedias={normalizedMedias}
                  isNearActive={isNearActive}
                  isActive={isActive}
                  useStackLayout={useStackLayout}
                  emergencyScroll={emergencyScroll || false}
                  bodyLineClamp={bodyLineClamp}
                  shouldShowApprofondisci={shouldShowApprofondisci}
                  flexiblesStatus={flexiblesStatus}
                  onOpenFullText={openFullTextDrawer}
                  registerRef={registerRef}
                  onMediaTap={(index) => setSelectedMediaIndex(index)}
                  titleRef={(node) => {
                    registerRef('essential-title')(node);
                    if (titleRef) {
                      (titleRef as any).current = node;
                    }
                  }}
                  bodyRef={bodyRef}
                  bodyTextRef={bodyTextRef}
                  mediaRef={mediaRef}
                />
              ) : hasLink && isTwitter ? (
                <TwitterTweetEmbed
                  articlePreview={articlePreview}
                  isNearActive={isNearActive}
                  postTitle={post.title || undefined}
                  postContent={post.content || undefined}
                  sharedUrl={post.shared_url || undefined}
                  sharedTitle={post.shared_title || undefined}
                  previewImg={post.preview_img || undefined}
                  useStackLayout={useStackLayout}
                  emergencyScroll={emergencyScroll || false}
                  bodyLineClamp={bodyLineClamp}
                  shouldShowApprofondisci={shouldShowApprofondisci}
                  tweetEmbedStep={tweetEmbedStep || "full"}
                  flexiblesStatus={flexiblesStatus}
                  onOpenFullText={openFullTextDrawer}
                  registerRef={registerRef}
                  titleRef={titleRef}
                  bodyRef={bodyRef}
                  bodyTextRef={bodyTextRef}
                  slotBottomRef={slotBottomRef}
                />
              ) : hasLink && isLinkedIn ? (
                <LinkedInEmbedCard
                  articlePreview={articlePreview}
                  isNearActive={isNearActive}
                  postTitle={post.title || undefined}
                  postContent={post.content || undefined}
                  sharedUrl={post.shared_url || undefined}
                  sharedTitle={post.shared_title || undefined}
                  previewImg={post.preview_img || undefined}
                  useStackLayout={useStackLayout}
                  emergencyScroll={emergencyScroll || false}
                  bodyLineClamp={bodyLineClamp}
                  shouldShowApprofondisci={shouldShowApprofondisci}
                  linkedinEmbedStep={linkedinEmbedStep || "full"}
                  flexiblesStatus={flexiblesStatus}
                  onOpenFullText={openFullTextDrawer}
                  registerRef={registerRef}
                  titleRef={titleRef}
                  bodyRef={bodyRef}
                  bodyTextRef={bodyTextRef}
                  slotBottomRef={slotBottomRef}
                />
              ) : hasLink && isYoutubeShort ? (
                <YouTubeShortEmbed
                  isNearActive={isNearActive}
                  isActive={isActive}
                  normalizedMedias={normalizedMedias}
                  articlePreview={articlePreview}
                  postTitle={post.title || undefined}
                  postContent={post.content || undefined}
                  sharedUrl={post.shared_url || undefined}
                  sharedTitle={post.shared_title || undefined}
                  useStackLayout={useStackLayout}
                  emergencyScroll={emergencyScroll || false}
                  bodyLineClamp={bodyLineClamp}
                  shouldShowApprofondisci={shouldShowApprofondisci}
                  flexiblesStatus={flexiblesStatus}
                  onOpenFullText={openFullTextDrawer}
                  registerRef={registerRef}
                  onMediaTap={(index) => setSelectedMediaIndex(index)}
                  titleRef={(node) => {
                    registerRef('essential-title')(node);
                    if (titleRef) {
                      (titleRef as any).current = node;
                    }
                  }}
                  bodyRef={bodyRef}
                  bodyTextRef={bodyTextRef}
                  mediaRef={mediaRef}
                  captionTextRef={captionTextRef}
                  slotBottomRef={slotBottomRef}
                />
              ) : hasLink && isYoutube ? (
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
                  onOpenFullText={openFullTextDrawer}
                  registerRef={registerRef}
                  titleRef={registerRef('essential-title')}
                  bodyRef={bodyRef}
                  bodyTextRef={bodyTextRef}
                  slotBottomRef={slotBottomRef}
                />
              ) : hasLink && isSpotifyEpisode ? (
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
                  onOpenFullText={openFullTextDrawer}
                  registerRef={registerRef}
                  titleRef={(node) => {
                    registerRef('essential-title')(node);
                    if (titleRef) {
                      (titleRef as any).current = node;
                    }
                  }}
                  bodyRef={bodyRef}
                  bodyTextRef={bodyTextRef}
                  slotBottomRef={slotBottomRef}
                />
              ) : hasLink && isSpotifyTrack ? (
                <SpotifyTrackEmbed
                  title={articlePreview?.title || post.shared_title || undefined}
                  artist={articlePreview?.description || undefined}
                  imageUrl={articlePreview?.image || post.preview_img || undefined}
                  trackUrl={post.shared_url || undefined}
                  isNearActive={isNearActive}
                  postTitle={post.title || undefined}
                  postContent={post.content || undefined}
                  useStackLayout={useStackLayout}
                  emergencyScroll={emergencyScroll || false}
                  bodyLineClamp={bodyLineClamp}
                  shouldShowApprofondisci={shouldShowApprofondisci}
                  spotifyTrackStep={spotifyTrackStep as any}
                  hasUserMedia={hasUserMedia}
                  flexiblesStatus={flexiblesStatus}
                  onOpenFullText={openFullTextDrawer}
                  registerRef={registerRef}
                  titleRef={titleRef}
                  bodyRef={bodyRef}
                  bodyTextRef={bodyTextRef}
                  slotBottomRef={slotBottomRef}
                />
              ) : isGenericArticle ? (
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
                  emergencyScroll={emergencyScroll || false}
                  bodyLineClamp={bodyLineClamp}
                  shouldShowApprofondisci={shouldShowApprofondisci}
                  articleStep={articleStep || "full"}
                  isEditorialFocus={isEditorialFocus || false}
                  editorialSummary={editorialSummary}
                  displayTrustScore={displayTrustScore}
                  hasUserMedia={hasUserMedia}
                  flexiblesStatus={flexiblesStatus}
                  normalizedMedias={normalizedMedias}
                  onOpenFullText={openFullTextDrawer}
                  registerRef={registerRef}
                  navigate={navigate}
                  titleRef={(node) => {
                    registerRef('essential-title')(node);
                    if (titleRef) {
                      (titleRef as any).current = node;
                    }
                  }}
                  bodyRef={bodyRef}
                  bodyTextRef={bodyTextRef}
                  slotBottomRef={slotBottomRef}
                />
              ) : isInstagramReel ? (
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
                  onOpenFullText={openFullTextDrawer}
                  registerRef={registerRef}
                  bodyRef={bodyRef}
                  bodyTextRef={bodyTextRef}
                  captionTextRef={captionTextRef}
                  slotBottomRef={slotBottomRef}
                />
              ) : null}

              {/* Quoted Post - Show for ALL reshares (stack and non-stack) */}
              {quotedPost && (
                <div 
                  ref={useStackLayout ? registerRef('flexible-reshare-quoted-body') : undefined}
                  style={useStackLayout && flexiblesStatus['flexible-reshare-quoted-body'] ? { 
                    height: flexiblesStatus['flexible-reshare-quoted-body'].step === 'hidden' ? 0 : undefined, 
                    maxHeight: flexiblesStatus['flexible-reshare-quoted-body'].step === 'clamped' ? `${flexiblesStatus['flexible-reshare-quoted-body'].height}px` : undefined,
                    overflow: 'hidden'
                  } : undefined}
                  className="mt-0.5"
                >
                  <QuotedPostEmbed
                    post={quotedPost}
                    onPress={() => {
                      const isIlPunto = quotedPost.author?.username === 'ilpunto' || quotedPost.author?.username === 'Il Punto' || quotedPost.author?.id === 'system';
                      if (isIlPunto) {
                        const focusId = quotedPost.shared_url?.replace('focus://daily/', '');
                        if (focusId) {
                          navigate(`/?focus=${focusId}`);
                          return;
                        }
                      }
                      navigate(`/post/${quotedPost.id}`);
                    }}
                    className="flex-shrink min-h-0 overflow-hidden"
                  />
                </div>
              )}

              {/* Unified Approfondisci button for Reshare Stack */}
              {useStackLayout && shouldShowApprofondisci && (
                <div className="flex-shrink-0 mt-2 mb-3 text-left">
                  <button
                    onClick={(e) => { e.stopPropagation(); openFullTextDrawer('description'); }}
                    className="text-sm text-primary font-semibold hover:underline block"
                  >
                    Approfondisci
                  </button>
                </div>
              )}


              {/* Poll Widget - inside content rail */}
              {pollData && (
                <div className="mt-6">
                  <PollWidget poll={pollData} postId={post.id} />
                </div>
              )}

            </div>
          </CardShell.Mid>

          {/* Bottom Actions - Single horizontal axis alignment */}
          {/* [Rail 3] ActionRail: Fixed bottom overlay with gradient fade */}
          <CardShell.Bottom ref={bottomRef}>
            <div className="flex items-center justify-between gap-6 pt-4 pointer-events-auto w-full">

            {/* Primary Share Button - Pill shape with consistent height */}
            {/* Primary Share Button - Pill shape with consistent height */}
            {/* Primary Share Button - Pill shape with consistent height */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                haptics.light();
                handleShareClick(e);
              }}
              className="liquid-share-pill"
            >
              <Logo variant="icon" className="liquid-share-pill-icon object-contain" />
              <span>Condividi</span>
              {(post.shares_count ?? 0) > 0 && (
                <span className="text-xs opacity-70">({post.shares_count})</span>
              )}
            </motion.button>

            {/* Action Icons - Uniform w-6 h-6, aligned on same axis */}
            <div
              ref={actionBarRef}
              className="flex items-center gap-4 h-11 action-bar-zone bg-slate-100 px-4 rounded-full shadow-sm border border-slate-200 dark:bg-transparent dark:px-0 dark:rounded-none dark:shadow-none dark:border-none transition-all"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >

              {/* Like with long press for reaction picker */}
              <div className="relative flex items-center justify-center gap-1.5 h-full">
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  ref={likeButtonRef}
                  className="flex items-center justify-center h-full min-w-[44px] min-h-[44px] select-none no-ios-callout"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  {...likeButtonHandlers}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Dynamic icon: show emoji if non-heart reaction, otherwise Heart icon */}
                  {post.user_reactions?.myReactionType && post.user_reactions.myReactionType !== 'heart' ? (
                    <span className="text-xl">
                      {reactionToEmoji(post.user_reactions.myReactionType)}
                    </span>
                  ) : (
                    <Heart
                      className={cn(
                        "w-6 h-6",
                        post.user_reactions?.has_hearted ? "text-red-500 fill-red-500" : "text-immersive-foreground"
                      )}
                      fill={post.user_reactions?.has_hearted ? "currentColor" : "none"}
                    />
                  )}
                </motion.button>
                {/* Count - clickable to open reactions drawer, select-none prevents text selection on long-press */}
                <button
                  className="text-sm font-bold text-immersive-foreground hover:text-immersive-foreground/80 transition-colors select-none ml-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    if ((post.reactions?.hearts || 0) > 0) {
                      setShowReactionsSheet(true);
                    }
                  }}
                >
                  {post.reactions?.hearts || 0}
                </button>

                {hasMountedReactionPicker.current && (
                  <ReactionPicker
                    isOpen={showReactionPicker}
                    onClose={() => setShowReactionPicker(false)}
                    onSelect={(type) => {
                      handleHeart(undefined, type);
                      setShowReactionPicker(false);
                    }}
                    triggerRef={likeButtonRef}
                    actionBarRef={actionBarRef}
                  />
                )}
              </div>

              {/* Comments - select-none prevents text selection on long-press */}
              {/* Comments - select-none prevents text selection on long-press */}
              <motion.button
                whileTap={{ scale: 0.85 }}
                className="flex items-center justify-center gap-1.5 h-full select-none"
                onClick={(e) => { e.stopPropagation(); haptics.light(); setShowComments(true); }}
              >
                <MessageCircle className="w-6 h-6 text-immersive-foreground" />
                <span className="text-sm font-bold text-immersive-foreground select-none">{post.reactions?.comments || 0}</span>
              </motion.button>

              {/* Bookmark */}
              <motion.button
                whileTap={{ scale: 0.85 }}
                className="flex items-center justify-center h-full"
                onClick={handleBookmark}
              >
                <Bookmark
                  className={cn("w-6 h-6", post.user_reactions.has_bookmarked ? "text-blue-400 fill-blue-400" : "text-immersive-foreground")}
                  fill={post.user_reactions.has_bookmarked ? "currentColor" : "none"}
                />
              </motion.button>
            </div>
          </div>
          </CardShell.Bottom>
        </CardShell>
      </div>
    </div>

      {/* Reader Modal */}
      {
        showReader && readerSource && (
          <div className="fixed inset-0 z-[10040]">
            <SourceReaderGate
              source={readerSource}
              isOpen={showReader}
              isClosing={readerClosing}
              isLoading={readerLoading}
              onClose={async () => {
                if (readerLoading) return;
                setGateStep('reader:manual-close');
                setReaderClosing(true);
                await new Promise((resolve) => setTimeout(resolve, 200));
                setShowReader(false);
                setReaderSource(null);
                await new Promise((resolve) => setTimeout(resolve, 50));
                setReaderClosing(false);
                setGateStep('idle');
              }}
              onComplete={handleReaderComplete}
            />
          </div>
        )
      }

      {/* Quiz Modal */}
      {
        showQuiz && quizData && !quizData.error && quizData.questions && (
          <div className="fixed inset-0 z-[10060]">
            <QuizModal
              questions={quizData.questions}
              qaId={quizData.qaId}
              onSubmit={handleQuizSubmit}
              onComplete={handleQuizComplete}
              onCancel={() => {
                addBreadcrumb('quiz_closed', { via: 'cancelled' });
                setShowQuiz(false);
                setQuizData(null);
                setGateStep('idle');
              }}
            />
          </div>
        )
      }

      {/* Media Viewer */}
      {
        selectedMediaIndex !== null && finalSourceMedia && (
          <div className="fixed inset-0 z-[10080]">
            <MediaViewer
              media={finalSourceMedia}
              initialIndex={selectedMediaIndex}
              postTitle={post.title}
              minimal={shouldUseBlurredBg}
              onClose={(finalIndex) => {
                if (finalIndex !== undefined) {
                  setCarouselIndex(finalIndex);
                }
                setSelectedMediaIndex(null);
              }}
              postActions={{
                onShare: () => {
                  setSelectedMediaIndex(null);
                  setShowShareSheet(true);
                },
                onHeart: () => handleHeart(undefined, 'heart'),
                onComment: () => {
                  setSelectedMediaIndex(null);
                  setShowComments(true);
                },
                onBookmark: () => toggleReaction.mutate({ postId: post.id, reactionType: 'bookmark' }),
                hasHearted: post.user_reactions?.has_hearted ?? false,
                hasBookmarked: post.user_reactions?.has_bookmarked ?? false,
                heartsCount: post.reactions?.hearts ?? 0,
                commentsCount: post.reactions?.comments ?? 0,
                sharesCount: post.shares_count ?? 0,
              }}
            />
          </div>
        )
      }

      {/* Share Sheet */}
      {hasMountedShare.current && (
        <ShareSheet
          isOpen={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          onShareToFeed={handleShareToFeed}
          onShareToFriend={handleShareToFriend}
          onShareNatively={async () => {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const shareType = post.post_type === 'challenge' ? 'challenge' : 'post';
            const shareUrl = `${supabaseUrl}/functions/v1/share?id=${post.id}&type=${shareType}`;
            const shareData = {
              title: post.title || post.shared_title || 'Post su NoParrot',
              text: post.content?.substring(0, 100) || '',
              url: shareUrl,
            };
            if (navigator.share && navigator.canShare?.(shareData)) {
              try { await navigator.share(shareData); } catch (err: any) {
                if (err instanceof Error && err.name !== 'AbortError') {
                  await navigator.clipboard.writeText(shareUrl);
                  toast.success('Link copiato!');
                }
              }
            } else {
              await navigator.clipboard.writeText(shareUrl);
              toast.success('Link copiato!');
            }
          }}
        />
      )}

      {/* People Picker */}
      {hasMountedPeople.current && (
        <PeoplePicker
          isOpen={showPeoplePicker}
          onClose={() => setShowPeoplePicker(false)}
          onSend={async (userIds) => {
            for (const userId of userIds) {
              try {
                const threadResult = await createThread.mutateAsync([userId]);
                if (threadResult?.thread_id) {
                  const shareMessage = post.shared_url
                    ? `${post.content}\n\n${post.shared_url}`
                    : post.content;
                  await sendMessage.mutateAsync({
                    threadId: threadResult.thread_id,
                    content: shareMessage,
                    linkUrl: post.shared_url || undefined
                  });
                }
              } catch { }
            }
            // Increment shares count for DM shares
            try {
              await supabase.rpc('increment_post_shares', { target_post_id: post.id });
  
              // Optimistic UI update (immediate badge)
              queryClient.setQueriesData({ queryKey: ['posts'] }, (old: any) => {
                if (!Array.isArray(old)) return old;
                return old.map((p: any) =>
                  p?.id === post.id ? { ...p, shares_count: (p.shares_count ?? 0) + 1 } : p
                );
              });
              queryClient.invalidateQueries({ queryKey: ['posts'] });
            } catch (e) {
              console.warn('[ImmersivePostCard] Failed to increment shares count:', e);
            }
            toast.success(`Post condiviso con ${userIds.length} ${userIds.length === 1 ? 'amico' : 'amici'}`);
            setShowPeoplePicker(false);
            setShareAction(null);
          }}
        />
      )}

      {hasMountedMediaExpand.current && (
        <MediaPostExpandedSheet
          isOpen={showMediaExpandedSheet}
          onClose={() => setShowMediaExpandedSheet(false)}
          post={post}
          activeVoicePost={activeVoicePost}
          articlePreview={articlePreview}
        />
      )}

      {/* Full Text Modal for long posts */}
      {hasMountedFullText.current && (
        <FullTextModal
          isOpen={showFullText}
          onClose={() => {
            setShowFullText(false);
            setFullTextMode('description');
          }}
          title={
            isInstagramReel
              ? (post.title || "Instagram Reel")
              : isYoutubeShort
                ? (post.title || "YouTube Short")
                : fullTextMode === 'transcript'
                  ? "Trascrizione"
                  : (
                      isChallengePost
                        ? (post.challenge?.title || post.title || '')
                        : isVoicePost
                          ? (activeVoicePost?.title || post.title || '')
                          : (post.title || '')
                    )
          }
          content={
            isInstagramReel
              ? [post.content && post.content.trim(), post.shared_title && post.shared_title.trim()].filter(Boolean).join('\n\n')
              : isYoutubeShort
                ? [post.content?.trim(), articlePreview?.title?.trim()].filter(Boolean).join('\n\n')
                : isChallengePost
                  ? (post.challenge?.body_text || post.content || '')
                  : isVoicePost
                    ? (activeVoicePost?.body_text || post.content || '')
                    : (post.content || '')
          }
          audioUrl={
            isVoicePost || isChallengePost
              ? activeVoicePost?.audio_url || undefined
              : undefined
          }
          showModeToggle={isVoicePost || isChallengePost}
          fullTextMode={fullTextMode}
          onModeChange={(mode) => setFullTextMode(mode)}
          transcriptContent={
            activeVoicePost?.transcript_status === 'completed'
              ? (activeVoicePost.transcript || "Trascrizione non disponibile")
              : (activeVoicePost?.transcript_status === 'pending' || activeVoicePost?.transcript_status === 'processing')
                ? "Trascrizione in elaborazione..."
                : "Trascrizione non disponibile"
          }
          durationSeconds={activeVoicePost?.duration_seconds || 0}
          imageUrl={post.media?.[0]?.url || post.preview_img || undefined}
          youtubeVideoId={isYoutubeShort && post.shared_url ? extractYoutubeVideoId(post.shared_url) || undefined : undefined}
          author={{
            name: post.author.full_name || post.author.username,
            username: post.author.username,
            avatar: post.author.avatar_url,
          }}
          variant="post"
          linkCard={
            isSpotifyEpisode && post.shared_url ? (
              <SpotifyPodcastCompactCard
                imageUrl={articlePreview?.image || post.preview_img || ''}
                podcastName={articlePreview?.description || getHostnameFromUrl(post.shared_url)}
                episodeTitle={decodeHTMLEntities(articlePreview?.title || post.shared_title || '')}
                spotifyUrl={post.shared_url}
              />
            ) : isInstagramReel && post.shared_url ? (
              <a
                href={post.shared_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl overflow-hidden border border-[#E1306C]/20 bg-[#E1306C]/10 hover:bg-[#E1306C]/20 transition-colors no-underline p-4 text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[#E1306C] text-sm font-bold flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                  </svg>
                  Apri su Instagram
                </span>
              </a>
            ) : isYoutubeShort && post.shared_url ? (
              <a
                href={post.shared_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl overflow-hidden border border-[#FF0000]/20 bg-[#FF0000]/10 hover:bg-[#FF0000]/20 transition-colors no-underline p-4 text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[#FF0000] text-sm font-bold flex items-center justify-center gap-2">
                  ▶️ Apri su YouTube
                </span>
              </a>
            ) : !isSpotifyTrack && !isTwitter && !isLinkedIn && !isYoutube && !isYoutubeShort && hasLink && post.shared_url ? (
              <a
                href={post.shared_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl overflow-hidden border border-white/10 bg-white/[0.05] hover:bg-white/[0.08] transition-colors no-underline"
                onClick={(e) => e.stopPropagation()}
              >
                {(articlePreview?.image || post.preview_img) && (
                  <img
                    src={articlePreview?.image || post.preview_img}
                    alt=""
                    width={1200}
                    height={630}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-40 object-cover"
                  />
                )}
                <div className="p-3">
                  <h4 className="font-semibold text-sm text-white line-clamp-2">
                    {decodeHTMLEntities(articlePreview?.title || post.shared_title || post.shared_url)}
                  </h4>
                  <p className="text-xs text-white/50 mt-1 line-clamp-1">
                    {getHostnameFromUrl(post.shared_url)}
                  </p>
                </div>
              </a>
            ) : undefined
          }
          post={{
            id: post.id,
            reactions: post.reactions,
            user_reactions: post.user_reactions,
            shares_count: post.shares_count ?? 0,
          }}
          actions={{
            onHeart: handleHeart,
            onComment: () => setShowComments(true),
            onBookmark: handleBookmark,
            onShare: async () => {
              setShareAction('feed');
              await goDirectlyToGateForPost();
            },
          }}
        />
      )}

      {/* Full Caption Modal for long social media captions */}
      {hasMountedFullCaption.current && (
        <FullTextModal
          isOpen={showFullCaption}
          onClose={() => setShowFullCaption(false)}
          content={decodeHTMLEntities(articlePreview?.title || post.shared_title || '')}
          source={{
            hostname: getHostnameFromUrl(post.shared_url),
            url: post.shared_url || undefined,
          }}
          variant="caption"
          post={{
            id: post.id,
            reactions: post.reactions,
            user_reactions: post.user_reactions,
            shares_count: post.shares_count ?? 0,
          }}
          actions={{
            onHeart: handleHeart,
            onComment: () => setShowComments(true),
            onBookmark: handleBookmark,
            onShare: () => {
              setShareAction('feed');
              // Create a synthetic event for handleShareClick
              const syntheticEvent = { stopPropagation: () => { } } as React.MouseEvent;
              handleShareClick(syntheticEvent);
            },
          }}
        />
      )}

      {/* Comments Drawer */}
      {
        showComments && (
          <CommentsDrawer
            post={post}
            isOpen={showComments}
            onClose={() => setShowComments(false)}
            mode="view"
            scrollToCommentId={scrollToCommentId}
          />
        )
      }

      {/* Reactions Sheet - Who reacted */}
      {hasMountedReactions.current && (
        <ReactionsSheet
          isOpen={showReactionsSheet}
          onClose={() => setShowReactionsSheet(false)}
          postId={post.id}
        />
      )}
      {/* Analysis Overlay */}
      {/* Analysis Overlay - z-index higher than source reader (10050 > 10040) */}
      <AnalysisOverlay isVisible={showAnalysisOverlay} message="Analisi in corso..." className="z-[10050]" />

      {/* Accept Challenge Flow */}
      {showChallengeFlow && post.challenge && (
        <AcceptChallengeFlow
          open={showChallengeFlow}
          onOpenChange={setShowChallengeFlow}
          challengeId={post.challenge.id}
          challengeThesis={post.challenge.thesis}
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["challenge-responses", post.challenge!.id] });
            toast.success('Risposta alla sfida inviata!');
          }}
        />
      )}
      {hasMountedReport.current && (
        <ReportContentDialog
          open={showReportDialog}
          onOpenChange={setShowReportDialog}
          postId={post.id}
        />
      )}
      {hasMountedAdmin.current && (
        <AdminRemoveDialog
          open={showAdminRemoveDialog}
          onOpenChange={setShowAdminRemoveDialog}
          targetId={post.id}
          targetType="post"
          onSuccess={() => onRemove?.(post.id)}
        />
      )}
    </>
  );
};

// Export memoized component for rerender optimization
export const ImmersivePostCard = memo(ImmersivePostCardInner);
ImmersivePostCard.displayName = 'ImmersivePostCard';

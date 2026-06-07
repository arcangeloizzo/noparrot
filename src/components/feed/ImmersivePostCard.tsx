import { useState, useEffect, useRef, useMemo, memo, useLayoutEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { perfStore } from "@/lib/perfStore";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Trash2, Edit2, ExternalLink, Quote, ShieldCheck, Maximize2, Play, Zap, Flag, ShieldAlert, Repeat } from "lucide-react";
import { ReportContentDialog } from "./ReportContentDialog";
import { AdminRemoveDialog } from "./AdminRemoveDialog";
import { useAdminRole } from "@/hooks/useAdminRole";
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
import { ReshareContextStack } from "./ReshareContextStack";
import { SpotifyGradientBackground } from "./SpotifyGradientBackground";
import { SpotifyPodcastCompactCard } from "./SpotifyPodcastCompactCard";
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
import { BlurredImageBackground } from "@/components/media/BlurredImageBackground";

// Composer Components
import { SourceReaderGate } from "../composer/SourceReaderGate";
import { CommentsDrawer } from "./CommentsDrawer";

// Share Components
import { ShareSheet } from "@/components/share/ShareSheet";
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
import { useDoubleTap } from "@/hooks/useDoubleTap";
import { useReshareContextStack } from "@/hooks/useReshareContextStack";
import { useOriginalSource } from "@/hooks/useOriginalSource";
import { haptics } from "@/lib/haptics";
import { addBreadcrumb } from "@/lib/crashBreadcrumbs";
import { useChallengeResponses } from "@/hooks/useChallengeResponses";
import { useDynamicCardLayout, FlexibleElementConfig, CompressionStep } from "@/hooks/useDynamicCardLayout";
import { useLongPress } from "@/hooks/useLongPress";
import { ReactionPicker, reactionToEmoji, type ReactionType } from "@/components/ui/reaction-picker";
// ReactionSummary removed - count next to heart is now clickable
import { ReactionsSheet } from "@/components/feed/ReactionsSheet";

// Deep lookup imperativo per risolvere la fonte originale al click (indipendente da React Query)
const resolveOriginalSourceOnDemand = async (quotedPostId: string | null): Promise<{
  url: string;
  title: string | null;
  image: string | null;
  articleContent?: string;
} | null> => {
  if (!quotedPostId) return null;

  let currentId: string | null = quotedPostId;
  let depth = 0;
  const MAX_DEPTH = 10;

  while (currentId && depth < MAX_DEPTH) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, shared_url, shared_title, preview_img, quoted_post_id, article_content')
      .eq('id', currentId)
      .single();

    if (error || !data) break;

    // Found a post with a source URL
    if (data.shared_url) {
      return {
        url: data.shared_url,
        title: data.shared_title,
        image: data.preview_img,
        articleContent: data.article_content || undefined,
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
  const { data: pollData } = usePollForPost(post.id);
  const canEdit = isOwnPost &&
    (post.reactions?.hearts || 0) === 0 &&
    (post.reactions?.comments || 0) === 0 &&
    (post.shares_count || 0) === 0;

  // Image gating: only load images for cards near the active index
  const shouldLoadImages = isNearActive;

  // Article preview via React Query hook (cached, prefetched)
  const urlToPreview = post.shared_url || quotedPost?.shared_url;
  const { data: articlePreviewData, isLoading: isPreviewLoading } = useArticlePreview(urlToPreview);

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

  // YouTube embed state
  const [youtubeEmbedActive, setYoutubeEmbedActive] = useState(false);

  // Share states
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showAdminRemoveDialog, setShowAdminRemoveDialog] = useState(false);
  const { data: adminRole } = useAdminRole();
  const isStaff = adminRole?.isStaff;
  const [shareAction, setShareAction] = useState<'feed' | 'friend' | null>(null);

  // Editorial summary fallback (for legacy posts without article_content)
  const [editorialSummary, setEditorialSummary] = useState<string | null>(null);

  // Full text modal for long posts
  const [showFullText, setShowFullText] = useState(false);
  const [fullTextMode, setFullTextMode] = useState<'description' | 'transcript'>('description');
  const [showMediaExpandedSheet, setShowMediaExpandedSheet] = useState(false);

  // Caption expansion state for long Instagram/social captions
  const [showFullCaption, setShowFullCaption] = useState(false);
  const CAPTION_TRUNCATE_LENGTH = 120;

  // Reactions sheet state
  const [showReactionsSheet, setShowReactionsSheet] = useState(false);

  // Challenge flow state
  const [showChallengeFlow, setShowChallengeFlow] = useState(false);

  // F. Internal scroll ref for content rail
  const contentRailRef = useRef<HTMLDivElement>(null);

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

  // Trigger refetch for missing preview images on active cards
  // This helps recover from temporary extraction failures
  useEffect(() => {
    if (isNearActive && !isPreviewLoading && urlToPreview && !articlePreview?.image && !post.preview_img) {
      // Only invalidate if we have a URL but no image after loading
      const timeout = setTimeout(() => {
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

  const prevPostIdRef = useRef(post.id);
  useEffect(() => {
    if (prevPostIdRef.current !== post.id) {
      setYoutubeEmbedActive(false);
      prevPostIdRef.current = post.id;
    }
  }, [post.id]);

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
    needsDeepSourceLookup ? post.quoted_post_id : null
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
  const { data: cachedTrustScore } = useCachedTrustScore(finalSourceUrl);

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
          src={post.author.avatar_url}
          alt={post.author.full_name || post.author.username}
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
    let resolvedArticleContent: string | undefined;

    if (!resolvedSourceUrl && post.quoted_post_id) {
      // Use overlay for loading source
      setShowAnalysisOverlay(true);
      const deepSource = await resolveOriginalSourceOnDemand(post.quoted_post_id);
      setShowAnalysisOverlay(false);

      if (deepSource?.url) {
        resolvedSourceUrl = deepSource.url;
        resolvedArticleContent = deepSource.articleContent || undefined;
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
      let editorialContent = resolvedArticleContent;
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
  const hasMedia = (post.media && post.media.length > 0);
  const hasLink = !!post.shared_url;
  const isSpotifyTrack = isSpotify && !isSpotifyEpisode;
  const isTwitter = articlePreview?.platform === 'twitter' || detectPlatformFromUrl(post.shared_url || '') === 'twitter';
  const isLinkedIn = articlePreview?.platform === 'linkedin' || detectPlatformFromUrl(post.shared_url || '') === 'linkedin';
  const isYoutube = articlePreview?.platform === 'youtube' ||
    (post.shared_url?.includes('youtube.com') || post.shared_url?.includes('youtu.be'));
  const isMediaOnlyPost = hasMedia && !hasLink;
  const mediaUrl = post.media?.[0]?.url;
  const isVideoMedia = post.media?.[0]?.type === 'video';
  const backgroundImage = !isMediaOnlyPost ? (articlePreview?.image || post.preview_img || (post.media?.[0]?.url || quotedPost?.media?.[0]?.url || quotedPost?.preview_img)) : undefined;
  
  const isInstagramReel = post.post_type === 'instagram_reel';
  const hasUserMedia = !!post.media && post.media.length > 0;
  const shouldUseBlurredBg = hasUserMedia || isInstagramReel;

  const backgroundImageUrl = hasUserMedia 
    ? post.media[0].url
    : isInstagramReel 
      ? (post.preview_img || articlePreview?.image || null)
      : null;

  const overlayGradient = isInstagramReel
    ? 'linear-gradient(135deg, rgba(131, 58, 180, 0.15) 0%, rgba(253, 29, 29, 0.12) 50%, rgba(247, 119, 55, 0.10) 100%)'
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

  console.log('[ImmersivePostCard DEBUG]', {
    post_id: post.id,
    post_type: post.post_type,
    post_title: post.title,
    post_content: post.content,
    voice_title: activeVoicePost?.title,
    voice_body: activeVoicePost?.body_text,
    challenge_title: post.challenge?.title,
    challenge_body: post.challenge?.body_text
  });

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
  const { responses: challengeResponses, userVote, voteForResponse, removeVote } = useChallengeResponses(challengeIdForResponses);
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
          containerRef={contentRailRef}
          content={content}
          onShowFull={() => setShowFullText(true)}
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

  const hasImage = isStandardPost && (post.preview_img || (post.media && post.media.length > 0));

  const isEditorialFocus = isGenericArticle && post.shared_url?.startsWith('focus://');
  const articleFullHeight = isEditorialFocus 
    ? (editorialSummary || post.article_content ? 240 : 120)
    : ((articlePreview?.image || post.preview_img) ? 240 : 100);

  const essentialsConfig = useMemo(() => {
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
    if (isYoutube) {
      return [
        { id: 'essential-title' },
        {
          id: 'essential-youtube',
          states: [
            { id: 'full', height: 200 },
            { id: 'compact', height: 80 },
            { id: 'pill', height: 36 }
          ]
        }
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
    if (isStandardPost || isInstagramReel) {
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
        {
          id: 'essential-linkedin-embed',
          states: [
            { id: 'full', height: 180 },
            { id: 'pill', height: 36 }
          ]
        }
      ];
    }
    if (isTwitter) {
      return [
        {
          id: 'essential-tweet-embed',
          states: [
            { id: 'full', height: 160 },
            { id: 'pill', height: 36 }
          ]
        }
      ];
    }
    return [];
  }, [
    isSpotifyEpisode,
    isSpotifyTrack,
    isYoutube,
    isGenericArticle,
    isStandardPost,
    isInstagramReel,
    isVoicePost,
    isChallengePost,
    isLinkedIn,
    isTwitter,
    voiceTitle,
    challengeTitle,
    articleFullHeight,
    user?.id
  ]);

  const flexiblesConfig = useMemo(() => {
    if (isSpotifyEpisode || isSpotifyTrack || isYoutube || isGenericArticle) {
      return [
        {
          id: 'flexible-text',
          compressionSteps: ['full', 'clamped', 'hidden'] as CompressionStep[],
          minReadabilityHeight: 60,
          fallbackHeight: 120
        }
      ];
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
      arr.push({
        id: 'flexible-text',
        compressionSteps: ['full', 'clamped', 'hidden'] as CompressionStep[],
        minReadabilityHeight: 60,
        fallbackHeight: 120
      });
      return arr;
    }
    if (isVoicePost) {
      const arr: FlexibleElementConfig[] = [];
      if (voiceContent) {
        arr.push({
          id: 'flexible-description',
          compressionSteps: ['full', 'clamped', 'hidden'] as CompressionStep[],
          minReadabilityHeight: 40,
          fallbackHeight: 80
        });
      }
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
      if (challengeContent) {
        arr.push({
          id: 'flexible-description',
          compressionSteps: ['full', 'clamped', 'hidden'] as CompressionStep[],
          minReadabilityHeight: 40,
          fallbackHeight: 80
        });
      }
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
    if (isLinkedIn) {
      return post.content ? [
        {
          id: 'flexible-user-comment',
          compressionSteps: ['full', 'clamped', 'hidden'] as CompressionStep[],
          minReadabilityHeight: 60,
          fallbackHeight: 120
        }
      ] : [];
    }
    if (isTwitter) {
      return post.content ? [
        {
          id: 'flexible-user-comment',
          compressionSteps: ['full', 'clamped', 'hidden'] as CompressionStep[],
          minReadabilityHeight: 60,
          fallbackHeight: 120
        }
      ] : [];
    }
    if (isInstagramReel) {
      const config: FlexibleElementConfig[] = [];
      if (post.content && post.content.trim().length > 0) {
        config.push({
          id: 'flexible-user-comment',
          compressionSteps: ['full', 'compact', 'hidden'] as CompressionStep[],
          minReadabilityHeight: 40,
          fallbackHeight: 80
        });
      }
      if (!shouldUseBlurredBg) {
        config.push({
          id: 'flexible-image',
          compressionSteps: ['full', 'compact', 'hidden'] as CompressionStep[],
          minReadabilityHeight: 45,
          fallbackHeight: 200
        });
      }
      if (post.shared_title && post.shared_title.trim().length > 0) {
        config.push({
          id: 'flexible-text',
          compressionSteps: ['full', 'compact', 'hidden'] as CompressionStep[],
          minReadabilityHeight: 60,
          fallbackHeight: 120
        });
      }
      return config;
    }
    return [];
  }, [isSpotifyEpisode, isSpotifyTrack, isYoutube, isGenericArticle, isStandardPost, isInstagramReel, isVoicePost, isChallengePost, isLinkedIn, isTwitter, voiceContent, challengeContent, post.content, hasImage, post.media, shouldUseBlurredBg]);
 
  const priorityConfig = useMemo(() => {
    if (isSpotifyEpisode || isSpotifyTrack || isYoutube || isGenericArticle) {
      return ['flexible-text'];
    }
    if (isStandardPost) {
      return (hasImage && !shouldUseBlurredBg) ? ['flexible-image', 'flexible-text'] : ['flexible-text'];
    }
    if (isVoicePost) {
      const hasAttachedImage = post.media && post.media.length > 0;
      const priority: string[] = [];
      if (hasAttachedImage && !shouldUseBlurredBg) {
        priority.push('flexible-image');
      }
      if (voiceContent) {
        priority.push('flexible-description');
      }
      return priority;
    }
    if (isChallengePost) {
      const hasAttachedImage = post.media && post.media.length > 0;
      const priority: string[] = [];
      if (hasAttachedImage && !shouldUseBlurredBg) {
        priority.push('flexible-image');
      }
      if (challengeContent) {
        priority.push('flexible-description');
      }
      return priority;
    }
    if (isLinkedIn) {
      return post.content ? ['flexible-user-comment'] : [];
    }
    if (isTwitter) {
      return post.content ? ['flexible-user-comment'] : [];
    }
    if (isInstagramReel) {
      const priority: string[] = [];
      if (!shouldUseBlurredBg) {
        priority.push('flexible-image');
      }
      if (post.content && post.content.trim().length > 0) {
        priority.push('flexible-user-comment');
      }
      if (post.shared_title && post.shared_title.trim().length > 0) {
        priority.push('flexible-text');
      }
      return priority;
    }
    return [];
  }, [isSpotifyEpisode, isSpotifyTrack, isYoutube, isGenericArticle, isStandardPost, isInstagramReel, isVoicePost, isChallengePost, isLinkedIn, isTwitter, voiceContent, challengeContent, post.content, hasImage, post.media, shouldUseBlurredBg]);

  const {
    status: layoutStatus,
    essentialStates,
    flexiblesStatus,
    showDrawerCta,
    emergencyScroll,
    registerRef
  } = useDynamicCardLayout({
    availableHeight: isInstagramReel ? availableHeight - 75 : availableHeight,
    essentials: essentialsConfig,
    flexibles: flexiblesConfig,
    compressionPriority: priorityConfig
  });

  // DOM checks for text truncation using useLayoutEffect and ResizeObserver
  const bodyTextRef = useRef<HTMLParagraphElement | HTMLDivElement | null>(null);
  const captionTextRef = useRef<HTMLParagraphElement | HTMLDivElement | null>(null);
  const [isBodyTruncated, setIsBodyTruncated] = useState(false);
  const [isCaptionTruncated, setIsCaptionTruncated] = useState(false);

  useLayoutEffect(() => {
    let active = true;
    
    const checkTruncation = () => {
      requestAnimationFrame(() => {
        if (!active) return;
        
        let bodyTrunc = false;
        if (bodyTextRef.current) {
          bodyTrunc = bodyTextRef.current.scrollHeight > bodyTextRef.current.clientHeight;
          setIsBodyTruncated(bodyTrunc);
        } else {
          setIsBodyTruncated(false);
        }
        
        let captionTrunc = false;
        if (captionTextRef.current) {
          captionTrunc = captionTextRef.current.scrollHeight > captionTextRef.current.clientHeight;
          setIsCaptionTruncated(captionTrunc);
          
          console.log('[ImmersivePostCard Truncation Debug]', {
            post_id: post.id,
            post_title: post.title,
            scrollHeight: captionTextRef.current.scrollHeight,
            clientHeight: captionTextRef.current.clientHeight,
            isOverflow: captionTrunc,
            text: captionTextRef.current.textContent?.slice(0, 30),
            display: window.getComputedStyle(captionTextRef.current).display,
            webkitLineClamp: window.getComputedStyle(captionTextRef.current).webkitLineClamp
          });
        } else {
          setIsCaptionTruncated(false);
        }
      });
    };
    
    checkTruncation();
    
    // Re-check on resize, content updates, layout steps, etc.
    const observer = new ResizeObserver(() => {
      checkTruncation();
    });
    
    if (bodyTextRef.current) observer.observe(bodyTextRef.current);
    if (captionTextRef.current) observer.observe(captionTextRef.current);
    
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [
    post.content, 
    post.shared_title, 
    voiceContent, 
    challengeContent, 
    flexiblesStatus, 
    availableHeight
  ]);

  const shouldShowApprofondisci = isBodyTruncated || isCaptionTruncated;

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

  return (
    <>
      <div
        ref={registerRef('card-container')}
        className="h-[100dvh] w-full snap-start relative overflow-hidden bg-immersive transition-colors duration-500"
        onClick={handleDoubleTap}
      >
        {/* Background for voice/challenge posts without PNGs */}
        {isChallengePost && !shouldUseBlurredBg && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(228, 30, 82, 0.07) 0%, rgba(13, 27, 42, 0.95) 40%, rgba(10, 122, 255, 0.04) 100%)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}
        {isVoicePost && !isChallengePost && !shouldUseBlurredBg && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(10, 122, 255, 0.05) 0%, rgba(13, 27, 42, 0.95) 40%, rgba(10, 122, 255, 0.03) 100%)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}
        {shouldUseBlurredBg && backgroundImageUrl ? (
          <>
            <BlurredImageBackground 
              imageUrl={backgroundImageUrl}
              onClick={() => setSelectedMediaIndex(0)}
              overlayGradient={overlayGradient}
            />
            <div 
              className="absolute inset-x-0 bottom-0 pointer-events-none z-[1]"
              style={{
                height: '70%',
                background: 'linear-gradient(to top, rgba(13, 27, 42, 1.0) 0%, rgba(13, 27, 42, 0.85) 40%, transparent 100%)',
              }}
              aria-hidden="true"
            />
          </>
        ) : isMediaOnlyPost && mediaUrl && !isAudioPost ? (
          <>
            {/* Dynamic gradient background from dominant colors */}
            {/* Dynamic gradient background from dominant colors - Dark Mode Only */}
            <div
              className="absolute inset-0 opacity-0 dark:opacity-100 transition-opacity duration-500"
              style={{
                background: `linear-gradient(to bottom, ${dominantPrimary}, ${dominantSecondary})`
              }}
            />
            {/* Dark overlay for text readability - Dark Mode Only */}
            <div className="absolute inset-0 bg-transparent dark:bg-black/30 transition-colors duration-500" />
            {/* Light mode fallback */}
            <div className="absolute inset-0 bg-immersive dark:hidden" />
          </>
        ) : isTextOnly ? (
          <div className="absolute inset-0 bg-immersive">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03] dark:opacity-10" />
          </div>
        ) : isIntentPost || isQuotedIntentPost ? (
          /* Intent posts: Theme-aware background (Light: White/BlueTint, Dark: Deep Blue) */
          <div className="absolute inset-0 bg-gradient-to-b from-immersive via-immersive-muted/20 to-immersive">
            <div className="absolute inset-0 opacity-[0.05] urban-noise-overlay" />
            <div className="absolute inset-0 bg-noparrot-blue/5 pointer-events-none" />
          </div>
        ) : isSpotifyTrack ? (
          <SpotifyGradientBackground
            albumArtUrl={articlePreview?.image || post.preview_img || ''}
            audioFeatures={articlePreview?.audioFeatures}
          />
        ) : isSpotifyEpisode ? (
          /* Podcast episodes: standard dark background, no full-screen gradient */
          <div className="absolute inset-0 bg-immersive">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03] dark:opacity-10" />
          </div>
        ) : isTwitter ? (
          <div className="absolute inset-0 bg-gradient-to-b from-[#1DA1F2]/5 via-white to-slate-100 dark:from-[#15202B] dark:via-[#192734] dark:to-[#0d1117]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1DA1F2]/5 to-transparent dark:from-[#1DA1F2]/10" />
          </div>
        ) : isLinkedIn ? (
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A66C2]/10 via-white to-slate-100 dark:from-[#0A66C2]/20 dark:via-[#1a1a2e] dark:to-[#0d1117]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0A66C2]/10 to-transparent dark:from-[#0A66C2]/15" />
          </div>
        ) : isInstagramReel ? (
          <div className="absolute inset-0 bg-gradient-to-b from-[#E1306C]/10 via-[#0D1B2A] to-[#0D1B2A] dark:from-[#E1306C]/15 dark:via-black dark:to-black">
            <div 
              className="absolute inset-0 opacity-[0.12] dark:opacity-[0.18]"
              style={{
                background: 'linear-gradient(135deg, #833AB4 0%, #FD1D1D 50%, #F77737 100%)',
              }}
            />
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{ 
                background: 'linear-gradient(135deg, rgba(131, 58, 180, 0.15) 0%, rgba(253, 29, 29, 0.12) 50%, rgba(247, 119, 55, 0.10) 100%)',
                mixBlendMode: 'overlay'
              }}
            />
          </div>
        ) : (
          <>
            {/* Blurred background image - behind everything */}
            {backgroundImage && shouldLoadImages && !(!useStackLayout && isChallengePost) && (
              <img
                src={backgroundImage}
                className="absolute inset-0 w-full h-full object-cover opacity-[0.05] blur-2xl scale-110 dark:opacity-60 transition-opacity duration-500"
                alt=""
                loading="lazy"
              />
            )}
            {/* Gradient overlay on top of image, or solid color if no image */}
            <div className={cn(
               "absolute inset-0 transition-colors duration-500",
               (!useStackLayout && isChallengePost) 
                 ? "bg-transparent" 
                 : backgroundImage 
                   ? "bg-gradient-to-b from-transparent via-transparent to-transparent dark:from-black/40 dark:via-black/20 dark:to-black/80" 
                   : "bg-immersive"
            )}>
              {/* Light mode specific gradient: much lighter/transparent */}
              {!(!useStackLayout && isChallengePost) && (
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-transparent dark:from-black/40 dark:via-black/20 dark:to-black/80" />
              )}
            </div>
            
          </>
        )}

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

          <div className="absolute inset-y-0 left-12 right-12 z-50 pointer-events-none">

          {/* [Rail 1] HeaderRail: Fixed top overlay with gradient fade */}
          <div className="absolute top-0 left-0 right-0 z-10 pointer-events-auto">
            <div className="flex justify-between items-start pt-[calc(env(safe-area-inset-top)+72px)] pb-5">
              <div
                className="flex items-center gap-3 cursor-pointer relative z-[60] min-w-0"
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
                
            {(isAudioPost || isChallengePost) && (
              <div className="hidden" />
            )}

            {/* VOCE AI Badge for AI profiles (mutually exclusive with Trust Score) */}
            {post.author.is_ai_institutional ? (
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center gap-x-1.5 min-h-[32px] py-1 px-2.5 rounded-xl border border-[#A78BFA]/40 bg-black/80 text-white transition-all duration-200 active:scale-[0.97] cursor-pointer flex-shrink-0"
                  >
                    <span className="font-bold tracking-wide opacity-60 text-[10px]">✦</span>
                    <span className="text-[10px] font-bold tracking-wider whitespace-nowrap">
                      VOCE AI
                    </span>
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
            ) : (
              <>
                {/* PULSE Badge for Spotify / Trust Score / Category - Hide Trust Score for editorial shares (shown in card) */}
                {hasLink && isSpotifyTrack && articlePreview?.popularity !== undefined ? (
                  <PulseBadge
                    popularity={articlePreview.popularity}
                    size="sm"
                  />
                ) : hasLink && (post.is_intent || (post as any).verified_by === 'user_intent') && !post.shared_url?.startsWith('focus://') ? (
                  <div className="flex-shrink-0">
                    <UnanalyzableBadge />
                  </div>
                ) : hasLink && displayTrustScore && !post.shared_url?.startsWith('focus://') ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "flex items-center gap-1.5 bg-slate-100 border border-slate-200 dark:bg-black/30 dark:border-white/10 px-3 py-1.5 rounded-full cursor-pointer hover:bg-slate-200 dark:hover:bg-black/40 transition-colors shadow-sm dark: flex-shrink-0",
                          displayTrustScore.band === 'ALTO' && "text-emerald-600 dark:text-emerald-400",
                          displayTrustScore.band === 'MEDIO' && "text-amber-600 dark:text-amber-400",
                          displayTrustScore.band === 'BASSO' && "text-red-600 dark:text-red-400"
                        )}
                      >
                        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                        <span className="text-[10px] font-bold tracking-wider uppercase whitespace-nowrap">
                          TRUST {displayTrustScore.band}
                        </span>
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
                ) : null}
              </>
            )}

            {/* Menu */}
            {isOwnPost ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-black/20 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white">
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
                  <button className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-black/20 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white">
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
          </div>

          {/* Center Content */}
          {/* [Rail 2] ContentRail */}
          <div
            ref={contentRailRef}
            className="absolute top-0 bottom-0 left-0 right-0 flex flex-col overflow-hidden pointer-events-none"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 72px + 82px)',
              paddingBottom: 'calc(4rem + env(safe-area-inset-bottom) + 36px + 64px)',
            } as any}
          >



            <div 
              className={cn(
                "w-full flex flex-col relative z-[1] pointer-events-auto", 
                (!isAudioPost && !isChallengePost) ? "my-auto" : "flex-1 min-h-0"
              )}
              style={{ maxHeight: `${availableHeight}px` }}
            >


              {/* Voice Post Body (non-challenge) inline layout */}
              {!useStackLayout && isVoicePost && activeVoicePost && (
                <div 
                  className={cn(
                    "w-full flex flex-col pt-2 pb-8 flex-1 min-h-0 justify-start",
                    emergencyScroll && "overflow-y-auto"
                  )}
                >
                  {/* Header Essenziale: Badge + Title */}
                  <div ref={registerRef('essential-title')} className="w-full flex flex-col flex-shrink-0">
                    {/* Badge VoiceCast — first element */}
                    <div className="w-full flex justify-center mb-5 shrink-0">
                      <span className="h-8 px-4 text-[12px] rounded-full font-bold tracking-wide inline-flex items-center uppercase border shadow-sm"
                        style={{ color: '#0A7AFF', background: 'rgba(10,122,255,0.06)', borderColor: 'rgba(10,122,255,0.2)' }}>
                        🎙 VOICECAST
                      </span>
                    </div>

                    {/* Title se esiste */}
                    {voiceTitle && voiceTitle.trim().length > 0 && (
                      <h2 
                        className="uppercase mb-3 flex-shrink-0"
                        style={{
                          fontFamily: 'Impact, sans-serif',
                          fontSize: 'clamp(30px, 8vw, 42px)',
                          lineHeight: 0.92,
                          letterSpacing: '-0.02em',
                          color: '#FFFFFF',
                          textAlign: 'left'
                        }}
                      >
                        {voiceTitle}
                      </h2>
                    )}
                  </div>

                  {/* Description flessibile se esiste */}
                  {voiceContent && voiceContent.trim().length > 0 && (
                    <>
                      {flexiblesStatus['flexible-description']?.step === 'full' && (
                        <div 
                          ref={(el) => { registerRef('flexible-description')(el); bodyTextRef.current = el; }} 
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6] text-left flex-shrink-0"
                          style={{ fontFamily: 'Inter, sans-serif', lineHeight: 1.55 }}
                        >
                          <MentionText content={voiceContent} />
                        </div>
                      )}

                      {flexiblesStatus['flexible-description']?.step === 'clamped' && (
                        <div 
                          ref={(el) => { registerRef('flexible-description')(el); bodyTextRef.current = el; }} 
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6] text-left flex-shrink-0"
                          style={{ 
                            fontFamily: 'Inter, sans-serif', 
                            lineHeight: 1.55, 
                            display: '-webkit-box',
                            WebkitLineClamp: Math.max(1, Math.floor(flexiblesStatus['flexible-description'].height / BODY_LINE_HEIGHT_PX)),
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            height: `${flexiblesStatus['flexible-description'].height}px`
                          }}
                        >
                          <MentionText content={voiceContent} />
                        </div>
                      )}

                      {flexiblesStatus['flexible-description']?.step === 'hidden' && (
                        <div ref={registerRef('flexible-description')} style={{ height: 0, overflow: 'hidden' }} />
                      )}
                    </>
                  )}

                  {/* Approfondisci subito dopo description (se non c'è description, dopo title) */}
                  {shouldShowApprofondisci && (
                    <div className="flex-shrink-0 mt-2 mb-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setFullTextMode('description'); setShowFullText(true); }}
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
                          ref={registerRef('flexible-image')} 
                          className="relative flex-shrink-0 w-full flex items-center justify-center overflow-hidden mb-3 rounded-xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)] cursor-pointer"
                          style={{ height: `${flexiblesStatus['flexible-image'].height}px` }}
                          onClick={post.media.length === 1 ? (e) => {
                            e.stopPropagation();
                            setSelectedMediaIndex(0);
                          } : undefined}
                        >
                          {post.media.length === 1 ? (
                            isVideoMedia ? (
                              <div className="relative w-full h-full flex items-center justify-center">
                                <img
                                  src={post.media?.[0]?.thumbnail_url || mediaUrl}
                                  alt=""
                                  className="w-full h-full object-contain"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-white/90 backdrop-blur p-3 rounded-full shadow-lg">
                                    <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <img
                                src={mediaUrl}
                                alt=""
                                className="w-full h-full object-contain"
                              />
                            )
                          ) : (
                            <MediaGallery
                              media={post.media}
                              onClick={(_, index) => setSelectedMediaIndex(index)}
                              initialIndex={carouselIndex}
                              onIndexChange={setCarouselIndex}
                              className="h-full w-full object-contain"
                            />
                          )}
                        </div>
                      )}
                      
                      {flexiblesStatus['flexible-image']?.step === 'pill' && (
                        <div 
                          ref={registerRef('flexible-image')} 
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
                        <div ref={registerRef('flexible-image')} style={{ height: 0, overflow: 'hidden' }} />
                      )}
                    </>
                  )}

                  {/* Player audio essenziale a stati */}
                  {essentialStates['essential-voice-player'] === 'standard' && (
                    <div ref={registerRef('essential-voice-player')} className="w-full mt-auto flex-shrink-0">
                      <ImmersiveVoicePlayerV2
                        audioUrl={activeVoicePost?.audio_url || ''}
                        durationSeconds={activeVoicePost?.duration_seconds || 0}
                        transcriptStatus={activeVoicePost?.transcript_status as any}
                        onShowTranscript={() => { setFullTextMode('transcript'); setShowFullText(true); }}
                      />
                    </div>
                  )}
                  {essentialStates['essential-voice-player'] === 'compact' && (
                    <div ref={registerRef('essential-voice-player')} className="w-full mt-auto flex-shrink-0">
                      <VoicePlayer 
                        compact 
                        audioUrl={activeVoicePost?.audio_url || ''}
                        durationSeconds={activeVoicePost?.duration_seconds || 0}
                        transcript={activeVoicePost?.transcript}
                        transcriptStatus={activeVoicePost?.transcript_status as any}
                        onShowTranscript={() => { setFullTextMode('transcript'); setShowFullText(true); }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Challenge Post Body inline layout */}
              {!useStackLayout && isChallengePost && activeVoicePost && post.challenge && (
                <div 
                  className={cn(
                    "w-full flex flex-col pt-2 pb-6 flex-1 min-h-0 justify-start",
                    emergencyScroll && "overflow-y-auto"
                  )}
                >
                  {/* Header Essenziale: Badge + Title */}
                  <div ref={registerRef('essential-title')} className="w-full flex flex-col flex-shrink-0">
                    {/* Badge Challenge — first element in the flow */}
                    <div className="w-full flex justify-center mb-5 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="h-8 px-4 text-[12px] rounded-full font-bold tracking-wide inline-flex items-center uppercase border shadow-sm"
                          style={{ color: '#E41E52', background: 'rgba(228,30,82,0.06)', borderColor: 'rgba(228,30,82,0.2)' }}>
                          ⚡ CHALLENGE
                        </span>
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
                    </div>

                    {/* Title se esiste */}
                    {challengeTitle && challengeTitle.trim().length > 0 && (
                      <h2 
                        className="uppercase mb-3 flex-shrink-0"
                        style={{
                          fontFamily: 'Impact, sans-serif',
                          fontSize: 'clamp(30px, 8vw, 42px)',
                          lineHeight: 0.92,
                          letterSpacing: '-0.02em',
                          color: '#FFFFFF',
                          textAlign: 'left'
                        }}
                      >
                        {challengeTitle}
                      </h2>
                    )}
                  </div>

                  {/* Description flessibile se esiste */}
                  {challengeContent && challengeContent.trim().length > 0 && (
                    <>
                      {flexiblesStatus['flexible-description']?.step === 'full' && (
                        <div 
                          ref={(el) => { registerRef('flexible-description')(el); bodyTextRef.current = el; }} 
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6] text-left flex-shrink-0"
                          style={{ fontFamily: 'Inter, sans-serif', lineHeight: 1.55 }}
                        >
                          <MentionText content={challengeContent} />
                        </div>
                      )}

                      {flexiblesStatus['flexible-description']?.step === 'clamped' && (
                        <div 
                          ref={(el) => { registerRef('flexible-description')(el); bodyTextRef.current = el; }} 
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6] text-left flex-shrink-0"
                          style={{ 
                            fontFamily: 'Inter, sans-serif', 
                            lineHeight: 1.55, 
                            display: '-webkit-box',
                            WebkitLineClamp: Math.max(1, Math.floor(flexiblesStatus['flexible-description'].height / BODY_LINE_HEIGHT_PX)),
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            height: `${flexiblesStatus['flexible-description'].height}px`
                          }}
                        >
                          <MentionText content={challengeContent} />
                        </div>
                      )}

                      {flexiblesStatus['flexible-description']?.step === 'hidden' && (
                        <div ref={registerRef('flexible-description')} style={{ height: 0, overflow: 'hidden' }} />
                      )}
                    </>
                  )}

                  {/* Approfondisci subito dopo description (se non c'è description, dopo title) */}
                  {shouldShowApprofondisci && (
                    <div className="flex-shrink-0 mt-2 mb-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setFullTextMode('description'); setShowFullText(true); }}
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
                          ref={registerRef('flexible-image')} 
                          className="relative flex-shrink-0 w-full flex items-center justify-center overflow-hidden mb-3 rounded-xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)] cursor-pointer"
                          style={{ height: `${flexiblesStatus['flexible-image'].height}px` }}
                          onClick={post.media.length === 1 ? (e) => {
                            e.stopPropagation();
                            setSelectedMediaIndex(0);
                          } : undefined}
                        >
                          {post.media.length === 1 ? (
                            isVideoMedia ? (
                              <div className="relative w-full h-full flex items-center justify-center">
                                <img
                                  src={post.media?.[0]?.thumbnail_url || mediaUrl}
                                  alt=""
                                  className="w-full h-full object-contain"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-white/90 backdrop-blur p-3 rounded-full shadow-lg">
                                    <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <img
                                src={mediaUrl}
                                alt=""
                                className="w-full h-full object-contain"
                              />
                            )
                          ) : (
                            <MediaGallery
                              media={post.media}
                              onClick={(_, index) => setSelectedMediaIndex(index)}
                              initialIndex={carouselIndex}
                              onIndexChange={setCarouselIndex}
                              className="h-full w-full object-contain"
                            />
                          )}
                        </div>
                      )}
                      
                      {flexiblesStatus['flexible-image']?.step === 'pill' && (
                        <div 
                          ref={registerRef('flexible-image')} 
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
                        <div ref={registerRef('flexible-image')} style={{ height: 0, overflow: 'hidden' }} />
                      )}
                    </>
                  )}

                  {/* Player audio compact (essential-challenge-player) */}
                  <div ref={registerRef('essential-challenge-player')} className="w-full mt-auto flex-shrink-0">
                    <VoicePlayer 
                      compact 
                      audioUrl={activeVoicePost?.audio_url || ''}
                      durationSeconds={activeVoicePost?.duration_seconds || 0}
                      transcript={activeVoicePost?.transcript}
                      transcriptStatus={activeVoicePost?.transcript_status as any}
                      accentColor="#E41E52"
                      onShowTranscript={() => { setFullTextMode('transcript'); setShowFullText(true); }}
                    />
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
                                  <AvatarImage src={resp.user.avatar_url || undefined} />
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
                <div className={cn(
                  "mb-1 flex flex-col gap-1",
                  isChallengePost ? "font-normal" : "font-normal"
                )}>
                  {/* Title */}
                  {post.title && post.title.trim().length > 0 && (
                    <h2 
                      className="uppercase mb-1"
                      style={{
                        fontFamily: 'Impact, sans-serif',
                        fontSize: 'clamp(30px, 8vw, 42px)',
                        lineHeight: 0.92,
                        letterSpacing: '-0.02em',
                        color: '#FFFFFF',
                        textAlign: 'left'
                      }}
                    >
                      {post.title}
                    </h2>
                  )}
                  {post.content && post.content.trim().length > 0 && (
                    <div 
                      className={cn(
                        "whitespace-pre-wrap break-words  dark:",
                        post.title && post.title.trim().length > 0 ? "text-[14px] text-[#7A8FA6]" : "text-base sm:text-lg text-slate-600 dark:text-white/90 leading-snug tracking-wide"
                      )}
                      style={post.title && post.title.trim().length > 0 ? { fontFamily: 'Inter, sans-serif', lineHeight: 1.55, textAlign: 'left' } : {}}
                    >
                      <DynamicClampBody
                        containerRef={contentRailRef}
                        content={post.content}
                        onShowFull={() => setShowFullText(true)}
                        enabled={isNearActive}
                        lineHeightPx={post.title && post.title.trim().length > 0 ? 22 : 26}
                        minLines={2}
                        fadeColor="#0d1117"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Intent Post (non-stack): Quote Block style for posts with is_intent flag */}
              {!useStackLayout && post.is_intent && post.content && (
                <div className="border-l-4 border-primary/60 bg-card/10 px-3 sm:px-4 py-2 sm:py-3 rounded-r-lg mb-4 sm:mb-6">
                  <p className="text-base sm:text-lg font-normal text-slate-600 dark:text-white/90 leading-snug tracking-wide ">
                    <MentionText content={post.content} />
                  </p>
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
                    <h2 
                      className="uppercase mb-1"
                      style={{
                        fontFamily: 'Impact, sans-serif',
                        fontSize: 'clamp(30px, 8vw, 42px)',
                        lineHeight: 0.92,
                        letterSpacing: '-0.02em',
                        color: '#FFFFFF',
                        textAlign: 'left'
                      }}
                    >
                      {post.title}
                    </h2>
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
                    <h2 
                      className="uppercase mb-1"
                      style={{
                        fontFamily: 'Impact, sans-serif',
                        fontSize: 'clamp(30px, 8vw, 42px)',
                        lineHeight: 0.92,
                        letterSpacing: '-0.02em',
                        color: '#FFFFFF',
                        textAlign: 'left'
                      }}
                    >
                      {post.title}
                    </h2>
                  )}
                  {post.content && post.content.trim().length > 0 && renderBodyText(post.content, !!(post.title && post.title.trim().length > 0))}
                </div>
              )}

              {isStandardPost && (
                <div 
                  className={cn(
                    "flex-1 min-h-0 flex flex-col justify-start w-full",
                    emergencyScroll && "overflow-y-auto"
                  )}
                >
                  {/* Title */}
                  {post.title && post.title.trim().length > 0 && (
                    <h2 
                      ref={registerRef('essential-title')}
                      className="uppercase mb-2 flex-shrink-0"
                      style={{
                        fontFamily: 'Impact, sans-serif',
                        fontSize: 'clamp(30px, 8vw, 42px)',
                        lineHeight: 0.92,
                        letterSpacing: '-0.02em',
                        color: '#FFFFFF',
                        textAlign: 'left'
                      }}
                    >
                      {post.title}
                    </h2>
                  )}

                  {/* Body text — unico flessibile o primo flessibile */}
                  {post.content && post.content.trim().length > 0 && (
                    <>
                      {flexiblesStatus['flexible-text']?.step === 'full' && (
                        <div 
                          ref={(el) => { registerRef('flexible-text')(el); bodyTextRef.current = el; }}
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6]"
                          style={{ fontFamily: 'Inter, sans-serif', lineHeight: 1.55, textAlign: 'left' }}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}

                      {flexiblesStatus['flexible-text']?.step === 'clamped' && (
                        <div 
                          ref={(el) => { registerRef('flexible-text')(el); bodyTextRef.current = el; }}
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6]"
                          style={{ 
                            fontFamily: 'Inter, sans-serif', 
                            lineHeight: 1.55, 
                            textAlign: 'left',
                            display: '-webkit-box',
                            WebkitLineClamp: Math.max(1, Math.floor(flexiblesStatus['flexible-text'].height / BODY_LINE_HEIGHT_PX)),
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            height: `${flexiblesStatus['flexible-text'].height}px`
                          }}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}

                      {flexiblesStatus['flexible-text']?.step === 'hidden' && (
                        <div ref={registerRef('flexible-text')} style={{ height: 0, overflow: 'hidden' }} />
                      )}
                    </>
                  )}

                  {/* Approfondisci (subito dopo il body text) */}
                  {shouldShowApprofondisci && (
                    <div className="flex-shrink-0 mt-2 mb-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                        className="text-sm text-primary font-semibold hover:underline block"
                      >
                        Approfondisci
                      </button>
                    </div>
                  )}

                  {/* Image/Media — secondo flessibile (se presente) */}
                  {hasMedia && post.media && post.media.length > 0 && !shouldUseBlurredBg && (
                    <>
                      {flexiblesStatus['flexible-image']?.step === 'full' && (
                        <div 
                          ref={registerRef('flexible-image')} 
                          className="relative flex-shrink-0 w-full flex items-center justify-center overflow-hidden mb-3 rounded-xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)] cursor-pointer"
                          style={{ height: `${flexiblesStatus['flexible-image'].height}px` }}
                          onClick={post.media.length === 1 ? (e) => {
                            e.stopPropagation();
                            setSelectedMediaIndex(0);
                          } : undefined}
                        >
                          {post.media.length === 1 ? (
                            isVideoMedia ? (
                              <div className="relative w-full h-full flex items-center justify-center">
                                <img
                                  src={post.media?.[0]?.thumbnail_url || mediaUrl}
                                  alt=""
                                  className="w-full h-full object-contain"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-white/90 backdrop-blur p-3 rounded-full shadow-lg">
                                    <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <img
                                src={mediaUrl}
                                alt=""
                                className="w-full h-full object-contain"
                              />
                            )
                          ) : (
                            <MediaGallery
                              media={post.media}
                              onClick={(_, index) => setSelectedMediaIndex(index)}
                              initialIndex={carouselIndex}
                              onIndexChange={setCarouselIndex}
                              className="h-full w-full object-contain"
                            />
                          )}
                        </div>
                      )}
                      
                      {flexiblesStatus['flexible-image']?.step === 'pill' && (
                        <div 
                          ref={registerRef('flexible-image')} 
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
                        <div ref={registerRef('flexible-image')} style={{ height: 0, overflow: 'hidden' }} />
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Twitter/X Card - Unified glassmorphic container */}
              {hasLink && isTwitter ? (
                <div 
                  className={cn(
                    "flex-1 min-h-0 w-full flex flex-col justify-start",
                    emergencyScroll && "overflow-y-auto"
                  )}
                >
                  {/* Commento utente flessibile (3 stati) */}
                  {post.content && post.content.trim().length > 0 && (
                    <>
                      {flexiblesStatus['flexible-user-comment']?.step === 'full' && (
                        <div 
                          ref={(el) => { registerRef('flexible-user-comment')(el); bodyTextRef.current = el; }} 
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6] text-left flex-shrink-0"
                          style={{ fontFamily: 'Inter, sans-serif', lineHeight: 1.55 }}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}

                      {flexiblesStatus['flexible-user-comment']?.step === 'clamped' && (
                        <div 
                          ref={(el) => { registerRef('flexible-user-comment')(el); bodyTextRef.current = el; }} 
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6] text-left flex-shrink-0"
                          style={{ 
                            fontFamily: 'Inter, sans-serif', 
                            lineHeight: 1.55, 
                            display: '-webkit-box',
                            WebkitLineClamp: Math.max(1, Math.floor(flexiblesStatus['flexible-user-comment'].height / BODY_LINE_HEIGHT_PX)),
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            height: `${flexiblesStatus['flexible-user-comment'].height}px`
                          }}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}

                      {flexiblesStatus['flexible-user-comment']?.step === 'hidden' && (
                        <div ref={registerRef('flexible-user-comment')} style={{ height: 0, overflow: 'hidden' }} />
                      )}
                    </>
                  )}

                  {/* Approfondisci */}
                  {shouldShowApprofondisci && (
                    <div className="flex-shrink-0 mt-2 mb-3 text-left">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                        className="text-sm text-primary font-semibold hover:underline block"
                      >
                        Approfondisci
                      </button>
                    </div>
                  )}

                  {/* Tweet Embed (essenziale a stati) */}
                  {essentialStates['essential-tweet-embed'] === 'full' && (
                    <div 
                      ref={registerRef('essential-tweet-embed')}
                      className="bg-gradient-to-br from-[#1DA1F2]/5 to-white/90 dark:from-[#15202B] dark:to-[#0d1117] rounded-3xl p-5 border border-black/5 dark:border-white/15 dark: cursor-pointer active:scale-[0.98] transition-transform flex flex-col max-h-full mt-auto flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (post.shared_url) {
                          window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                    >
                      {/* Author Row - Fixed height */}
                      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                        <div className="w-12 h-12 rounded-full border border-white/20 overflow-hidden bg-[#1DA1F2]/10 flex-shrink-0 flex items-center justify-center">
                          {articlePreview?.author_avatar ? (
                            <img
                              src={articlePreview.author_avatar}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/50 text-xl font-bold">
                              {(articlePreview?.author_name || articlePreview?.author_username || 'X').charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-1.5">
                            <p className="text-slate-900 dark:text-white font-semibold truncate text-sm">
                              {articlePreview?.author_name || articlePreview?.title?.replace('Post by ', '').replace('@', '') || 'X User'}
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
                            <p className="text-slate-500 dark:text-white/50 text-xs">@{articlePreview.author_username}</p>
                          )}
                        </div>
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-white flex items-center justify-center flex-shrink-0">
                          <span className="text-black font-bold text-xs">𝕏</span>
                        </div>
                      </div>

                      {/* Tweet Text - clamped */}
                      <div className="flex-shrink-0 min-h-0 overflow-hidden mb-2 text-left">
                        <p className="text-slate-900 dark:text-white text-sm leading-relaxed line-clamp-3">
                          {(articlePreview?.content || articlePreview?.summary || post.content || '')
                            .replace(/https?:\/\/t\.co\/\w+/g, '')
                            .replace(/https?:\/\/[^\s]+/g, '')
                            .replace(/\s{2,}/g, ' ')
                            .trim()}
                        </p>
                      </div>

                      {/* Open on X link button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (post.shared_url) {
                            window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        className="inline-flex items-center gap-2 text-immersive-muted hover:text-immersive-foreground transition-colors mt-2 self-start"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="text-xs uppercase tracking-wider">Apri su X</span>
                      </button>
                    </div>
                  )}

                  {essentialStates['essential-tweet-embed'] === 'pill' && (
                    <div ref={registerRef('essential-tweet-embed')} className="flex-shrink-0 mt-auto" style={{ height: '36px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (post.shared_url) {
                            window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        className="inline-flex h-9 items-center gap-1.5 bg-[#000000] hover:bg-[#000000]/90 border border-white/10 px-4 rounded-full text-white"
                      >
                        <span className="text-xs font-bold">𝕏 Apri tweet</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : hasLink && isLinkedIn ? (
                <div 
                  className={cn(
                    "flex-1 min-h-0 w-full flex flex-col justify-start",
                    emergencyScroll && "overflow-y-auto"
                  )}
                >
                  {/* Commento utente flessibile (3 stati) */}
                  {post.content && post.content.trim().length > 0 && (
                    <>
                      {flexiblesStatus['flexible-user-comment']?.step === 'full' && (
                        <div 
                          ref={(el) => { registerRef('flexible-user-comment')(el); bodyTextRef.current = el; }} 
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6] text-left flex-shrink-0"
                          style={{ fontFamily: 'Inter, sans-serif', lineHeight: 1.55 }}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}

                      {flexiblesStatus['flexible-user-comment']?.step === 'clamped' && (
                        <div 
                          ref={(el) => { registerRef('flexible-user-comment')(el); bodyTextRef.current = el; }} 
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6] text-left flex-shrink-0"
                          style={{ 
                            fontFamily: 'Inter, sans-serif', 
                            lineHeight: 1.55, 
                            display: '-webkit-box',
                            WebkitLineClamp: Math.max(1, Math.floor(flexiblesStatus['flexible-user-comment'].height / BODY_LINE_HEIGHT_PX)),
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            height: `${flexiblesStatus['flexible-user-comment'].height}px`
                          }}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}

                      {flexiblesStatus['flexible-user-comment']?.step === 'hidden' && (
                        <div ref={registerRef('flexible-user-comment')} style={{ height: 0, overflow: 'hidden' }} />
                      )}
                    </>
                  )}

                  {/* Approfondisci */}
                  {shouldShowApprofondisci && (
                    <div className="flex-shrink-0 mt-2 mb-3 text-left">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                        className="text-sm text-primary font-semibold hover:underline block"
                      >
                        Approfondisci
                      </button>
                    </div>
                  )}

                  {/* LinkedIn embed (essenziale a stati) */}
                  {essentialStates['essential-linkedin-embed'] === 'full' && (
                    <div ref={registerRef('essential-linkedin-embed')} className="w-full mt-auto flex-shrink-0">
                      <LinkedInCard
                        post={post}
                        articlePreview={articlePreview}
                        useStackLayout={useStackLayout}
                      />
                    </div>
                  )}

                  {essentialStates['essential-linkedin-embed'] === 'pill' && (
                    <div ref={registerRef('essential-linkedin-embed')} className="flex-shrink-0 mt-auto" style={{ height: '36px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (post.shared_url) {
                            window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        className="inline-flex h-9 items-center gap-1.5 bg-[#0A66C2] px-4 rounded-full text-white"
                      >
                        <span className="text-xs font-bold">💼 Apri su LinkedIn</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : hasLink && isYoutube ? (
                <div
                  className={cn(
                    "flex-1 min-h-0 flex flex-col justify-start w-full",
                    emergencyScroll && "overflow-y-auto"
                  )}
                >
                  {/* Title */}
                  {post.title && post.title.trim().length > 0 ? (
                    <h2
                      ref={registerRef('essential-title')}
                      className="uppercase mb-2 flex-shrink-0"
                      style={{
                        fontFamily: 'Impact, sans-serif',
                        fontSize: 'clamp(30px, 8vw, 42px)',
                        lineHeight: 0.92,
                        letterSpacing: '-0.02em',
                        color: '#FFFFFF',
                        textAlign: 'left'
                      }}
                    >
                      {post.title}
                    </h2>
                  ) : (
                    <h2
                      ref={registerRef('essential-title')}
                      className="text-xl font-bold text-immersive-foreground leading-tight mt-1 mb-2 flex-shrink-0"
                    >
                      {decodeHTMLEntities(articlePreview?.title || post.shared_title)}
                    </h2>
                  )}

                  {/* Body text */}
                  {post.content && post.content.trim().length > 0 && (
                    <>
                      {flexiblesStatus['flexible-text']?.step === 'full' && (
                        <div
                          ref={(el) => { registerRef('flexible-text')(el); bodyTextRef.current = el; }}
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6]"
                          style={{ fontFamily: 'Inter, sans-serif', lineHeight: 1.55, textAlign: 'left' }}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}
                      {flexiblesStatus['flexible-text']?.step === 'clamped' && (
                        <div
                          ref={(el) => { registerRef('flexible-text')(el); bodyTextRef.current = el; }}
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6]"
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            lineHeight: 1.55,
                            textAlign: 'left',
                            display: '-webkit-box',
                            WebkitLineClamp: Math.max(1, Math.floor(flexiblesStatus['flexible-text'].height / BODY_LINE_HEIGHT_PX)),
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            height: `${flexiblesStatus['flexible-text'].height}px`
                          }}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}
                      {flexiblesStatus['flexible-text']?.step === 'hidden' && (
                        <div ref={registerRef('flexible-text')} style={{ height: 0, overflow: 'hidden' }} />
                      )}
                    </>
                  )}

                  {/* Approfondisci */}
                  {shouldShowApprofondisci && (
                    <div className="flex-shrink-0 mt-2 mb-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                        className="text-sm text-primary font-semibold hover:underline block"
                      >
                        Approfondisci
                      </button>
                    </div>
                  )}

                  {/* YouTube embed */}
                  {essentialStates['essential-youtube'] === 'full' && (
                    <div ref={registerRef('essential-youtube')} className="w-full mt-auto flex-shrink-0">
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
                                src={articlePreview?.image || post.preview_img || `https://img.youtube.com/vi/${extractYoutubeVideoId(post.shared_url!)}/maxresdefault.jpg`}
                                alt=""
                                className="w-full aspect-video object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <div className="bg-red-600 p-4 rounded-full">
                                  <Play className="w-8 h-8 text-white fill-white" />
                                </div>
                              </div>
                              <div className="absolute bottom-3 left-3 bg-black/90 px-3 py-1.5 rounded-full flex items-center gap-2">
                                <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="currentColor">
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
                                  src={`https://www.youtube.com/embed/${extractYoutubeVideoId(post.shared_url!)}?autoplay=1&mute=1&cc_load_policy=1&rel=0`}
                                  className="w-full h-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                                  title="YouTube video"
                                />
                              </div>
                            </div>
                          )}
                          
                          {post.title && post.title.trim().length > 0 && (
                            <h1 className="text-xs font-semibold text-immersive-foreground line-clamp-1 mt-2 mb-1">
                              {decodeHTMLEntities(articlePreview?.title || post.shared_title)}
                            </h1>
                          )}
                        </>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                        }}
                        className="inline-flex items-center gap-2 text-immersive-muted hover:text-immersive-foreground transition-colors mt-2"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="text-xs uppercase tracking-wider">Apri su YouTube</span>
                      </button>
                    </div>
                  )}

                  {essentialStates['essential-youtube'] === 'compact' && (
                    hasUserMedia ? (
                      <div ref={registerRef('essential-youtube')} className="mt-auto flex-shrink-0 text-left">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (post.shared_url) {
                              window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          className="inline-flex items-center gap-2 text-immersive-muted hover:text-immersive-foreground transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="text-xs uppercase tracking-wider">Apri su YouTube</span>
                        </button>
                      </div>
                    ) : (
                      <div ref={registerRef('essential-youtube')} 
                           className="flex items-center gap-3 p-2 bg-card/40 rounded-lg cursor-pointer mt-auto flex-shrink-0 border border-white/10"
                           onClick={(e) => {
                             e.stopPropagation();
                             if (post.shared_url) {
                               window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                             }
                           }}>
                        {/* Thumbnail 80×45 (16:9) */}
                        <div className="relative flex-shrink-0 w-20 h-[45px] rounded overflow-hidden bg-muted">
                          <img 
                            src={articlePreview?.image || post.preview_img || (post.shared_url ? `https://img.youtube.com/vi/${extractYoutubeVideoId(post.shared_url)}/hqdefault.jpg` : '')} 
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
                            {decodeHTMLEntities(articlePreview?.title || post.shared_title)}
                          </p>
                          <p className="text-xs text-muted-foreground font-sans">YouTube</p>
                        </div>
                      </div>
                    )
                  )}

                  {essentialStates['essential-youtube'] === 'pill' && (
                    <div ref={registerRef('essential-youtube')} className="flex-shrink-0 mt-auto" style={{ height: '36px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                        }}
                        className="inline-flex h-9 items-center gap-1.5 bg-[#FF0000] px-4 rounded-full"
                      >
                        <span className="text-white text-xs font-bold">▶️ Guarda su YouTube</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : hasLink && isSpotifyEpisode ? (
                <div
                  className={cn(
                    "flex-1 min-h-0 flex flex-col justify-start w-full",
                    emergencyScroll && "overflow-y-auto"
                  )}
                >
                  {/* Title */}
                  {post.title && post.title.trim().length > 0 && (
                    <h2
                      ref={registerRef('essential-title')}
                      className="uppercase mb-2 flex-shrink-0"
                      style={{
                        fontFamily: 'Impact, sans-serif',
                        fontSize: 'clamp(30px, 8vw, 42px)',
                        lineHeight: 0.92,
                        letterSpacing: '-0.02em',
                        color: '#FFFFFF',
                        textAlign: 'left'
                      }}
                    >
                      {post.title}
                    </h2>
                  )}

                  {/* Body text */}
                  {post.content && post.content.trim().length > 0 && (
                    <>
                      {flexiblesStatus['flexible-text']?.step === 'full' && (
                        <div
                          ref={(el) => { registerRef('flexible-text')(el); bodyTextRef.current = el; }}
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6]"
                          style={{ fontFamily: 'Inter, sans-serif', lineHeight: 1.55, textAlign: 'left' }}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}
                      {flexiblesStatus['flexible-text']?.step === 'clamped' && (
                        <div
                          ref={(el) => { registerRef('flexible-text')(el); bodyTextRef.current = el; }}
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6]"
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            lineHeight: 1.55,
                            textAlign: 'left',
                            display: '-webkit-box',
                            WebkitLineClamp: Math.max(1, Math.floor(flexiblesStatus['flexible-text'].height / BODY_LINE_HEIGHT_PX)),
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            height: `${flexiblesStatus['flexible-text'].height}px`
                          }}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}
                      {flexiblesStatus['flexible-text']?.step === 'hidden' && (
                        <div ref={registerRef('flexible-text')} style={{ height: 0, overflow: 'hidden' }} />
                      )}
                    </>
                  )}

                  {/* Approfondisci */}
                  {shouldShowApprofondisci && (
                    <div className="flex-shrink-0 mt-2 mb-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                        className="text-sm text-primary font-semibold hover:underline block"
                      >
                        Approfondisci
                      </button>
                    </div>
                  )}

                  {/* Spotify embed */}
                  {essentialStates['essential-spotify'] === 'full' && (
                    hasUserMedia ? (
                      <div ref={registerRef('essential-spotify')} className="flex-shrink-0 mt-auto text-left">
                        <a
                          href={post.shared_url || ''}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex h-9 items-center gap-1.5 bg-[#1DB954] px-4 rounded-full text-white"
                        >
                          <span className="text-white text-xs font-bold">🎙️ Apri il podcast</span>
                        </a>
                      </div>
                    ) : (
                      <div ref={registerRef('essential-spotify')} className="flex-shrink-0 mt-auto">
                        <SpotifyPodcastCompactCard
                          imageUrl={articlePreview?.image || post.preview_img || ''}
                          podcastName={articlePreview?.description || getHostnameFromUrl(post.shared_url)}
                          episodeTitle={decodeHTMLEntities(articlePreview?.title || post.shared_title || '')}
                          spotifyUrl={post.shared_url || ''}
                        />
                      </div>
                    )
                  )}

                  {essentialStates['essential-spotify'] === 'pill' && (
                    <div ref={registerRef('essential-spotify')} className="flex-shrink-0 mt-auto" style={{ height: '36px' }}>
                      <a
                        href={post.shared_url || ''}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-9 items-center gap-1.5 bg-[#1DB954] px-4 rounded-full"
                      >
                        <span className="text-white text-xs font-bold">🎙️ Apri il podcast</span>
                      </a>
                    </div>
                  )}
                </div>
              ) : hasLink && isSpotifyTrack ? (
                <div
                  className={cn(
                    "flex-1 min-h-0 flex flex-col justify-start w-full",
                    emergencyScroll && "overflow-y-auto"
                  )}
                >
                  {/* Title */}
                  {post.title && post.title.trim().length > 0 && (
                    <h2
                      ref={registerRef('essential-title')}
                      className="uppercase mb-2 flex-shrink-0"
                      style={{
                        fontFamily: 'Impact, sans-serif',
                        fontSize: 'clamp(30px, 8vw, 42px)',
                        lineHeight: 0.92,
                        letterSpacing: '-0.02em',
                        color: '#FFFFFF',
                        textAlign: 'left'
                      }}
                    >
                      {post.title}
                    </h2>
                  )}

                  {/* Body text */}
                  {post.content && post.content.trim().length > 0 && (
                    <>
                      {flexiblesStatus['flexible-text']?.step === 'full' && (
                        <div
                          ref={(el) => { registerRef('flexible-text')(el); bodyTextRef.current = el; }}
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6]"
                          style={{ fontFamily: 'Inter, sans-serif', lineHeight: 1.55, textAlign: 'left' }}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}
                      {flexiblesStatus['flexible-text']?.step === 'clamped' && (
                        <div
                          ref={(el) => { registerRef('flexible-text')(el); bodyTextRef.current = el; }}
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6]"
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            lineHeight: 1.55,
                            textAlign: 'left',
                            display: '-webkit-box',
                            WebkitLineClamp: Math.max(1, Math.floor(flexiblesStatus['flexible-text'].height / BODY_LINE_HEIGHT_PX)),
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            height: `${flexiblesStatus['flexible-text'].height}px`
                          }}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}
                      {flexiblesStatus['flexible-text']?.step === 'hidden' && (
                        <div ref={registerRef('flexible-text')} style={{ height: 0, overflow: 'hidden' }} />
                      )}
                    </>
                  )}

                  {/* Approfondisci */}
                  {shouldShowApprofondisci && (
                    <div className="flex-shrink-0 mt-2 mb-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                        className="text-sm text-primary font-semibold hover:underline block"
                      >
                        Approfondisci
                      </button>
                    </div>
                  )}

                  {/* Spotify track embed */}
                  {essentialStates['essential-spotify-song'] === 'full' && (
                    hasUserMedia ? (
                      <div ref={registerRef('essential-spotify-song')} className="flex-shrink-0 mt-auto text-left w-full">
                        <a
                          href={post.shared_url || ''}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex h-9 items-center gap-1.5 bg-[#1DB954] px-4 rounded-full text-white"
                        >
                          <span className="text-white text-xs font-bold">🎵 Ascolta su Spotify</span>
                        </a>
                      </div>
                    ) : (
                      <div ref={registerRef('essential-spotify-song')} className="flex-shrink-0 mt-auto w-full">
                        <SpotifyPodcastCompactCard
                          imageUrl={articlePreview?.image || post.preview_img || ''}
                          podcastName={articlePreview?.description || 'Spotify'}
                          episodeTitle={decodeHTMLEntities(articlePreview?.title || post.shared_title || '')}
                          spotifyUrl={post.shared_url || ''}
                        />
                      </div>
                    )
                  )}

                  {essentialStates['essential-spotify-song'] === 'pill' && (
                    <div ref={registerRef('essential-spotify-song')} className="flex-shrink-0 mt-auto" style={{ height: '36px' }}>
                      <a
                        href={post.shared_url || ''}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-9 items-center gap-1.5 bg-[#1DB954] px-4 rounded-full"
                      >
                        <span className="text-white text-xs font-bold">🎵 Ascolta su Spotify</span>
                      </a>
                    </div>
                  )}
                </div>
              ) : isGenericArticle ? (
                <div
                  className={cn(
                    "flex-1 min-h-0 flex flex-col justify-start w-full",
                    emergencyScroll && "overflow-y-auto"
                  )}
                >
                  {/* Title */}
                  {post.title && post.title.trim().length > 0 && (
                    <h2
                      ref={registerRef('essential-title')}
                      className="uppercase mb-2 flex-shrink-0"
                      style={{
                        fontFamily: 'Impact, sans-serif',
                        fontSize: 'clamp(30px, 8vw, 42px)',
                        lineHeight: 0.92,
                        letterSpacing: '-0.02em',
                        color: '#FFFFFF',
                        textAlign: 'left'
                      }}
                    >
                      {post.title}
                    </h2>
                  )}

                  {/* Body text */}
                  {post.content && post.content.trim().length > 0 && (
                    <>
                      {flexiblesStatus['flexible-text']?.step === 'full' && (
                        <div
                          ref={(el) => { registerRef('flexible-text')(el); bodyTextRef.current = el; }}
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6]"
                          style={{ fontFamily: 'Inter, sans-serif', lineHeight: 1.55, textAlign: 'left' }}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}
                      {flexiblesStatus['flexible-text']?.step === 'clamped' && (
                        <div
                          ref={(el) => { registerRef('flexible-text')(el); bodyTextRef.current = el; }}
                          className="whitespace-pre-wrap break-words mb-3 text-[14px] text-[#7A8FA6]"
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            lineHeight: 1.55,
                            textAlign: 'left',
                            display: '-webkit-box',
                            WebkitLineClamp: Math.max(1, Math.floor(flexiblesStatus['flexible-text'].height / BODY_LINE_HEIGHT_PX)),
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            height: `${flexiblesStatus['flexible-text'].height}px`
                          }}
                        >
                          <MentionText content={post.content} />
                        </div>
                      )}
                      {flexiblesStatus['flexible-text']?.step === 'hidden' && (
                        <div ref={registerRef('flexible-text')} style={{ height: 0, overflow: 'hidden' }} />
                      )}
                    </>
                  )}

                  {/* Approfondisci */}
                  {shouldShowApprofondisci && (
                    <div className="flex-shrink-0 mt-2 mb-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                        className="text-sm text-primary font-semibold hover:underline block"
                      >
                        Approfondisci
                      </button>
                    </div>
                  )}

                  {/* Embed content */}
                  {essentialStates['essential-article'] === 'full' && (
                    <div ref={registerRef('essential-article')} className="w-full mt-auto flex-shrink-0">
                      {isEditorialFocus ? (
                        <QuotedEditorialCard
                          title={decodeHTMLEntities(post.shared_title || 'Il Punto')}
                          summary={(() => {
                            const raw = post.article_content || '';
                            const cleaned = raw.replace(/\[SOURCE:[\d,\s]+\]/g, '').trim();
                            if (cleaned.length > 20) return cleaned.substring(0, 260).trim() + '…';
                            if (editorialSummary) return editorialSummary.substring(0, 260).trim() + '…';
                            return undefined;
                          })()}
                          onClick={() => {
                            const focusId = post.shared_url?.replace('focus://daily/', '');
                            if (focusId) navigate(`/?focus=${focusId}`);
                          }}
                          trustScore={{ band: 'ALTO', score: 90 }}
                        />
                      ) : (
                        <div
                          className="cursor-pointer active:scale-[0.98] transition-transform w-full flex flex-col items-start"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (post.shared_url) {
                              window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                            }
                          }}
                        >
                           {(articlePreview?.image || post.preview_img) && !hasUserMedia && (
                            <div className="w-full h-[140px] flex items-center justify-center mb-3 overflow-hidden rounded-xl">
                              <SourceImageWithFallback
                                src={articlePreview?.image || post.preview_img}
                                sharedUrl={post.shared_url}
                                isIntent={post.is_intent}
                                trustScore={displayTrustScore}
                                hideOverlay={true}
                                platform={articlePreview?.platform}
                                hostname={getHostnameFromUrl(post.shared_url)}
                                className="h-full w-full object-cover rounded-xl"
                              />
                            </div>
                          )}

                          <div className="w-12 h-1 bg-slate-200 dark:bg-white/30 rounded-full mb-3 shrink-0" />
                          
                          <div className="mb-2 shrink-0 text-left w-full">
                            <p className="text-base font-semibold text-slate-900 dark:text-white/90 leading-snug line-clamp-2">
                              {decodeHTMLEntities(articlePreview?.title || post.shared_title || getHostnameFromUrl(post.shared_url))}
                            </p>
                          </div>

                          <div className="flex items-center text-slate-500 dark:text-white/70 mb-1 gap-2 shrink-0">
                            <ExternalLink className="w-3 h-3" />
                            <span className="uppercase font-bold tracking-widest text-[10px]">
                              {getHostnameFromUrl(post.shared_url)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {essentialStates['essential-article'] === 'compact' && (
                    <div ref={registerRef('essential-article')} className="w-full mt-auto flex-shrink-0">
                      <div 
                        className="flex flex-row items-center gap-2 bg-[rgba(255,255,255,0.06)] rounded-[8px] p-[8px_10px] w-full cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isEditorialFocus) {
                            const focusId = post.shared_url?.replace('focus://daily/', '');
                            if (focusId) navigate(`/?focus=${focusId}`);
                          } else if (post.shared_url) {
                            window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                          }
                        }}
                      >
                        {!hasUserMedia && (
                          <div className="w-[48px] h-[48px] rounded-[6px] bg-[rgba(255,255,255,0.06)] shrink-0 flex items-center justify-center overflow-hidden">
                            {isEditorialFocus ? (
                              <img src="/logo.png" alt="Il Punto" className="w-8 h-8 object-contain opacity-80" />
                            ) : (articlePreview?.image || post.preview_img) ? (
                              <img src={articlePreview?.image || post.preview_img} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ExternalLink className="w-5 h-5 text-white/40" />
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-sans text-[11px] font-semibold text-white line-clamp-2 leading-tight">
                            {isEditorialFocus 
                              ? decodeHTMLEntities(post.shared_title || 'Il Punto')
                              : decodeHTMLEntities(articlePreview?.title || post.shared_title || getHostnameFromUrl(post.shared_url))
                            }
                          </p>
                          <p className="font-sans text-[9px] text-[rgba(255,255,255,0.4)] mt-[2px] truncate">
                            {isEditorialFocus ? '@ilpunto' : getHostnameFromUrl(post.shared_url)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {essentialStates['essential-article'] === 'pill' && (
                    <div ref={registerRef('essential-article')} className="flex-shrink-0 mt-auto" style={{ height: '36px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isEditorialFocus) {
                            const focusId = post.shared_url?.replace('focus://daily/', '');
                            if (focusId) navigate(`/?focus=${focusId}`);
                          } else if (post.shared_url) {
                            window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        className="inline-flex h-9 items-center gap-1.5 bg-[#0A7AFF] hover:bg-[#0A7AFF]/90 px-4 rounded-full"
                      >
                        <span className="text-white text-xs font-bold">📰 Leggi articolo</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : isInstagramReel ? (
                <div
                  className={cn(
                    "flex-1 min-h-0 flex flex-col items-center justify-start w-full px-4 pr-[80px] gap-3",
                    emergencyScroll && "overflow-y-auto"
                  )}
                >
                  {/* Title */}
                  {post.title && post.title.trim().length > 0 ? (
                    <h2
                      ref={registerRef('essential-title')}
                      className="uppercase mb-2 flex-shrink-0 self-start text-left"
                      style={{
                        fontFamily: 'Impact, sans-serif',
                        fontSize: 'clamp(30px, 8vw, 42px)',
                        lineHeight: 0.92,
                        letterSpacing: '-0.02em',
                        color: '#FFFFFF',
                        textAlign: 'left'
                      }}
                    >
                      {post.title}
                    </h2>
                  ) : (
                    <h2
                      ref={registerRef('essential-title')}
                      className="text-xl font-bold text-immersive-foreground leading-tight mt-1 mb-2 flex-shrink-0 self-start text-left"
                    >
                      {decodeHTMLEntities(articlePreview?.title || post.shared_title || 'Instagram Reel')}
                    </h2>
                  )}

                  {/* User Comment — flessibile */}
                  {post.content && post.content.trim().length > 0 && flexiblesStatus['flexible-user-comment']?.step !== 'hidden' && (
                    <p 
                      ref={(el) => { registerRef('flexible-user-comment')(el); bodyTextRef.current = el; }}
                      className={cn(
                        "self-start text-sm text-white/90 leading-relaxed mb-3 text-left flex-shrink-0 w-full",
                        flexiblesStatus['flexible-user-comment']?.step === 'compact' ? "line-clamp-2" : "line-clamp-4"
                      )}
                    >
                      <MentionText content={post.content} />
                    </p>
                  )}



                  {/* Caption — flessibile */}
                  {flexiblesStatus['flexible-text']?.step !== 'hidden' && post.shared_title && (
                    <p 
                      ref={(el) => { registerRef('flexible-text')(el); captionTextRef.current = el; }}
                      className={cn(
                        "self-start text-sm text-white/80 leading-relaxed mb-3 text-left flex-shrink-0 w-full",
                        flexiblesStatus['flexible-text']?.step === 'compact' ? "line-clamp-2" : "line-clamp-4"
                      )}
                    >
                      <MentionText content={post.shared_title} />
                    </p>
                  )}

                  {/* Approfondisci */}
                  {shouldShowApprofondisci && (
                    <div className="flex-shrink-0 mt-2 mb-3 text-left self-start">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                        className="text-sm font-semibold hover:underline block text-[#E1306C]"
                      >
                        Approfondisci
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Quoted Post - Show for ALL reshares (stack and non-stack) */}
              {quotedPost && (
                <div className="mt-0.5">
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


              {/* Poll Widget - inside content rail */}
              {pollData && (
                <div className="mt-6">
                  <PollWidget poll={pollData} postId={post.id} />
                </div>
              )}

            </div>




          </div>

          {/* Bottom Actions - Single horizontal axis alignment */}
          {/* [Rail 3] ActionRail: Fixed bottom overlay with gradient fade */}
          <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
            <div className="flex items-center justify-between gap-6 pb-[calc(4rem+env(safe-area-inset-bottom)+36px)] pt-4 pointer-events-auto">

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
              className="h-11 px-5 bg-blue-50 hover:bg-blue-100 dark:bg-white dark:hover:bg-gray-200 text-blue-600 dark:text-[#1F3347] rounded-full shadow-sm dark:shadow-md border border-blue-100 dark:border-transparent flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Logo variant="icon" className="w-5 h-5 object-contain" />
              <span className="text-sm font-medium leading-none">Condividi</span>
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
          </div>
          {/* TikTok-style lateral play button + REEL badge for Reel */}
          {isInstagramReel && (
            <div 
              className="absolute right-4 z-30 flex flex-col items-center gap-2 pointer-events-auto"
              style={{ bottom: '170px' }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(post.shared_url || '', '_blank', 'noopener,noreferrer');
                }}
                className="w-14 h-14 rounded-full bg-white shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                aria-label="Apri su Instagram"
              >
                <Play className="w-6 h-6 text-black fill-black ml-0.5" />
              </button>
              <div 
                className="px-2.5 py-1 rounded-full text-[9px] font-bold text-white tracking-wider whitespace-nowrap shadow-md select-none"
                style={{ background: 'linear-gradient(135deg, #833AB4 0%, #FD1D1D 60%, #F77737 100%)' }}
              >
                REEL
              </div>
            </div>
          )}
          </div>
        </div>
      </div >

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
          showModeToggle={isVoicePost}
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
          imageUrl={
            isVoicePost || isChallengePost
              ? (post.media?.[0]?.url || post.preview_img || undefined)
              : undefined
          }
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
            ) : !isSpotifyTrack && !isTwitter && !isLinkedIn && !isYoutube && hasLink && post.shared_url ? (
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

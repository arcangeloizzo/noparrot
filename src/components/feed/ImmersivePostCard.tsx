import { useState, useEffect, useRef, useMemo, memo } from "react";
import { perfStore } from "@/lib/perfStore";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Trash2, ExternalLink, Quote, ShieldCheck, Maximize2, Play } from "lucide-react";
import { AnimatedHeart } from "@/components/ui/animated-heart";
import { useDominantColors } from "@/hooks/useDominantColors";
import { useCachedTrustScore } from "@/hooks/useCachedTrustScore";
import { useArticlePreview } from "@/hooks/useArticlePreview";
import { useTrustScore } from "@/hooks/useTrustScore";
import { useFeedContext } from "@/components/feed/ImmersiveFeedContainer";
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
import { CategoryChip } from "@/components/ui/category-chip";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuizModal } from "@/components/ui/quiz-modal";

// Feed Components
import { QuotedPostCard } from "./QuotedPostCard";
import { QuotedEditorialCard } from "./QuotedEditorialCard";
import { MentionText } from "./MentionText";
import { ReshareContextStack } from "./ReshareContextStack";
import { SpotifyGradientBackground } from "./SpotifyGradientBackground";
import { SourceImageWithFallback } from "./SourceImageWithFallback";
import { FullTextModal } from "./FullTextModal";

// Media Components
import { MediaGallery } from "@/components/media/MediaGallery";
import { MediaViewer } from "@/components/media/MediaViewer";

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
import { cn, getDisplayUsername } from "@/lib/utils";
import { fetchTrustScore } from "@/lib/comprehension-gate";
import { generateQA, fetchArticlePreview } from "@/lib/ai-helpers";
import { supabase } from "@/integrations/supabase/client";
import { uniqueSources } from "@/lib/url";
import { useCreateThread } from "@/hooks/useMessageThreads";
import { useSendMessage } from "@/hooks/useMessages";
import { getWordCount, getTestModeWithSource, getQuestionCountWithoutSource, getQuestionCountForIntentReshare } from "@/lib/gate-utils";
import { useDoubleTap } from "@/hooks/useDoubleTap";
import { useReshareContextStack } from "@/hooks/useReshareContextStack";
import { useOriginalSource } from "@/hooks/useOriginalSource";
import { haptics } from "@/lib/haptics";
import { addBreadcrumb } from "@/lib/crashBreadcrumbs";
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
  /** Open comments drawer automatically when navigating from notifications */
  initialOpenComments?: boolean;
  /** Scroll to specific comment when opening drawer */
  scrollToCommentId?: string;
  /** Index of this card in the feed */
  index?: number;
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
    // youtube.com/watch?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com')) {
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
  initialOpenComments = false,
  scrollToCommentId,
  index = 0
}: ImmersivePostCardProps) => {
  // Track renders via ref increment (no useEffect deps issue)
  const renderCountRef = useRef(0);
  renderCountRef.current++;
  if (perfStore.getState().enabled) {
    perfStore.incrementPostCard();
  }
  const { user } = useAuth();
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

  // Image gating: only load images for cards near the active index
  const { activeIndex } = useFeedContext();
  const isNearActive = Math.abs(index - activeIndex) <= 1;
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
  const [shareAction, setShareAction] = useState<'feed' | 'friend' | null>(null);

  // Editorial summary fallback (for legacy posts without article_content)
  const [editorialSummary, setEditorialSummary] = useState<string | null>(null);

  // Full text modal for long posts
  const [showFullText, setShowFullText] = useState(false);

  // Caption expansion state for long Instagram/social captions
  const [showFullCaption, setShowFullCaption] = useState(false);
  const CAPTION_TRUNCATE_LENGTH = 120;

  // Reactions sheet state
  const [showReactionsSheet, setShowReactionsSheet] = useState(false);

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
  const effectiveSharedTitle = post.shared_title || quotedPost?.shared_title;

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
  const finalSourceMedia = post.media?.length ? post.media : (quotedPost?.media?.length ? quotedPost.media : originalSource?.media);

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
  const displayTrustScore = cachedTrustScore || calculatedTrustScore;

  // Reaction picker state
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const likeButtonRef = useRef<HTMLButtonElement>(null);

  const handleHeart = (e?: React.MouseEvent, reactionType: ReactionType | 'heart' = 'heart') => {
    e?.stopPropagation();
    haptics.light();
    // For like reactions, always use 'heart' as the base type for posts
    toggleReaction.mutate({ postId: post.id, reactionType: reactionType as any });
  };

  // Drag position state for reaction picker
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);

  // Long press handlers for like button with drag-to-select
  const likeButtonHandlers = useLongPress({
    onLongPress: () => setShowReactionPicker(true),
    onTap: () => {
      // Se esiste una reaction, usala per il toggle (rimuove)
      // Altrimenti usa 'heart' per aggiungere un nuovo like
      const currentType = post.user_reactions?.myReactionType || 'heart';
      handleHeart(undefined, currentType);
    },
    onMove: (x, y) => setDragPosition({ x, y }),
    onRelease: () => setDragPosition(null),
  });

  // Blocca scroll del feed quando il reaction picker è aperto
  useEffect(() => {
    if (showReactionPicker) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      return () => {
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
      };
    }
  }, [showReactionPicker]);

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

    const userText = post.content;
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

    const userText = post.content;
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

  let userText = post.content;
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
      const userText = intentPost?.content || '';
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
    const userText = post.content;
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
const hasMedia = (post.media && post.media.length > 0) || (quotedPost?.media && quotedPost.media.length > 0);
const hasLink = !!post.shared_url;
const isSpotify = articlePreview?.platform === 'spotify';
const isTwitter = articlePreview?.platform === 'twitter' || detectPlatformFromUrl(post.shared_url || '') === 'twitter';
const isLinkedIn = articlePreview?.platform === 'linkedin' || detectPlatformFromUrl(post.shared_url || '') === 'linkedin';
const isYoutube = articlePreview?.platform === 'youtube' ||
  (post.shared_url?.includes('youtube.com') || post.shared_url?.includes('youtu.be'));
const isMediaOnlyPost = hasMedia && !hasLink;
const mediaUrl = post.media?.[0]?.url || quotedPost?.media?.[0]?.url;
const isVideoMedia = post.media?.[0]?.type === 'video' || quotedPost?.media?.[0]?.type === 'video';
const backgroundImage = !isMediaOnlyPost ? (articlePreview?.image || post.preview_img || (hasMedia && (post.media?.[0]?.url || quotedPost?.media?.[0]?.url))) : undefined;
// Ensure text-only really means NO media and NO link in either post
const isTextOnly = !hasMedia && !hasLink && !quotedPost?.shared_url;
const isIntentPost = !!post.is_intent;
const articleTitle = articlePreview?.title || post.shared_title || '';
// Show user text ONLY if it's genuinely different from title AND extracted content
const shouldShowUserText = hasLink && post.content &&
  !isTextSimilarToTitle(post.content, articleTitle) &&
  !isTextSimilarToArticleContent(post.content, articlePreview);

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

return (
  <>
    <div
      className="h-[100dvh] w-full snap-start relative flex flex-col p-6 overflow-hidden bg-immersive transition-colors duration-500"
      onClick={handleDoubleTap}
    >
      {/* Background Layer */}
      {isMediaOnlyPost && mediaUrl ? (
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
          <div className="absolute inset-0 opacity-[0.08] mix-blend-overlay urban-noise-overlay" />
          <div className="absolute inset-0 bg-noparrot-blue/5 pointer-events-none" />
        </div>
      ) : isSpotify ? (
        <SpotifyGradientBackground
          albumArtUrl={articlePreview?.image || post.preview_img || ''}
          audioFeatures={articlePreview?.audioFeatures}
        />
      ) : isTwitter ? (
        <div className="absolute inset-0 bg-gradient-to-b from-[#1DA1F2]/5 via-white to-slate-100 dark:from-[#15202B] dark:via-[#192734] dark:to-[#0d1117]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1DA1F2]/5 to-transparent dark:from-[#1DA1F2]/10" />
        </div>
      ) : isLinkedIn ? (
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A66C2]/10 via-white to-slate-100 dark:from-[#0A66C2]/20 dark:via-[#1a1a2e] dark:to-[#0d1117]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A66C2]/10 to-transparent dark:from-[#0A66C2]/15" />
        </div>
      ) : (
        <>
          {/* Blurred background image - behind everything */}
          {backgroundImage && shouldLoadImages && (
            <img
              src={backgroundImage}
              className="absolute inset-0 w-full h-full object-cover opacity-[0.05] blur-2xl scale-110 dark:opacity-60 transition-opacity duration-500"
              alt=""
              loading="lazy"
            />
          )}
          {/* Gradient overlay on top of image, or solid color if no image */}
          {/* Gradient overlay on top of image, or solid color if no image */}
          {/* Gradient overlay on top of image, or solid color if no image */}
          <div className={cn(
            "absolute inset-0 transition-colors duration-500",
            backgroundImage ? "bg-gradient-to-b from-transparent via-transparent to-transparent dark:from-black/40 dark:via-black/20 dark:to-black/80" : "bg-immersive"
          )}>
            {/* Light mode specific gradient: much lighter/transparent */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-transparent dark:from-black/40 dark:via-black/20 dark:to-black/80" />
          </div>
        </>
      )}

      {/* Urban texture overlay - applied to all backgrounds (GPU-friendly static PNG) */}
      <div className="absolute inset-0 z-[1] opacity-[0.025] pointer-events-none mix-blend-overlay urban-noise-overlay" />

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
      <div className="relative z-10 w-full h-full flex flex-col">

        {/* Top Bar */}

        {/* [Rail 1] HeaderRail: Fixed top, stable height, no shrinking */}
        <div className="flex justify-between items-start flex-shrink-0 pt-[calc(env(safe-area-inset-top)+42px)] px-5 pb-2 z-50">
          {/* Author */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${post.author.id}`);
            }}
          >
            <div className="w-10 h-10 rounded-full border border-white/20 bg-white/10 overflow-hidden shadow-lg">
              {getAvatarContent()}
            </div>
            <div className="flex flex-col">
              <span className="text-slate-900 dark:text-white font-bold text-sm drop-shadow-none dark:drop-shadow-md">
                {post.author.full_name || getDisplayUsername(post.author.username)}
              </span>
              <span className="text-slate-500 dark:text-gray-400 text-xs">{timeAgo}</span>
            </div>
          </div>

          {/* PULSE Badge for Spotify / Trust Score / Category - Hide Trust Score for editorial shares (shown in card) */}
          {hasLink && isSpotify && articlePreview?.popularity !== undefined ? (
            <PulseBadge
              popularity={articlePreview.popularity}
              size="sm"
            />
          ) : hasLink && (post.is_intent || (post as any).verified_by === 'user_intent') && !post.shared_url?.startsWith('focus://') ? (
            <UnanalyzableBadge />
          ) : hasLink && displayTrustScore && !post.shared_url?.startsWith('focus://') ? (
            <Dialog>
              <DialogTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "flex items-center gap-1.5 bg-slate-100 border border-slate-200 dark:bg-black/30 dark:border-white/10 px-3 py-1.5 rounded-full cursor-pointer hover:bg-slate-200 dark:hover:bg-black/40 transition-colors shadow-sm dark:shadow-xl",
                    displayTrustScore.band === 'ALTO' && "text-emerald-600 dark:text-emerald-400",
                    displayTrustScore.band === 'MEDIO' && "text-amber-600 dark:text-amber-400",
                    displayTrustScore.band === 'BASSO' && "text-red-600 dark:text-red-400"
                  )}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[10px] font-bold tracking-wider uppercase">
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

          {/* Menu */}
          {isOwnPost && (
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
          )}
        </div>

        {/* Center Content */}
        {/* [Rail 2] ContentRail: Adaptive height, clips overflow, no scroll */}
        <div className="flex-1 min-h-0 relative flex flex-col px-4 overflow-hidden">
          <div className="w-full my-auto flex flex-col max-h-full">

            {/* Stack Layout: User comment first - Plain text for standard */}
            {useStackLayout && post.content && post.content !== post.shared_title && (
              <div className="text-base sm:text-lg font-normal text-slate-600 dark:text-white/90 leading-snug tracking-wide drop-shadow-none dark:drop-shadow-md mb-4 px-1">
                {post.content.length > 400 ? (
                  <>
                    <MentionText content={post.content.slice(0, 400) + '...'} />
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                      className="mt-2 text-sm text-primary font-semibold hover:underline block"
                    >
                      Mostra tutto
                    </button>
                  </>
                ) : (
                  <MentionText content={post.content} />
                )}
              </div>
            )}

            {/* Intent Post (non-stack): Quote Block style for posts with is_intent flag */}
            {!useStackLayout && post.is_intent && post.content && (
              <div className="border-l-4 border-primary/60 bg-card/10 px-3 sm:px-4 py-2 sm:py-3 rounded-r-lg mb-4 sm:mb-6">
                <p className="text-base sm:text-lg font-normal text-slate-600 dark:text-white/90 leading-snug tracking-wide drop-shadow-md">
                  <MentionText content={post.content} />
                </p>
              </div>
            )}

            {/* Stack Layout: show context stack (reshare chain) for ALL reshares except Intent posts */}
            {quotedPost && contextStack.length > 0 && !isQuotedIntentPost && (
              <ReshareContextStack stack={contextStack} />
            )}

            {/* User Text Content - Show for link posts (if different from article title) - NON stack layout */}
            {/* User Text - Skip for intent posts (already rendered above) */}
            {!useStackLayout && shouldShowUserText && !post.is_intent && (
              post.content.length > 400 ? (
                <div className="mb-4 flex-shrink-0">
                  <h2 className="text-lg font-normal text-slate-600 dark:text-white/90 leading-snug tracking-wide drop-shadow-md line-clamp-3">
                    <MentionText content={post.content} />
                  </h2>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                    className="mt-1 text-sm text-primary font-semibold hover:underline"
                  >
                    Mostra tutto
                  </button>
                </div>
              ) : (
                <h2 className="text-lg font-normal text-slate-600 dark:text-white/90 leading-snug tracking-wide drop-shadow-none dark:drop-shadow-md mb-4 line-clamp-4 flex-shrink-0">
                  <MentionText content={post.content} />
                </h2>
              )
            )}

            {/* User Text for normal reshares (long quoted comment, no source): show current user's comment ABOVE the QuotedPostCard */}
            {!useStackLayout && quotedPost && !hasLink && post.content && (
              post.content.length > 400 ? (
                <div className="mb-6">
                  <h2 className="text-lg font-normal text-slate-600 dark:text-white/90 leading-snug tracking-wide drop-shadow-md">
                    <MentionText content={post.content.slice(0, 400) + '...'} />
                  </h2>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                    className="mt-2 text-sm text-primary font-semibold hover:underline"
                  >
                    Mostra tutto
                  </button>
                </div>
              ) : (
                <h2 className="text-lg font-normal text-slate-600 dark:text-white/90 leading-snug tracking-wide drop-shadow-md mb-6">
                  <MentionText content={post.content} />
                </h2>
              )
            )}

            {/* Pure Text-Only Posts - Immersive editorial-style card - Hide if using stack layout */}
            {!useStackLayout && isTextOnly && post.content && (
              <div className="relative w-full max-w-lg mx-auto">
                {/* Card container with glassmorphism and urban texture - GPU optimized */}
                <div className="relative immersive-card rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">

                  {/* Urban texture overlay - static PNG */}
                  <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay rounded-3xl urban-noise-overlay" />

                  {/* Decorative quote mark */}
                  <div className="absolute top-4 left-5 text-immersive-foreground/10 text-[80px] font-serif leading-none pointer-events-none select-none">"</div>

                  {/* Content */}
                  <div className="relative z-10">
                    {post.content.length > 400 ? (
                      <>
                        <p className="text-[17px] sm:text-lg font-normal text-immersive-foreground leading-[1.65] tracking-[0.01em] whitespace-pre-wrap">
                          <MentionText content={post.content.slice(0, 400) + '...'} />
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                          className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary/90 font-semibold hover:text-primary transition-colors"
                        >
                          <span>Mostra tutto</span>
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <p className="text-[17px] sm:text-lg font-normal text-immersive-foreground leading-[1.65] tracking-[0.01em] whitespace-pre-wrap">
                        <MentionText content={post.content} />
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* User Text for media-only posts - ABOVE the media */}
            {!useStackLayout && isMediaOnlyPost && post.content && (
              <div className="mb-6">
                <h2 className="text-xl font-medium text-immersive-foreground leading-snug tracking-wide drop-shadow-lg">
                  <MentionText content={post.content.length > 200 ? post.content.slice(0, 200) + '...' : post.content} />
                </h2>
                {post.content.length > 200 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                    className="mt-2 text-sm text-primary font-semibold hover:underline"
                  >
                    Mostra tutto
                  </button>
                )}
              </div>
            )}

            {/* Framed Media Window for media-only posts - Hide if using stack layout */}
            {!useStackLayout && isMediaOnlyPost && post.media && post.media.length > 0 && (
              post.media.length === 1 ? (
                /* Single media: flexible adaptive layout */
                <button
                  role="button"
                  aria-label={isVideoMedia ? "Riproduci video" : "Apri immagine"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMediaIndex(0);
                  }}
                  className="relative flex-1 min-h-0 flex items-center justify-center w-full px-1 py-1 active:scale-[0.98] transition-transform overflow-hidden"
                >
                  {isVideoMedia ? (
                    <>
                      <img
                        src={post.media?.[0]?.thumbnail_url || mediaUrl}
                        alt=""
                        className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
                      />
                      {/* Play icon overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white/90 backdrop-blur-sm p-4 rounded-full shadow-xl">
                          <Play className="w-8 h-8 text-black fill-black" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <img
                        src={mediaUrl}
                        alt=""
                        className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
                      />
                      {/* Expand pill with label */}
                      <div className="absolute bottom-4 right-4 bg-black/80 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <Maximize2 className="w-3.5 h-3.5 text-white" />
                        <span className="text-xs font-medium text-white">Apri</span>
                      </div>
                    </>
                  )}
                </button>
              ) : (
                /* Multi-media: adaptive gallery */
                <div className="flex-1 min-h-0 w-full flex flex-col justify-center overflow-hidden px-1">
                  <MediaGallery
                    media={post.media}
                    onClick={(_, index) => setSelectedMediaIndex(index)}
                    initialIndex={carouselIndex}
                    onIndexChange={setCarouselIndex}
                    className="h-full w-full object-contain"
                  />
                </div>
              )
            )}

            {/* Twitter/X Card - Unified glassmorphic container */}
            {hasLink && isTwitter ? (
              <div className="flex-1 min-h-0 flex flex-col justify-center w-full max-w-md mx-auto px-1">
                {/* Unified Twitter Card - Author + Content in one container */}
                <div
                  className="bg-gradient-to-br from-[#1DA1F2]/5 to-white/90 dark:from-[#15202B] dark:to-[#0d1117] rounded-3xl p-5 border border-black/5 dark:border-white/15 shadow-xl dark:shadow-2xl cursor-pointer active:scale-[0.98] transition-transform flex flex-col max-h-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (post.shared_url) {
                      window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                >
                  {/* Author Row - Fixed height */}
                  <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                    <div className="w-12 h-12 rounded-full border border-white/20 overflow-hidden bg-[#1DA1F2]/10 flex-shrink-0">
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
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-white font-semibold truncate">
                          {articlePreview?.author_name || articlePreview?.title?.replace('Post by ', '').replace('@', '') || 'X User'}
                        </p>
                        {/* Verification Badge - Filled circle with checkmark */}
                        {articlePreview?.is_verified && (
                          <div className="flex-shrink-0 w-[18px] h-[18px] rounded-full bg-[#1DA1F2] flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {articlePreview?.author_username && (
                        <p className="text-white/50 text-sm">@{articlePreview.author_username}</p>
                      )}
                    </div>
                    {/* X Logo */}
                    <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                      <span className="text-black font-bold text-xs">𝕏</span>
                    </div>
                  </div>

                  {/* Tweet Text - cleaned and clamped - Flexible */}
                  <div className="flex-shrink-0 min-h-0 overflow-hidden mb-4">
                    <p className="text-slate-900 dark:text-white text-base leading-relaxed line-clamp-4">
                      {(articlePreview?.content || articlePreview?.summary || post.content || '')
                        .replace(/https?:\/\/t\.co\/\w+/g, '')
                        .replace(/https?:\/\/[^\s]+/g, '')
                        .replace(/\s{2,}/g, ' ')
                        .trim()}
                    </p>
                  </div>

                  {/* Tweet Media (if any) - Flexible height */}
                  {articlePreview?.image && (
                    <div className="flex-1 min-h-0 rounded-xl overflow-hidden relative">
                      <img
                        src={articlePreview.image}
                        alt=""
                        className="w-full h-full object-cover absolute inset-0"
                      />
                    </div>
                  )}
                </div>

                {/* Open on X CTA - Below the card - Fixed */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (post.shared_url) {
                      window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className="mt-3 mx-auto flex items-center gap-2 text-immersive-muted hover:text-immersive-foreground transition-colors flex-shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="text-xs uppercase tracking-wider">Apri su X</span>
                </button>
              </div>
            ) : hasLink && isLinkedIn ? (
              /* LinkedIn Card - Professional styling */
              <div className="w-full max-w-md mx-auto mt-2 sm:mt-6 flex-shrink min-h-0 flex flex-col justify-center">
                {/* Unified LinkedIn Card */}
                <div
                  className="bg-gradient-to-br from-[#0A66C2]/10 to-white/90 dark:from-[#0A66C2]/20 dark:to-[#1a1a2e]/95 backdrop-blur-xl rounded-3xl p-4 sm:p-5 border border-black/5 dark:border-white/15 shadow-[0_12px_48px_rgba(0,0,0,0.1),_0_0_16px_rgba(10,102,194,0.1)] dark:shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_16px_rgba(10,102,194,0.15)] cursor-pointer active:scale-[0.98] transition-transform max-h-full flex flex-col"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (post.shared_url) {
                      window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                >
                  {/* Author Row */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full border border-white/20 overflow-hidden bg-[#0A66C2]/20 flex-shrink-0 flex items-center justify-center">
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
                        <span className="text-white/70 text-xl font-bold">
                          {(() => {
                            // Get first letter of author name
                            const author = articlePreview?.author ||
                              (articlePreview?.title || '')
                                .replace(/\s*[|\-–]\s*LinkedIn.*$/i, '')
                                .replace(/^Post di\s+/i, '')
                                .replace(/^Post by\s+/i, '')
                                .split(/\s*[|\-–]\s*/)[0]
                                .trim();
                            return (author || 'L').charAt(0).toUpperCase();
                          })()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">
                        {articlePreview?.author ||
                          (articlePreview?.title || '')
                            .replace(/\s*[|\-–]\s*LinkedIn.*$/i, '')
                            .replace(/^Post di\s+/i, '')
                            .replace(/^Post by\s+/i, '')
                            .split(/\s*[|\-–]\s*/)[0]
                            .trim() ||
                          'LinkedIn User'}
                      </p>
                      <p className="text-white/50 text-sm">su LinkedIn</p>
                    </div>
                  </div>

                  {/* Post Text - cleaned and clamped */}
                  <p className="text-white text-base leading-relaxed mb-2 sm:mb-4 line-clamp-3 sm:line-clamp-4 flex-shrink">
                    {(articlePreview?.content || articlePreview?.description || articlePreview?.summary || '')
                      .replace(/https?:\/\/[^\s]+/g, '')
                      .replace(/\s{2,}/g, ' ')
                      .trim() ||
                      (articlePreview?.title || '')
                        .replace(/\s*[|\-–]\s*LinkedIn.*$/i, '')
                        .replace(/^Post di\s+/i, '')
                        .replace(/^Post by\s+/i, '')
                        .trim()}
                  </p>

                  {/* Post Image (if any) */}
                  {(articlePreview?.image || post.preview_img) && (
                    <div className="rounded-xl overflow-hidden flex-shrink min-h-0">
                      <img
                        src={articlePreview?.image || post.preview_img}
                        alt=""
                        className="w-full h-auto max-h-24 sm:max-h-40 object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Open on LinkedIn CTA - Below the card */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (post.shared_url) {
                      window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className="mt-3 mx-auto flex items-center gap-2 text-white/50 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="text-xs uppercase tracking-wider">Apri su LinkedIn</span>
                </button>
              </div>
            ) : hasLink && isYoutube ? (
              /* YouTube Video Card - Tap to play */
              <div className="w-full max-w-md mx-auto mt-4">
                {!youtubeEmbedActive ? (
                  /* Thumbnail with Play button */
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setYoutubeEmbedActive(true);
                    }}
                    className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_16px_rgba(255,0,0,0.1)] active:scale-[0.98] transition-transform"
                  >
                    {/* Video Thumbnail */}
                    <img
                      src={articlePreview?.image || post.preview_img || `https://img.youtube.com/vi/${extractYoutubeVideoId(post.shared_url!)}/maxresdefault.jpg`}
                      alt=""
                      className="w-full aspect-video max-h-[25vh] sm:max-h-none object-cover"
                    />

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="bg-red-600 p-4 rounded-full shadow-xl">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>

                    {/* YouTube Badge */}
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                        <polygon fill="white" points="9.545,15.568 15.818,12 9.545,8.432" />
                      </svg>
                      <span className="text-white text-xs font-medium">YouTube</span>
                    </div>
                  </button>
                ) : (
                  /* Active YouTube Embed */
                  <div className="w-full rounded-2xl overflow-hidden border border-white/10 shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_16px_rgba(255,0,0,0.1)]">
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

                {/* Video Title */}
                <h1 className="text-xl font-bold text-immersive-foreground leading-tight mt-4 mb-2 drop-shadow-sm">
                  {articlePreview?.title || post.shared_title}
                </h1>

                {/* Open on YouTube CTA */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                  }}
                  className="flex items-center gap-2 text-immersive-muted hover:text-immersive-foreground transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="text-xs uppercase tracking-wider">Apri su YouTube</span>
                </button>
              </div>
            ) : hasLink && isSpotify ? (
              <div
                className="flex-1 min-h-0 flex flex-col items-center justify-center cursor-pointer active:scale-[0.98] transition-transform w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  if (post.shared_url) {
                    window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                {/* Spotify Artwork - Adaptive centered square */}
                {(articlePreview?.image || post.preview_img) && (
                  <div className="flex-1 min-h-0 w-full flex items-center justify-center mb-4">
                    <img
                      src={articlePreview?.image || post.preview_img}
                      alt=""
                      className="max-h-full max-w-full aspect-square object-contain rounded-2xl shadow-xl dark:shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_24px_rgba(30,215,96,0.25)] border border-slate-200 dark:border-white/10"
                    />
                  </div>
                )}

                {/* Spotify Title - Fixed shrink-0 */}
                <h1 className="flex-shrink-0 text-2xl font-bold text-slate-900 dark:text-white leading-tight mb-2 text-center drop-shadow-sm dark:drop-shadow-xl line-clamp-2">
                  {articlePreview?.title || post.shared_title}
                </h1>

                {/* Artist name - Fixed shrink-0 */}
                {articlePreview?.description && (
                  <p className="flex-shrink-0 text-[#1DB954] text-center font-medium mb-4 line-clamp-1">
                    {articlePreview.description}
                  </p>
                )}

                {/* Static Spotify badge - Fixed shrink-0 */}
                <div className="flex flex-shrink-0 justify-center">
                  <div className="flex items-center gap-2 bg-[#1DB954]/20 border border-[#1DB954]/30 px-4 py-2 rounded-full">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1DB954">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                    </svg>
                    <span className="text-[#1DB954] text-xs font-bold uppercase tracking-wider">Spotify</span>
                  </div>
                </div>
              </div>
            ) : hasLink && post.shared_url?.startsWith('focus://') ? (
              /* Editorial Share - Internal navigation, Trust Score always ALTO */
              <QuotedEditorialCard
                title={post.shared_title || 'Il Punto'}
                summary={(() => {
                  // Priority: article_content > editorialSummary (fetched from DB)
                  const raw = post.article_content || '';
                  const cleaned = raw.replace(/\[SOURCE:[\d,\s]+\]/g, '').trim();
                  if (cleaned.length > 20) {
                    return cleaned.substring(0, 260).trim() + '…';
                  }
                  // Use fetched summary from daily_focus
                  if (editorialSummary) {
                    return editorialSummary.substring(0, 260).trim() + '…';
                  }
                  return undefined;
                })()}
                onClick={() => {
                  const focusId = post.shared_url?.replace('focus://daily/', '');
                  if (focusId) {
                    navigate(`/?focus=${focusId}`);
                  }
                }}
                trustScore={{ band: 'ALTO', score: 90 }}
              />
            ) : hasLink && (
              <div className={cn("flex-1 min-h-0 flex flex-col justify-start pt-4 w-full", post.is_intent && "min-h-0")}>
                {isWaitingForPreview && !post.shared_title && !post.preview_img ? (
                  /* Skeleton while loading preview data */
                  <div className="space-y-4 animate-pulse w-full">
                    <div className="w-full aspect-video bg-white/10 rounded-xl" />
                    <div className="w-12 h-1 bg-white/20 rounded-full" />
                    <div className="space-y-2">
                      <div className="h-5 bg-white/10 rounded-lg w-3/4" />
                      <div className="h-5 bg-white/10 rounded-lg w-1/2" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-white/10 rounded" />
                      <div className="h-3 bg-white/10 rounded w-24" />
                    </div>
                  </div>
                ) : (
                  <div
                    className="cursor-pointer active:scale-[0.98] transition-transform w-full flex flex-col items-center justify-start max-h-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (post.shared_url) {
                        window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    {/* Visible Metadata Image - Uses max-h to fit available space */}
                    {!post.is_intent && (
                      <div className="flex-1 min-h-0 w-full flex items-center justify-center mb-4">
                        <SourceImageWithFallback
                          src={articlePreview?.image || post.preview_img}
                          sharedUrl={post.shared_url}
                          isIntent={post.is_intent}
                          trustScore={displayTrustScore}
                          hideOverlay={true}
                          platform={articlePreview?.platform}
                          hostname={getHostnameFromUrl(post.shared_url)}
                          className="max-h-full w-full object-contain rounded-xl"
                        />
                      </div>
                    )}

                    <div className="w-12 h-1 bg-slate-200 dark:bg-white/30 rounded-full mb-4 shrink-0" />
                    {/* Caption/Title with truncation for long social captions */}
                    {(() => {
                      const displayTitle = articlePreview?.title || post.shared_title || getHostnameFromUrl(post.shared_url);
                      const isCaptionLong = displayTitle && displayTitle.length > CAPTION_TRUNCATE_LENGTH;
                      const truncatedCaption = isCaptionLong
                        ? displayTitle.slice(0, CAPTION_TRUNCATE_LENGTH).trim() + '...'
                        : displayTitle;

                      return (
                        <div className="mb-3 shrink-0 text-center w-full" onClick={(e) => e.stopPropagation()}>
                          <p className="text-lg font-medium text-slate-900 dark:text-white/90 leading-relaxed drop-shadow-sm dark:drop-shadow-lg line-clamp-3">
                            {truncatedCaption}
                          </p>
                          {isCaptionLong && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowFullCaption(true);
                              }}
                              className="mt-2 text-sm text-primary font-semibold hover:underline"
                            >
                              Leggi tutto
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    <div className={cn(
                      "flex items-center text-slate-500 dark:text-white/70 mb-4 shrink-0 justify-center",
                      post.is_intent ? "gap-1" : "gap-2"
                    )}>
                      <ExternalLink className={cn(
                        post.is_intent ? "w-2.5 h-2.5" : "w-3 h-3"
                      )} />
                      <span className={cn(
                        "uppercase font-bold tracking-widest",
                        post.is_intent ? "text-[10px]" : "text-xs"
                      )}>
                        {getHostnameFromUrl(post.shared_url)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stack Layout: Source Preview LAST (Media OR Link) - Only show ONE source at bottom */}
            {useStackLayout && (finalSourceUrl || (finalSourceMedia && finalSourceMedia.length > 0)) && (
              <div className="mt-4 flex-1 min-h-[15rem] flex flex-col justify-end">
                {finalSourceUrl?.startsWith('focus://') ? (
                  /* Editorial source */
                  <QuotedEditorialCard
                    title={finalSourceTitle || 'Il Punto'}
                    summary={(() => {
                      const raw = post.article_content || '';
                      const cleaned = raw.replace(/\[SOURCE:[\d,\s]+\]/g, '').trim();
                      if (cleaned.length > 20) return cleaned.substring(0, 260).trim() + '…';
                      if (editorialSummary) return editorialSummary.substring(0, 260).trim() + '…';
                      return undefined;
                    })()}
                    onClick={() => {
                      const focusId = finalSourceUrl.replace('focus://daily/', '');
                      if (focusId) navigate(`/?focus=${focusId}`);
                    }}
                    trustScore={{ band: 'ALTO', score: 90 }}
                  />
                ) : finalSourceMedia && finalSourceMedia.length > 0 ? (
                  /* Media Source (Video/Gallery) */
                  finalSourceMedia.length === 1 ? (
                    /* Single media: fill available space */
                    <button
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMediaIndex(0);
                      }}
                      className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
                    >
                      {finalSourceMedia[0].type === 'video' ? (
                        <>
                          <img
                            src={finalSourceMedia[0].thumbnail_url || finalSourceMedia[0].url}
                            alt=""
                            className="w-full h-full object-contain bg-black/20"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <div className="bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-xl">
                              <Play className="w-6 h-6 text-black fill-black" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <img
                          src={finalSourceMedia[0].url}
                          alt=""
                          className="w-full h-full object-contain bg-black/20"
                        />
                      )}
                    </button>
                  ) : (
                    /* Gallery: fill available space */
                    <div className="w-full h-full">
                      <MediaGallery
                        media={finalSourceMedia}
                        onClick={(_, index) => setSelectedMediaIndex(index)}
                        initialIndex={0}
                        onIndexChange={() => { }}
                        className="h-full w-full object-contain rounded-2xl border border-white/10"
                        fillHeight={true}
                      />
                    </div>
                  )
                ) : (
                  /* Link Source */
                  <div
                    className="cursor-pointer active:scale-[0.98] transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(finalSourceUrl!, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    {!post.is_intent && (
                      <SourceImageWithFallback
                        src={articlePreview?.image || finalSourceImage}
                        sharedUrl={finalSourceUrl}
                        isIntent={post.is_intent}
                        trustScore={displayTrustScore}
                        platform={articlePreview?.platform}
                        hostname={getHostnameFromUrl(finalSourceUrl)}
                        className="rounded-xl max-h-[30vh] w-full object-cover mb-2"
                      />
                    )}
                    <h1 className="text-base font-semibold text-immersive-foreground leading-tight mb-1 drop-shadow-sm line-clamp-2">
                      {articlePreview?.title || finalSourceTitle || getHostnameFromUrl(finalSourceUrl)}
                    </h1>
                    <div className={cn("flex items-center text-immersive-muted", post.is_intent ? "gap-1" : "gap-2")}>
                      <ExternalLink className={cn(post.is_intent ? "w-2.5 h-2.5" : "w-3 h-3")} />
                      <span className={cn("uppercase tracking-widest", post.is_intent ? "text-[10px]" : "text-xs")}>
                        {getHostnameFromUrl(finalSourceUrl)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quoted Post - Only for reshares WITHOUT source (pure comment reshares) - OR Intent posts */}
            {quotedPost && !useStackLayout && (
              <div className="mt-4">
                {/* Detect if quoted post is an editorial (Il Punto) - ONLY if directly from system, otherwise render as user post with link */}
                {(quotedPost.author?.username === 'ilpunto' || quotedPost.author?.username === 'Il Punto' || quotedPost.author?.id === 'system') ? (
                  <QuotedEditorialCard
                    title={quotedPost.shared_title || quotedPost.content}
                    onClick={() => {
                      const focusId = quotedPost.shared_url?.replace('focus://daily/', '');
                      if (focusId) {
                        navigate(`/?focus=${focusId}`);
                      }
                    }}
                    trustScore={displayTrustScore}
                  />
                ) : (
                  <QuotedPostCard
                    quotedPost={quotedPost}
                    parentSources={post.shared_url ? [post.shared_url, ...(post.sources || [])] : (post.sources || [])}
                    onNavigate={() => navigate(`/post/${quotedPost.id}`)}
                    className="flex-shrink min-h-0 overflow-hidden mt-2"
                  />
                )}
              </div>
            )}



          </div>
        </div>

        {/* Flexible spacer removed - Rail system handles spacing */}

        {/* Bottom Actions - Single horizontal axis alignment */}
        {/* [Rail 3] ActionRail: Fixed bottom, stable height, no shrinking */}
        <div className="flex items-center justify-between gap-6 px-5 pb-[calc(4rem+env(safe-area-inset-bottom)+12px)] pt-2 flex-shrink-0 z-50">

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
            className="h-11 px-5 bg-blue-50 hover:bg-blue-100 dark:bg-white dark:hover:bg-gray-200 text-blue-600 dark:text-[#1F3347] font-bold rounded-full shadow-sm dark:shadow-md border border-blue-100 dark:border-transparent flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Logo variant="icon" size="sm" className="h-5 w-5" />
            <span className="text-sm font-semibold leading-none">Condividi</span>
            {(post.shares_count ?? 0) > 0 && (
              <span className="text-xs opacity-70">({post.shares_count})</span>
            )}
          </motion.button>

          {/* Action Icons - Uniform w-6 h-6, aligned on same axis */}
          <div
            className="flex items-center gap-4 h-11 action-bar-zone bg-slate-100 px-4 rounded-full shadow-sm border border-slate-200 dark:bg-transparent dark:px-0 dark:rounded-none dark:shadow-none dark:border-none transition-all"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >

            {/* Like with long press for reaction picker */}
            <div className="relative flex items-center justify-center gap-1.5 h-full">
              <motion.button
                whileTap={{ scale: 0.85 }}
                ref={likeButtonRef}
                className="flex items-center justify-center h-full select-none"
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

              <ReactionPicker
                isOpen={showReactionPicker}
                onClose={() => setShowReactionPicker(false)}
                onSelect={(type) => {
                  handleHeart(undefined, type);
                  setShowReactionPicker(false);
                }}
                triggerRef={likeButtonRef}
                dragPosition={dragPosition}
                onDragRelease={() => setDragPosition(null)}
              />
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
    <ShareSheet
      isOpen={showShareSheet}
      onClose={() => setShowShareSheet(false)}
      onShareToFeed={handleShareToFeed}
      onShareToFriend={handleShareToFriend}
    />

    {/* People Picker */}
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

    {/* Full Text Modal for long posts */}
    <FullTextModal
      isOpen={showFullText}
      onClose={() => setShowFullText(false)}
      content={post.content}
      author={{
        name: post.author.full_name || post.author.username,
        username: post.author.username,
        avatar: post.author.avatar_url,
      }}
      variant="post"
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

    {/* Full Caption Modal for long social media captions */}
    <FullTextModal
      isOpen={showFullCaption}
      onClose={() => setShowFullCaption(false)}
      content={articlePreview?.title || post.shared_title || ''}
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
    <ReactionsSheet
      isOpen={showReactionsSheet}
      onClose={() => setShowReactionsSheet(false)}
      postId={post.id}
    />
    {/* Analysis Overlay */}
    {/* Analysis Overlay - z-index higher than source reader (10050 > 10040) */}
    <AnalysisOverlay isVisible={showAnalysisOverlay} message="Analisi in corso..." className="z-[10050]" />
  </>
);
};

// Export memoized component for rerender optimization
export const ImmersivePostCard = memo(ImmersivePostCardInner);
ImmersivePostCard.displayName = 'ImmersivePostCard';

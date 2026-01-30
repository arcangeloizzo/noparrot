import { useState, useEffect, useRef, useMemo, memo } from "react";
import { perfStore } from "@/lib/perfStore";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Trash2, ExternalLink, Quote, ShieldCheck, Maximize2, Play } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
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

  const handleHeart = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    haptics.light();
    toggleReaction.mutate({ postId: post.id, reactionType: 'heart' });
  };

  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  
  const { handleTap: handleDoubleTap } = useDoubleTap({
    onDoubleTap: () => {
      if (!post.user_reactions?.has_hearted) {
        handleHeart();
        setShowHeartAnimation(true);
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
      toast({ title: 'Accedi per condividere', description: 'Devi essere autenticato', variant: 'destructive' });
      return;
    }
    setShowShareSheet(true);
  };

  const handleShareToFeed = async () => {
    setShareAction('feed');
    const userText = post.content;
    const userWordCount = getWordCount(userText);
    
    // Use finalSourceUrl to include sources from quoted posts and deep chains
    if (finalSourceUrl) {
      await startComprehensionGate();
      return;
    }

    const questionCount = getQuestionCountWithoutSource(userWordCount);
    
    if (questionCount === 0) {
      onQuoteShare?.({ ...post, _originalSources: Array.isArray(post.sources) ? post.sources : [] });
      toast({ title: 'Post pronto per la condivisione', description: 'Aggiungi un tuo commento' });
    } else {
      toast({ title: 'Lettura richiesta', description: `Leggi il post per condividerlo` });
      await startComprehensionGateForPost();
    }
  };

  const handleShareToFriend = async () => {
    setShareAction('friend');
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
      toast({ title: 'Lettura richiesta', description: `Leggi il post per condividerlo` });
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

  // Direct gate for text-only posts when already read (bypasses reader)
  const goDirectlyToGateForPost = async () => {
    if (!user) return;
    
    const userText = post.content;
    const userWordCount = getWordCount(userText);
    const questionCount = getQuestionCountWithoutSource(userWordCount);
    
    // If no questions needed, go straight to composer
    if (questionCount === 0) {
      onQuoteShare?.({ ...post, _originalSources: Array.isArray(post.sources) ? post.sources : [] });
      toast({ title: 'Post pronto per la condivisione', description: 'Aggiungi un tuo commento' });
      return;
    }
    
    toast({ title: 'Stiamo mettendo a fuoco ciò che conta…' });
    
    try {
      const result = await generateQA({
        contentId: post.id,
        title: post.author.full_name || post.author.username,
        summary: userText,
        userText: userText || '',
        questionCount,
      });

      if (result.insufficient_context) {
        toast({ title: 'Contenuto troppo breve', description: 'Puoi comunque condividere questo post' });
        onQuoteShare?.({ ...post, _originalSources: Array.isArray(post.sources) ? post.sources : [] });
        return;
      }

      if (!result || result.error || !result.questions?.length) {
        toast({ title: 'Errore', description: result?.error || 'Quiz non valido', variant: 'destructive' });
        return;
      }

      setQuizData({ qaId: result.qaId, questions: result.questions, sourceUrl: `post://${post.id}` });
      setShowQuiz(true);
    } catch (error) {
      toast({ title: 'Errore', description: 'Si è verificato un errore. Riprova.', variant: 'destructive' });
    }
  };

  const startComprehensionGate = async () => {
    if (!user) return;

    // On-demand deep lookup: garantisce di avere la fonte anche se hook non ha finito
    let resolvedSourceUrl = finalSourceUrl;
    let resolvedArticleContent: string | undefined;
    
    if (!resolvedSourceUrl && post.quoted_post_id) {
      toast({ title: 'Caricamento fonte originale...' });
      const deepSource = await resolveOriginalSourceOnDemand(post.quoted_post_id);
      if (deepSource?.url) {
        resolvedSourceUrl = deepSource.url;
        resolvedArticleContent = deepSource.articleContent || undefined;
      }
    }
    
    if (!resolvedSourceUrl) {
      // Nessuna fonte trovata nella catena - fail-closed: non permettiamo share
      toast({ 
        title: 'Impossibile trovare la fonte', 
        description: 'Non è possibile condividere questo contenuto.',
        variant: 'destructive' 
      });
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
        toast({ 
          title: 'Contenuto editoriale non disponibile', 
          variant: 'destructive' 
        });
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
      });
      setShowReader(true);
      return;
    }

    try {
      const host = new URL(resolvedSourceUrl).hostname.toLowerCase();
      const isBlockedPlatform = host.includes('instagram.com') || host.includes('facebook.com') || host.includes('m.facebook.com') || host.includes('fb.com') || host.includes('fb.watch') || host.includes('linkedin.com');
      
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
          onQuoteShare?.(post);
          toast({ title: 'Post pronto per la condivisione' });
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
        toast({ title: 'Link non supportato nel Reader', description: 'Instagram, Facebook e LinkedIn non sono supportati. Apertura in nuova scheda.' });
        window.open(resolvedSourceUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch {}

    toast({ title: 'Caricamento contenuto...', description: 'Preparazione del Comprehension Gate' });

    const preview = await fetchArticlePreview(resolvedSourceUrl);
    let hostname = '';
    try { hostname = new URL(resolvedSourceUrl).hostname.replace('www.', ''); } catch {}

    setReaderSource({
      ...preview,
      id: post.id,
      state: 'reading' as const,
      url: resolvedSourceUrl,
      title: preview?.title || finalSourceTitle || `Contenuto da ${hostname}`,
      content: preview?.content || preview?.description || preview?.summary || preview?.excerpt || post.content || '',
      summary: preview?.summary || preview?.description || 'Apri il link per visualizzare il contenuto completo.',
      image: preview?.image || finalSourceImage || '',
      platform: preview?.platform || detectPlatformFromUrl(resolvedSourceUrl),
      contentQuality: preview?.contentQuality || 'minimal',
    });
    setShowReader(true);
  };

  const closeReaderSafely = async () => {
    setReaderClosing(true);
    try {
      const gateRoot = document.querySelector('[data-reader-gate-root="true"]') as HTMLElement | null;
      const iframes = (gateRoot ? gateRoot.querySelectorAll('iframe') : document.querySelectorAll('iframe'));
      iframes.forEach((iframe) => {
        try { (iframe as HTMLIFrameElement).src = 'about:blank'; } catch {}
      });
    } catch {}
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
    console.log('[Gate] handleReaderComplete started', { 
      isIntentPost: readerSource.isIntentPost, 
      isOriginalPost: readerSource.isOriginalPost,
      isEditorial: readerSource.isEditorial,
      url: readerSource.url?.substring(0, 50)
    });

    // Safety timeout - 30 seconds max
    const timeoutId = setTimeout(() => {
      console.error('[Gate] TIMEOUT: Quiz generation exceeded 30 seconds');
      toast({ 
        title: 'Timeout', 
        description: 'La generazione del quiz ha impiegato troppo tempo. Riprova.',
        variant: 'destructive' 
      });
      setReaderLoading(false);
      setReaderClosing(false);
      setGateStep('idle');
    }, 30000);

    try {
      // Removed frontend content-length block - let backend handle via fail-open
      // The backend will return insufficient_context which triggers fail-open toast + share
      const isEditorial = readerSource.isEditorial || 
        readerSource.url?.startsWith('editorial://') ||
        readerSource.url?.startsWith('focus://daily/');
      
      console.log('[Gate] Pre-flight check:', { 
        isOriginal: readerSource.isOriginalPost,
        isIntent: readerSource.isIntentPost, 
        isEditorial,
        url: readerSource.url?.substring(0, 50)
      });

      // Handle Intent Post completion - use saved questionCount
      if (readerSource.isIntentPost) {
        const userText = readerSource.content || '';
        const questionCount = readerSource.questionCount;
        
        console.log('[Gate] Intent post - generating quiz', { userTextLength: userText.length, questionCount });
        toast({ title: 'Stiamo mettendo a fuoco ciò che conta…' });
        
        const result = await generateQA({
          contentId: post.id,
          title: readerSource.title,
          summary: userText,
          userText: userText,
          questionCount,
        });
        
        console.log('[Gate] Intent post generateQA result:', { 
          hasError: !!result.error, 
          insufficient: result.insufficient_context,
          questionCount: result.questions?.length,
          qaId: result.qaId?.substring(0, 8)
        });
        
        if (result.insufficient_context) {
          toast({ title: 'Contenuto troppo breve', description: 'Post pronto per la condivisione' });
          await closeReaderSafely();
          onQuoteShare?.(post);
          return;
        }
        
        if (!result || result.error || !result.questions?.length) {
          console.error('[Gate] Intent quiz invalid:', result?.error);
          toast({ title: 'Errore', description: result?.error || 'Quiz non valido', variant: 'destructive' });
          return;
        }
        
        setQuizData({ qaId: result.qaId, questions: result.questions, sourceUrl: `post://${post.id}` });
        setShowQuiz(true);
        
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        setShowReader(false);
        setReaderSource(null);
        return;
      }
      
      const isOriginalPost = readerSource.isOriginalPost;
      const userText = post.content;
      const userWordCount = getWordCount(userText);
      
      let testMode: 'SOURCE_ONLY' | 'MIXED' | 'USER_ONLY' | undefined;
      let questionCount: 1 | 3 | undefined;
      
      if (isOriginalPost) {
        questionCount = getQuestionCountWithoutSource(userWordCount) as 1 | 3;
      } else if (isEditorial) {
        testMode = 'SOURCE_ONLY';
        questionCount = 3;
      } else {
        testMode = getTestModeWithSource(userWordCount);
      }
      
      console.log('[Gate] Generating quiz', { isOriginalPost, isEditorial, testMode, questionCount, userWordCount });
      toast({ title: 'Stiamo mettendo a fuoco ciò che conta…' });

      const fullContent = readerSource.content || readerSource.summary || readerSource.excerpt || post.content;

      // Per contenuti editoriali, usare legacy mode con summary
      const result = await generateQA({
        contentId: isEditorial ? readerSource.id : post.id,
        title: readerSource.title,
        // Per editorial, passare summary (legacy mode) invece di qaSourceRef
        summary: isEditorial ? readerSource.articleContent : (isOriginalPost ? fullContent : undefined),
        qaSourceRef: (!isOriginalPost && !isEditorial) ? readerSource.qaSourceRef : undefined,
        userText: userText || '',
        sourceUrl: isOriginalPost ? undefined : readerSource.url,
        testMode,
        questionCount,
      });

      console.log('[Gate] GenerateQA result:', { 
        hasError: !!result.error,
        insufficient: result.insufficient_context,
        questionCount: result.questions?.length,
        qaId: result.qaId?.substring(0, 8)
      });

      if (result.insufficient_context) {
        // FAIL-OPEN: permettiamo la condivisione con warning per tutte le fonti
        if (isOriginalPost) {
          // Post originale troppo breve - ok, può condividere
          console.log('[Gate] Original post insufficient - allowing share');
          toast({ title: 'Contenuto troppo breve', description: 'Puoi condividere questo post' });
        } else {
          // Fonte esterna non valutabile - ALLOW con warning (Fail-Open policy)
          console.warn('[Gate] External source insufficient - allowing share with warning (fail-open)');
          toast({ 
            title: 'Impossibile generare il quiz', 
            description: 'Condivisione consentita senza verifica.'
          });
        }
        await closeReaderSafely();
        onQuoteShare?.(post);
        return;
      }

      if (!result || result.error || !result.questions?.length) {
        console.error('[Gate] Quiz generation failed:', result?.error);
        toast({ title: 'Errore', description: result?.error || 'Quiz non valido', variant: 'destructive' });
        return;
      }

      const sourceUrl = readerSource.url || '';
      setGateStep('quiz:mount');
      // Include qaId for server-side validation
      console.log('[Gate] Setting quiz data, qaId:', result.qaId);
      setQuizData({ qaId: result.qaId, questions: result.questions, sourceUrl });
      setShowQuiz(true);

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      setGateStep('reader:closing');
      setReaderClosing(true);
      await new Promise((resolve) => setTimeout(resolve, 50));

      setGateStep('reader:unmount');
      setShowReader(false);
      setReaderSource(null);
      setGateStep('quiz:shown');

    } catch (error) {
      setGateStep('error');
      console.error('[Gate] handleReaderComplete exception:', error);
      toast({ title: 'Errore', description: 'Si è verificato un errore. Riprova.', variant: 'destructive' });
    } finally {
      // ALWAYS cleanup - prevents infinite spinner
      clearTimeout(timeoutId);
      setReaderLoading(false);
      setReaderClosing(false);
      console.log('[Gate] handleReaderComplete finished, cleanup done');
    }
  };

  const handleQuizSubmit = async (answers: Record<string, string>) => {
    if (!user || !quizData) return { passed: false, score: 0, total: 0, wrongIndexes: [] };

    // FORENSIC LOG: Before submit-qa call
    console.log('[ImmersivePostCard] handleQuizSubmit called:', {
      qaId: quizData.qaId,
      postId: post.id,
      sourceUrl: quizData.sourceUrl,
      answerCount: Object.keys(answers).length,
      answerKeys: Object.keys(answers),
    });

    try {
      // SECURITY HARDENED: Include qaId for server-side validation
      const { data, error } = await supabase.functions.invoke('submit-qa', {
        body: { 
          qaId: quizData.qaId,
          postId: post.id, 
          sourceUrl: quizData.sourceUrl, 
          answers, 
          gateType: 'share' 
        }
      });

      // FORENSIC LOG: After submit-qa call
      console.log('[ImmersivePostCard] submit-qa response:', { data, error });

      if (error || !data) {
        console.error('[ImmersivePostCard] submit-qa failed:', error);
        toast({ title: 'Errore', description: 'Errore durante la validazione', variant: 'destructive' });
        return { passed: false, score: 0, total: 0, wrongIndexes: [] };
      }

      // Use ONLY server verdict - no client override
      const passed = !!data.passed;
      
      if (passed) {
        toast({ title: 'Possiamo procedere.', description: 'Hai messo a fuoco.' });
        setShowQuiz(false);
        setQuizData(null);
        setGateStep('idle');

        if (shareAction === 'feed') {
          onQuoteShare?.({ ...post, _originalSources: Array.isArray(post.sources) ? post.sources : [] });
        } else if (shareAction === 'friend') {
          setShowPeoplePicker(true);
        }
        setShareAction(null);
      } else {
        toast({ title: "Serve ancora un po' di chiarezza.", description: 'Rileggi il contenuto e riprova.' });
        setShowQuiz(false);
        setQuizData(null);
        setShareAction(null);
        setGateStep('idle');
      }
      
      return data;
    } catch {
      toast({ title: 'Errore', description: 'Errore durante la validazione', variant: 'destructive' });
      return { passed: false, score: 0, total: 0, wrongIndexes: [] };
    }
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: it });
  const hasMedia = post.media && post.media.length > 0;
  const hasLink = !!post.shared_url;
  const isSpotify = articlePreview?.platform === 'spotify';
  const isTwitter = articlePreview?.platform === 'twitter' || detectPlatformFromUrl(post.shared_url || '') === 'twitter';
  const isLinkedIn = articlePreview?.platform === 'linkedin' || detectPlatformFromUrl(post.shared_url || '') === 'linkedin';
  const isYoutube = articlePreview?.platform === 'youtube' || 
    (post.shared_url?.includes('youtube.com') || post.shared_url?.includes('youtu.be'));
  const isMediaOnlyPost = hasMedia && !hasLink && !quotedPost;
  const mediaUrl = post.media?.[0]?.url;
  const isVideoMedia = post.media?.[0]?.type === 'video';
  const backgroundImage = !isMediaOnlyPost ? (articlePreview?.image || post.preview_img || (hasMedia && post.media?.[0]?.url)) : undefined;
  // Exclude quotedPost from text-only to prevent quote marks on reshares
  const isTextOnly = !hasMedia && !hasLink && !quotedPost;
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
  const useStackLayout = !isQuotedIntentPost && (isReshareWithShortComment || isReshareWithSource);
  
  // Deep chain source preview is now handled by useArticlePreview hook via urlToPreview
  
  // Fetch context stack for ALL reshares (show chain for any reshare)
  const { data: contextStack = [] } = useReshareContextStack(post.quoted_post_id);
  
  // Extract dominant colors from media - skip for cards not near active index
  const { primary: dominantPrimary, secondary: dominantSecondary } = useDominantColors(isMediaOnlyPost ? mediaUrl : undefined, { skip: !isNearActive });

  return (
    <>
      <div 
        className="h-[100dvh] w-full snap-start relative flex flex-col p-6 overflow-hidden"
        onClick={handleDoubleTap}
      >
        {/* Background Layer */}
        {isMediaOnlyPost && mediaUrl ? (
          <>
            {/* Dynamic gradient background from dominant colors */}
            <div 
              className="absolute inset-0"
              style={{ 
                background: `linear-gradient(to bottom, ${dominantPrimary}, ${dominantSecondary})` 
              }}
            />
            {/* Dark overlay for text readability */}
            <div className="absolute inset-0 bg-black/30" />
          </>
        ) : isTextOnly ? (
          <div className="absolute inset-0 bg-[#1F3347]">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10" />
          </div>
        ) : isIntentPost || isQuotedIntentPost ? (
          /* Intent posts OR reshares of Intent posts: NoParrot blue background with urban texture */
          <div className="absolute inset-0 bg-gradient-to-b from-[#1F3347] via-[#172635] to-[#0E1A24]">
            <div className="absolute inset-0 opacity-[0.08] mix-blend-overlay urban-noise-overlay" />
          </div>
        ) : isSpotify ? (
          <SpotifyGradientBackground 
            albumArtUrl={articlePreview?.image || post.preview_img || ''}
            audioFeatures={articlePreview?.audioFeatures}
          />
        ) : isTwitter ? (
          <div className="absolute inset-0 bg-gradient-to-b from-[#15202B] via-[#192734] to-[#0d1117]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1DA1F2]/10 to-transparent" />
          </div>
        ) : isLinkedIn ? (
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A66C2]/20 via-[#1a1a2e] to-[#0d1117]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0A66C2]/15 to-transparent" />
          </div>
        ) : (
          <>
            {/* Blurred background image - behind everything */}
            {backgroundImage && shouldLoadImages && (
              <img 
                src={backgroundImage} 
                className="absolute inset-0 w-full h-full object-cover opacity-60 blur-2xl scale-110" 
                alt=""
                loading="lazy"
              />
            )}
            {/* Gradient overlay on top of image, or solid color if no image */}
            <div className={cn(
              "absolute inset-0",
              backgroundImage ? "bg-gradient-to-b from-black/40 via-black/20 to-black/80" : "bg-[#1F3347]"
            )} />
          </>
        )}

        {/* Urban texture overlay - applied to all backgrounds (GPU-friendly static PNG) */}
        <div className="absolute inset-0 z-[1] opacity-[0.025] pointer-events-none mix-blend-overlay urban-noise-overlay" />

        {/* Cinematic Fade Overlay - seamless card-to-card transitions */}
        <div 
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            background: `linear-gradient(
              to bottom,
              rgba(0,0,0,1) 0%,
              rgba(0,0,0,0) 12%,
              rgba(0,0,0,0) 88%,
              rgba(0,0,0,1) 100%
            )`
          }}
        />

        {/* Heart animation */}
        {showHeartAnimation && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <Heart className="w-24 h-24 text-red-500 fill-red-500 animate-scale-in drop-shadow-lg" />
          </div>
        )}

        {/* Content Layer */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between pt-14 pb-20 sm:pb-24">
          
          {/* Top Bar */}
          <div className="flex justify-between items-start">
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
                <span className="text-white font-bold text-sm drop-shadow-md">
                  {post.author.full_name || getDisplayUsername(post.author.username)}
                </span>
                <span className="text-white/60 text-xs">{timeAgo}</span>
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
                      "flex items-center gap-1.5 bg-black/30 border border-white/10 px-3 py-1.5 rounded-full cursor-pointer hover:bg-black/40 transition-colors shadow-xl",
                      displayTrustScore.band === 'ALTO' && "text-emerald-400",
                      displayTrustScore.band === 'MEDIO' && "text-amber-400",
                      displayTrustScore.band === 'BASSO' && "text-red-400"
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
                  <button className="p-2 rounded-full bg-black/20 hover:bg-white/10 transition-colors">
                    <MoreHorizontal className="w-4 h-4 text-white" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      deletePost.mutate(post.id, {
                        onSuccess: () => { toast({ title: 'Post eliminato' }); onRemove?.(post.id); },
                        onError: () => { toast({ title: 'Errore', variant: 'destructive' }); }
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
          <div className="flex-1 flex flex-col justify-center px-2 pt-4 sm:pt-2">
            
            {/* Stack Layout: User comment first - Quote Block style for Intent posts */}
            {useStackLayout && post.content && post.content !== post.shared_title && (
              <div className={cn(
                "text-lg font-normal text-white/90 leading-snug tracking-wide drop-shadow-md mb-4",
                post.is_intent && [
                  "border-l-4 border-primary/60",
                  "bg-white/5",
                  "px-4 py-3 rounded-r-lg"
                ]
              )}>
                <MentionText content={post.content} />
              </div>
            )}
            
            {/* Intent Post (non-stack): Quote Block style for posts with is_intent flag */}
            {!useStackLayout && post.is_intent && post.content && (
              <div className="border-l-4 border-primary/60 bg-white/5 px-4 py-3 rounded-r-lg mb-6">
                <p className="text-lg font-normal text-white/90 leading-snug tracking-wide drop-shadow-md">
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
                <div className="mb-6">
                  <h2 className="text-lg font-normal text-white/90 leading-snug tracking-wide drop-shadow-md">
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
                <h2 className="text-lg font-normal text-white/90 leading-snug tracking-wide drop-shadow-md mb-6">
                  <MentionText content={post.content} />
                </h2>
              )
            )}
            
            {/* User Text for normal reshares (long quoted comment, no source): show current user's comment ABOVE the QuotedPostCard */}
            {!useStackLayout && quotedPost && !hasLink && post.content && (
              post.content.length > 400 ? (
                <div className="mb-6">
                  <h2 className="text-lg font-normal text-white/90 leading-snug tracking-wide drop-shadow-md">
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
                <h2 className="text-lg font-normal text-white/90 leading-snug tracking-wide drop-shadow-md mb-6">
                  <MentionText content={post.content} />
                </h2>
              )
            )}

            {/* Pure Text-Only Posts - Immersive editorial-style card */}
            {isTextOnly && post.content && (
              <div className="relative w-full max-w-lg mx-auto">
                {/* Card container with glassmorphism and urban texture - GPU optimized */}
                <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl overflow-hidden">
                  
                  {/* Urban texture overlay - static PNG */}
                  <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay rounded-3xl urban-noise-overlay" />
                  
                  {/* Decorative quote mark */}
                  <div className="absolute top-4 left-5 text-white/[0.06] text-[80px] font-serif leading-none pointer-events-none select-none">"</div>
                  
                  {/* Content */}
                  <div className="relative z-10">
                    {post.content.length > 400 ? (
                      <>
                        <p className="text-[17px] sm:text-lg font-normal text-white/95 leading-[1.65] tracking-[0.01em] whitespace-pre-wrap">
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
                      <p className="text-[17px] sm:text-lg font-normal text-white/95 leading-[1.65] tracking-[0.01em] whitespace-pre-wrap">
                        <MentionText content={post.content} />
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* User Text for media-only posts - ABOVE the media */}
            {isMediaOnlyPost && post.content && (
              <h2 className="text-xl font-medium text-white leading-snug tracking-wide drop-shadow-lg mb-6">
                <MentionText content={post.content.length > 200 ? post.content.slice(0, 200) + '...' : post.content} />
              </h2>
            )}

            {/* Framed Media Window for media-only posts - centered, reduced height (-30%) */}
            {isMediaOnlyPost && mediaUrl && (
              <button
                role="button"
                aria-label={isVideoMedia ? "Riproduci video" : "Apri immagine"}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMediaIndex(0);
                }}
                className="relative w-full max-w-[88%] mx-auto rounded-2xl overflow-hidden shadow-2xl border border-white/10 active:scale-[0.98] transition-transform mb-6"
              >
                {isVideoMedia ? (
                  <>
                    <img 
                      src={post.media?.[0]?.thumbnail_url || mediaUrl} 
                      alt="" 
                      className="w-full h-[38vh] object-cover"
                    />
                    {/* Play icon overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
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
                      className="w-full h-[44vh] object-cover"
                    />
                    {/* Expand pill with label */}
                    <div className="absolute bottom-3 right-3 bg-black/80 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs font-medium text-white">Apri</span>
                    </div>
                  </>
                )}
              </button>
            )}

            {/* Twitter/X Card - Unified glassmorphic container */}
            {hasLink && isTwitter && !isReshareWithShortComment ? (
              <div className="w-full max-w-md mx-auto mt-6">
                {/* Unified Twitter Card - Author + Content in one container */}
                <div 
                  className="bg-gradient-to-br from-[#15202B] to-[#0d1117] rounded-3xl p-5 border border-white/15 shadow-2xl cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (post.shared_url) {
                      window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                >
                  {/* Author Row */}
                  <div className="flex items-center gap-3 mb-4">
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
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
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
                  
                  {/* Tweet Text - cleaned and clamped */}
                  <p className="text-white text-base leading-relaxed mb-4 line-clamp-4">
                    {(articlePreview?.content || articlePreview?.summary || post.content || '')
                      .replace(/https?:\/\/t\.co\/\w+/g, '')
                      .replace(/https?:\/\/[^\s]+/g, '')
                      .replace(/\s{2,}/g, ' ')
                      .trim()}
                  </p>
                  
                  {/* Tweet Media (if any) - compact height */}
                  {articlePreview?.image && (
                    <div className="rounded-xl overflow-hidden">
                      <img 
                        src={articlePreview.image} 
                        alt="" 
                        className="w-full h-40 object-cover"
                      />
                    </div>
                  )}
                </div>
                
                {/* Open on X CTA - Below the card */}
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
                  <span className="text-xs uppercase tracking-wider">Apri su X</span>
                </button>
              </div>
            ) : hasLink && isLinkedIn && !isReshareWithShortComment ? (
              /* LinkedIn Card - Professional styling */
              <div className="w-full max-w-md mx-auto mt-6">
                {/* Unified LinkedIn Card */}
                <div 
                  className="bg-gradient-to-br from-[#0A66C2]/20 to-[#1a1a2e]/95 backdrop-blur-xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_16px_rgba(10,102,194,0.15)] cursor-pointer active:scale-[0.98] transition-transform"
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
                  <p className="text-white text-base leading-relaxed mb-4 line-clamp-4">
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
                    <div className="rounded-xl overflow-hidden">
                      <img 
                        src={articlePreview?.image || post.preview_img} 
                        alt="" 
                        className="w-full h-40 object-cover"
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
            ) : hasLink && isYoutube && !isReshareWithShortComment ? (
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
                      className="w-full aspect-video object-cover"
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
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
                        <polygon fill="white" points="9.545,15.568 15.818,12 9.545,8.432"/>
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
                <h1 className="text-xl font-bold text-white leading-tight mt-4 mb-2 drop-shadow-xl">
                  {articlePreview?.title || post.shared_title}
                </h1>
                
                {/* Open on YouTube CTA */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                  }}
                  className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="text-xs uppercase tracking-wider">Apri su YouTube</span>
                </button>
              </div>
            ) : hasLink && isSpotify ? (
              <div 
                className="cursor-pointer active:scale-[0.98] transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  if (post.shared_url) {
                    window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                {/* Spotify Artwork - Large centered square */}
                {(articlePreview?.image || post.preview_img) && (
                  <div className="flex justify-center mb-4">
                    <div className="w-72 h-72 sm:w-80 sm:h-80 rounded-2xl overflow-hidden shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_24px_rgba(30,215,96,0.25)] border border-white/10">
                      <img 
                        src={articlePreview?.image || post.preview_img} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
                
                {/* Spotify Title */}
                <h1 className="text-2xl font-bold text-white leading-tight mb-2 text-center drop-shadow-xl">
                  {articlePreview?.title || post.shared_title}
                </h1>
                
                {/* Artist name */}
                {articlePreview?.description && (
                  <p className="text-[#1DB954] text-center font-medium mb-4">
                    {articlePreview.description}
                  </p>
                )}
                
                {/* Static Spotify badge */}
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 bg-[#1DB954]/20 border border-[#1DB954]/30 px-4 py-2 rounded-full">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1DB954">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
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
            ) : hasLink && !isReshareWithShortComment && (
              /* ===== HARDENING 2: Fixed-height container + skeleton for link preview ===== */
              <div className="min-h-[280px]">
                {isWaitingForPreview && !post.shared_title && !post.preview_img ? (
                  /* Skeleton while loading preview data */
                  <div className="space-y-4 animate-pulse">
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
                  /* Generic Link Preview - Clickable to open external link */
                  <div 
                    className="cursor-pointer active:scale-[0.98] transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (post.shared_url) {
                        window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    {/* Visible Metadata Image - Hide for Intent posts (show only background color) */}
                    {!post.is_intent && (
                      <SourceImageWithFallback
                        src={articlePreview?.image || post.preview_img}
                        sharedUrl={post.shared_url}
                        isIntent={post.is_intent}
                        trustScore={displayTrustScore}
                        hideOverlay={true}
                        platform={articlePreview?.platform}
                        hostname={getHostnameFromUrl(post.shared_url)}
                      />
                    )}
                    
                    <div className="w-12 h-1 bg-white/30 rounded-full mb-4" />
                    {/* Caption/Title with truncation for long social captions */}
                    {(() => {
                      const displayTitle = articlePreview?.title || post.shared_title || getHostnameFromUrl(post.shared_url);
                      const isCaptionLong = displayTitle && displayTitle.length > CAPTION_TRUNCATE_LENGTH;
                      const truncatedCaption = isCaptionLong 
                        ? displayTitle.slice(0, CAPTION_TRUNCATE_LENGTH).trim() + '...' 
                        : displayTitle;
                      
                      return (
                        <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                          <p className="text-lg font-medium text-white/90 leading-relaxed drop-shadow-lg line-clamp-3">
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
                      "flex items-center text-white/70 mb-4",
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

            {/* Stack Layout: Source Preview LAST (uses deep chain source) */}
            {useStackLayout && finalSourceUrl && (
              finalSourceUrl.startsWith('focus://') ? (
                /* Editorial source in stack - internal navigation, Trust Score always ALTO */
                <QuotedEditorialCard
                  title={finalSourceTitle || 'Il Punto'}
                  summary={(() => {
                    // Priority: article_content > editorialSummary (fetched from DB)
                    const raw = post.article_content || '';
                    const cleaned = raw.replace(/\[SOURCE:[\d,\s]+\]/g, '').trim();
                    if (cleaned.length > 20) {
                      return cleaned.substring(0, 260).trim() + '…';
                    }
                    if (editorialSummary) {
                      return editorialSummary.substring(0, 260).trim() + '…';
                    }
                    return undefined;
                  })()}
                  onClick={() => {
                    const focusId = finalSourceUrl.replace('focus://daily/', '');
                    if (focusId) {
                      navigate(`/?focus=${focusId}`);
                    }
                  }}
                  trustScore={{ band: 'ALTO', score: 90 }}
                />
              ) : (
                /* External source - open in browser */
                <div 
                  className="cursor-pointer active:scale-[0.98] transition-transform mt-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(finalSourceUrl, '_blank', 'noopener,noreferrer');
                  }}
                >
                  {/* Source Image - Hide for Intent posts (show only background color) */}
                  {!post.is_intent && (
                    <SourceImageWithFallback
                      src={articlePreview?.image || finalSourceImage}
                      sharedUrl={finalSourceUrl}
                      isIntent={post.is_intent}
                      trustScore={displayTrustScore}
                      platform={articlePreview?.platform}
                      hostname={getHostnameFromUrl(finalSourceUrl)}
                    />
                  )}
                  
                  {/* Source Title */}
                  <h1 className="text-lg font-semibold text-white leading-tight mb-1 drop-shadow-xl">
                    {articlePreview?.title || finalSourceTitle || getHostnameFromUrl(finalSourceUrl)}
                  </h1>
                  <div className={cn(
                    "flex items-center text-white/60",
                    post.is_intent ? "gap-1" : "gap-2"
                  )}>
                    <ExternalLink className={cn(
                      post.is_intent ? "w-2.5 h-2.5" : "w-3 h-3"
                    )} />
                    <span className={cn(
                      "uppercase tracking-widest",
                      post.is_intent ? "text-[10px]" : "text-xs"
                    )}>
                      {getHostnameFromUrl(finalSourceUrl)}
                    </span>
                  </div>
                </div>
              )
            )}

            {/* Quoted Post - Only for reshares WITHOUT source (pure comment reshares) */}
            {quotedPost && !useStackLayout && (
              <div className="mt-4">
                {/* Detect if quoted post is an editorial (Il Punto) */}
                {quotedPost.shared_url?.startsWith('focus://') || quotedPost.author?.username === 'ilpunto' ? (
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
                  />
                )}
              </div>
            )}

          </div>

          {/* Flexible spacer with minimum gap for small screens */}
          <div className="min-h-4 sm:min-h-0 flex-shrink-0" />

          {/* Bottom Actions - Compact mode for smaller screens */}
          <div className="flex items-center justify-between gap-2 sm:gap-3 mr-12 sm:mr-16">
            
            {/* Primary Share Button - Compact padding on mobile */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                haptics.light();
                handleShareClick(e);
              }}
              className="h-10 px-3 sm:px-4 bg-white hover:bg-gray-50 text-[#1F3347] font-bold rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.15)] flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-[0.98]"
            >
              <Logo variant="icon" size="sm" className="h-4 w-4" />
              <span className="text-[11px] sm:text-sm font-semibold leading-none">Condividi</span>
              {(post.shares_count ?? 0) > 0 && (
                <span className="text-[10px] sm:text-xs opacity-70">({post.shares_count})</span>
              )}
            </button>

            {/* Reactions - Compact mode on mobile */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-black/20 backdrop-blur-xl h-10 px-2 sm:px-3 rounded-2xl border border-white/5">
              
              {/* Like */}
              <button 
                className="flex items-center justify-center gap-1 sm:gap-1.5 h-full px-1.5 sm:px-2"
                onClick={(e) => { e.stopPropagation(); handleHeart(e); }}
              >
                <Heart 
                  className={cn("w-5 h-5 transition-transform active:scale-90", post.user_reactions.has_hearted ? "text-red-500 fill-red-500" : "text-white")}
                  fill={post.user_reactions.has_hearted ? "currentColor" : "none"}
                />
                <span className="text-[10px] sm:text-xs font-bold text-white">{post.reactions.hearts}</span>
              </button>

              {/* Comments */}
              <button 
                className="flex items-center justify-center gap-1 sm:gap-1.5 h-full px-1.5 sm:px-2"
                onClick={(e) => { e.stopPropagation(); haptics.light(); setShowComments(true); }}
              >
                <MessageCircle className="w-5 h-5 text-white transition-transform active:scale-90" />
                <span className="text-[10px] sm:text-xs font-bold text-white">{post.reactions.comments}</span>
              </button>

              {/* Bookmark */}
              <button 
                className="flex items-center justify-center h-full px-1.5 sm:px-2"
                onClick={handleBookmark}
              >
                <Bookmark 
                  className={cn("w-5 h-5 transition-transform active:scale-90", post.user_reactions.has_bookmarked ? "text-blue-400 fill-blue-400" : "text-white")}
                  fill={post.user_reactions.has_bookmarked ? "currentColor" : "none"}
                />
              </button>

            </div>
          </div>

        </div>
      </div>

      {/* Reader Modal */}
      {showReader && readerSource && (
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
      )}

      {/* Quiz Modal */}
      {showQuiz && quizData && !quizData.error && quizData.questions && (
        <div className="fixed inset-0 z-[10060]">
          <QuizModal
            questions={quizData.questions}
            qaId={quizData.qaId}
            onSubmit={handleQuizSubmit}
            onCancel={() => {
              setShowQuiz(false);
              setQuizData(null);
              setGateStep('idle');
            }}
          />
        </div>
      )}

      {/* Media Viewer */}
      {selectedMediaIndex !== null && post.media && (
        <div className="fixed inset-0 z-[10080]">
          <MediaViewer
            media={post.media}
            initialIndex={selectedMediaIndex}
            onClose={() => setSelectedMediaIndex(null)}
          />
        </div>
      )}

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
            } catch {}
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
          toast({
            title: 'Messaggio inviato',
            description: `Post condiviso con ${userIds.length} ${userIds.length === 1 ? 'amico' : 'amici'}`
          });
          setShowPeoplePicker(false);
          setShareAction(null);
        }}
      />

      {/* Full Text Modal for long posts - Expanded capsule style */}
      <Dialog open={showFullText} onOpenChange={setShowFullText}>
        <DialogContent className="max-h-[85vh] max-w-lg p-0 bg-transparent border-0 shadow-none overflow-hidden">
          {/* Immersive glass card container */}
          <div className="relative bg-gradient-to-br from-[#1F3347]/95 to-[#0f1a24]/98 rounded-3xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.7),_0_0_40px_rgba(31,51,71,0.4)] overflow-hidden">
            
            {/* Urban texture overlay - GPU optimized */}
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay urban-noise-overlay" />
            
            {/* Header with author info */}
            <div className="relative z-10 px-6 pt-6 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                {post.author.avatar_url ? (
                  <img 
                    src={post.author.avatar_url} 
                    alt="" 
                    className="w-10 h-10 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center border border-white/20">
                    <span className="text-white/80 font-semibold text-sm">
                      {(post.author.full_name || post.author.username)?.[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="font-semibold text-white/95 text-sm">
                    {post.author.full_name || post.author.username}
                  </span>
                  <span className="text-xs text-white/50">
                    @{post.author.username}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Scrollable content area - action bar at the end (inline, not fixed) */}
            <div className="relative z-10 px-6 py-5 max-h-[55vh] overflow-y-auto no-scrollbar">
              {/* Render content with visual paragraph breaks - uniform styling */}
              {(() => {
                const paragraphs = post.content.split(/\n\n+/);
                return paragraphs.map((paragraph, idx) => (
                  <div key={idx} className={cn(idx > 0 && "mt-5")}>
                    <p className="text-[16px] sm:text-[17px] font-normal text-white/90 leading-[1.7] tracking-[0.01em] whitespace-pre-wrap">
                      <MentionText content={paragraph} />
                    </p>
                    {/* Soft divider between paragraphs (except last) */}
                    {idx < paragraphs.length - 1 && (
                      <div className="mt-5 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                    )}
                  </div>
                ));
              })()}
              
              {/* Action Bar - Inside scroll area, visible after reading */}
              <div className="mt-8 pt-6 border-t border-white/[0.08]">
                <div className="flex items-center justify-between gap-3">
                  {/* Primary Share Button - goes directly to gate (already read) */}
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      setShowFullText(false);
                      setShareAction('feed');
                      // Go directly to gate - user already read the content
                      await goDirectlyToGateForPost();
                    }}
                    className="h-10 px-4 bg-white hover:bg-gray-50 text-[#1F3347] font-bold rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    <Logo variant="icon" size="sm" className="h-4 w-4" />
                    <span className="text-sm font-semibold leading-none">Condividi</span>
                    {(post.shares_count ?? 0) > 0 && (
                      <span className="text-xs opacity-70">({post.shares_count})</span>
                    )}
                  </button>

                  {/* Reactions - Horizontal layout h-10 matching share button */}
                  <div className="flex items-center gap-1 bg-black/20 h-10 px-3 rounded-2xl border border-white/5">
                    
                    {/* Like */}
                    <button 
                      className="flex items-center justify-center gap-1.5 h-full px-2"
                      onClick={(e) => { e.stopPropagation(); handleHeart(e); }}
                    >
                      <Heart 
                        className={cn("w-5 h-5 transition-transform active:scale-90", post.user_reactions?.has_hearted ? "text-red-500 fill-red-500" : "text-white")}
                        fill={post.user_reactions?.has_hearted ? "currentColor" : "none"}
                      />
                      <span className="text-xs font-bold text-white">{post.reactions?.hearts || 0}</span>
                    </button>

                    {/* Comments */}
                    <button 
                      className="flex items-center justify-center gap-1.5 h-full px-2"
                      onClick={(e) => { e.stopPropagation(); setShowFullText(false); setTimeout(() => setShowComments(true), 100); }}
                    >
                      <MessageCircle className="w-5 h-5 text-white transition-transform active:scale-90" />
                      <span className="text-xs font-bold text-white">{post.reactions?.comments || 0}</span>
                    </button>

                    {/* Bookmark */}
                    <button 
                      className="flex items-center justify-center h-full px-2"
                      onClick={(e) => { e.stopPropagation(); handleBookmark(e); }}
                    >
                      <Bookmark 
                        className={cn("w-5 h-5 transition-transform active:scale-90", post.user_reactions?.has_bookmarked ? "text-blue-400 fill-blue-400" : "text-white")}
                        fill={post.user_reactions?.has_bookmarked ? "currentColor" : "none"}
                      />
                    </button>

                  </div>
                </div>
              </div>
              
              {/* Footer CTA - also inside scroll */}
              <div className="mt-6">
                <button
                  onClick={() => setShowFullText(false)}
                  className="w-full py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 text-white/90 font-medium text-sm transition-all active:scale-[0.98]"
                >
                  Torna al feed
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Caption Modal for long social media captions (Instagram, etc.) */}
      <Dialog open={showFullCaption} onOpenChange={setShowFullCaption}>
        <DialogContent className="max-h-[85vh] max-w-lg p-0 bg-transparent border-0 shadow-none overflow-hidden">
          {/* Immersive glass card container */}
          <div className="relative bg-gradient-to-br from-[#1F3347]/95 to-[#0f1a24]/98 rounded-3xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.7),_0_0_40px_rgba(31,51,71,0.4)] overflow-hidden">
            
            {/* Urban texture overlay - GPU optimized */}
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay urban-noise-overlay" />
            
            {/* Header with source info */}
            <div className="relative z-10 px-6 pt-6 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500/40 via-purple-500/40 to-orange-500/40 flex items-center justify-center border border-white/20">
                  <ExternalLink className="w-4 h-4 text-white/80" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-white/95 text-sm">
                    {getHostnameFromUrl(post.shared_url)}
                  </span>
                  <span className="text-xs text-white/50">
                    Contenuto esterno
                  </span>
                </div>
              </div>
            </div>
            
            {/* Scrollable content area */}
            <div className="relative z-10 px-6 py-5 max-h-[55vh] overflow-y-auto no-scrollbar">
              <p className="text-[16px] sm:text-[17px] font-normal text-white/90 leading-[1.7] tracking-[0.01em] whitespace-pre-wrap">
                {articlePreview?.title || post.shared_title || ''}
              </p>
              
              {/* Open external link button */}
              <div className="mt-6 pt-4 border-t border-white/[0.08]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (post.shared_url) {
                      window.open(post.shared_url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className="w-full py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 text-white/90 font-medium text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Apri su {getHostnameFromUrl(post.shared_url)}
                </button>
              </div>
              
              {/* Action Bar */}
              <div className="mt-4 pt-4 border-t border-white/[0.08]">
                <div className="flex items-center justify-between gap-3">
                  {/* Primary Share Button */}
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      setShowFullCaption(false);
                      setShareAction('feed');
                      handleShareClick(e);
                    }}
                    className="h-10 px-4 bg-white hover:bg-gray-50 text-[#1F3347] font-bold rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    <Logo variant="icon" size="sm" className="h-4 w-4" />
                    <span className="text-sm font-semibold leading-none">Condividi</span>
                  </button>

                  {/* Reactions */}
                  <div className="flex items-center gap-1 bg-black/20 h-10 px-3 rounded-2xl border border-white/5">
                    <button 
                      className="flex items-center justify-center gap-1.5 h-full px-2"
                      onClick={(e) => { e.stopPropagation(); handleHeart(e); }}
                    >
                      <Heart 
                        className={cn("w-5 h-5 transition-transform active:scale-90", post.user_reactions?.has_hearted ? "text-red-500 fill-red-500" : "text-white")}
                        fill={post.user_reactions?.has_hearted ? "currentColor" : "none"}
                      />
                      <span className="text-xs font-bold text-white">{post.reactions?.hearts || 0}</span>
                    </button>
                    <button 
                      className="flex items-center justify-center gap-1.5 h-full px-2"
                      onClick={(e) => { e.stopPropagation(); setShowFullCaption(false); setTimeout(() => setShowComments(true), 100); }}
                    >
                      <MessageCircle className="w-5 h-5 text-white transition-transform active:scale-90" />
                      <span className="text-xs font-bold text-white">{post.reactions?.comments || 0}</span>
                    </button>
                    <button 
                      className="flex items-center justify-center h-full px-2"
                      onClick={(e) => { e.stopPropagation(); handleBookmark(e); }}
                    >
                      <Bookmark 
                        className={cn("w-5 h-5 transition-transform active:scale-90", post.user_reactions?.has_bookmarked ? "text-blue-400 fill-blue-400" : "text-white")}
                        fill={post.user_reactions?.has_bookmarked ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Footer CTA */}
              <div className="mt-6">
                <button
                  onClick={() => setShowFullCaption(false)}
                  className="w-full py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 text-white/90 font-medium text-sm transition-all active:scale-[0.98]"
                >
                  Torna al feed
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comments Drawer */}
      {showComments && (
        <CommentsDrawer
          post={post}
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          mode="view"
          scrollToCommentId={scrollToCommentId}
        />
      )}
    </>
  );
};

// Export memoized component for rerender optimization
export const ImmersivePostCard = memo(ImmersivePostCardInner);
ImmersivePostCard.displayName = 'ImmersivePostCard';

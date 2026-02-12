import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TOASTS } from "@/constants/toast-messages";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { MediaActionBar } from "./MediaActionBar";
import { MediaPreviewTray } from "@/components/media/MediaPreviewTray";
import { fetchArticlePreview, classifyContent, generateQA } from "@/lib/ai-helpers";
import { QuotedPostCard } from "@/components/feed/QuotedPostCard";
import { QuotedEditorialCard } from "@/components/feed/QuotedEditorialCard";
import { SourceReaderGate } from "./SourceReaderGate";
import { QuizModal } from "@/components/ui/quiz-modal";
import { getWordCount, getTestModeWithSource, getMediaTestMode, getMediaGateForComposer } from '@/lib/gate-utils';
import { useQueryClient } from "@tanstack/react-query";
import { updateCognitiveDensityWeighted } from "@/lib/cognitiveDensity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { cn } from "@/lib/utils";
import { addBreadcrumb, generateIdempotencyKey, setPendingPublish, clearPendingPublish, getPendingPublish } from "@/lib/crashBreadcrumbs";
import { forceUnlockBodyScroll } from "@/lib/bodyScrollLock";
import { haptics } from "@/lib/haptics";
import { TiptapEditor, TiptapEditorRef } from "./TiptapEditor";
import { useVisualViewportOffset } from "@/hooks/useVisualViewportOffset";
import { Loader2, Youtube } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// iOS detection for stability tweaks (includes iPadOS reporting as Mac)
const isIOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1));

interface ComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotedPost?: any;
  /** Callback fired with new post ID after successful publish (for scroll-to-post) */
  onPublishSuccess?: (newPostId: string) => void;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// Sanitize extracted URL: remove trailing punctuation and unwrap tracking redirects
const sanitizeUrl = (rawUrl: string): string => {
  // Remove trailing punctuation that often gets captured by regex
  let url = rawUrl.replace(/[)\]},;:!?.…]+$/, '');

  // Unwrap common tracking/redirect wrappers
  try {
    const parsed = new URL(url);

    // Instagram/Facebook link wrappers: l.instagram.com/?u=...
    if (parsed.hostname.includes('l.instagram.com') || parsed.hostname.includes('l.facebook.com')) {
      const targetUrl = parsed.searchParams.get('u');
      if (targetUrl) {
        console.log('[Composer] Unwrapped tracking URL:', { original: url, unwrapped: targetUrl });
        url = targetUrl;
      }
    }

    // Google redirect: google.com/url?q=...
    if (parsed.hostname.includes('google.com') && parsed.pathname === '/url') {
      const targetUrl = parsed.searchParams.get('q') || parsed.searchParams.get('url');
      if (targetUrl) {
        console.log('[Composer] Unwrapped Google redirect:', { original: url, unwrapped: targetUrl });
        url = targetUrl;
      }
    }

    // Normalize Instagram URLs: strip tracking query params (igsh, etc.)
    try {
      const ig = new URL(url);
      if (ig.hostname.includes('instagram.com')) {
        // Keep only canonical path (improves metadata extraction)
        url = `${ig.origin}${ig.pathname}`;
      }
    } catch { }

    // t.co (Twitter shortlinks) - keep as is, backend resolves
    // bit.ly, tinyurl, etc - keep as is, backend resolves

  } catch (e) {
    console.warn('[Composer] URL parse error during sanitization:', e);
  }

  return url;
};

export function ComposerModal({ isOpen, onClose, quotedPost, onPublishSuccess }: ComposerModalProps) {
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isFinalizingPublish, setIsFinalizingPublish] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [urlPreview, setUrlPreview] = useState<any>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [contentCategory, setContentCategory] = useState<string | null>(null);
  const [showReader, setShowReader] = useState(false);
  const [readerClosing, setReaderClosing] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizData, setQuizData] = useState<any>(null);
  const [quizPassed, setQuizPassed] = useState(false);
  const [intentMode, setIntentMode] = useState(false);
  const [showAnalysisOverlay, setShowAnalysisOverlay] = useState(false);
  // [NEW] Persistent transcription state - tracks which media is being transcribed
  // This remains true until polling confirms done/failed from DB
  const [transcribingMediaId, setTranscribingMediaId] = useState<string | null>(null);
  const editorRef = useRef<TiptapEditorRef>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // iOS keyboard offset using Visual Viewport API
  const keyboardOffset = useVisualViewportOffset(isOpen && isIOS);

  const { uploadMedia, uploadedMedia, removeMedia, clearMedia, reorderMedia, isUploading, isBatchExtracting, requestTranscription, requestOCR, refreshMediaStatus, requestBatchExtraction, getAggregatedExtractedText, addExternalMedia } = useMediaUpload();
  const [isGeneratingInfographic, setIsGeneratingInfographic] = useState(false);

  // Polling for media extraction status
  useEffect(() => {
    const pendingMedia = uploadedMedia.filter(m => m.extracted_status === 'pending');
    if (pendingMedia.length === 0) return;

    const interval = setInterval(() => {
      pendingMedia.forEach(m => refreshMediaStatus(m.id));
    }, 2000); // Poll ogni 2 secondi

    return () => clearInterval(interval);
  }, [uploadedMedia, refreshMediaStatus]);

  // [NEW] Reset transcribingMediaId when transcription completes (done/failed)
  useEffect(() => {
    if (!transcribingMediaId) return;

    const media = uploadedMedia.find(m => m.id === transcribingMediaId);
    if (!media) {
      setTranscribingMediaId(null);
      return;
    }

    if (media.extracted_status === 'done') {
      toast.success('Trascrizione completata!');
      setTranscribingMediaId(null);
    } else if (media.extracted_status === 'failed') {
      toast.error('Trascrizione fallita. Puoi pubblicare comunque.');
      setTranscribingMediaId(null);
    }
  }, [uploadedMedia, transcribingMediaId]);

  // [NEW] Handler per trascrizione video - persistent state until DB confirms
  const handleRequestTranscription = async (mediaId: string) => {
    if (transcribingMediaId) return; // Prevent if already transcribing any media

    setTranscribingMediaId(mediaId);
    toast.info('Trascrizione avviata...', { duration: 3000 });

    const result = await requestTranscription(mediaId);

    if (!result.success) {
      // Immediate failure - reset state and show detailed error
      setTranscribingMediaId(null);

      const errorMessages: Record<string, string> = {
        'video_too_long': 'Video troppo lungo (max 3 minuti)',
        'file_too_large': 'File troppo pesante per la trascrizione',
        'service_unavailable': 'Servizio temporaneamente non disponibile',
        'transcription_failed': 'Trascrizione fallita. Puoi pubblicare senza test.',
        'already_processing': 'Trascrizione già in corso',
        'invalid_media': 'Media non valido',
        'db_error': 'Errore di connessione. Riprova.'
      };

      const message = errorMessages[result.errorCode || ''] || result.error || 'Impossibile avviare la trascrizione';
      toast.error(message);
    }
    // If success, do NOT reset transcribingMediaId - wait for polling to confirm done/failed
  };

  // Handler per OCR immagini (on-demand)
  const handleRequestOCR = async (mediaId: string) => {
    try {
      const success = await requestOCR(mediaId);
      if (success) {
        toast.info('Estrazione testo in corso...');
      }
    } catch (error) {
      toast.error('Errore durante l\'estrazione del testo');
    }
  };

  // Infographic AI generation handler
  const handleGenerateInfographic = async () => {
    if (isGeneratingInfographic || wordCount < 50) return;
    try {
      setIsGeneratingInfographic(true);
      setShowAnalysisOverlay(true);
      const isDark = document.documentElement.classList.contains('dark');
      const { data, error } = await supabase.functions.invoke('generate-infographic', {
        body: { text: content, theme: isDark ? 'dark' : 'light' }
      });
      if (error) throw new Error('Errore di rete');
      if (data?.error) {
        if (data.status === 429) toast.error('Troppi tentativi, riprova tra poco');
        else if (data.status === 402) toast.error('Crediti AI esauriti');
        else toast.error(data.error);
        return;
      }
      addExternalMedia({ id: data.mediaId, type: 'image', url: data.url });
      toast.success('Infografica generata!');
    } catch (err) {
      console.error('[Composer] Infographic error:', err);
      toast.error("Impossibile generare l'infografica. Riprova.");
    } finally {
      setIsGeneratingInfographic(false);
      setShowAnalysisOverlay(false);
    }
  };

  // Intent gate: require 30+ words when in intent mode (excluding URL from count)
  const wordCount = getWordCount(content);
  // For intent mode, exclude the URL from word count so it doesn't count toward 30 words
  const textWithoutUrl = detectedUrl ? content.replace(detectedUrl, '').trim() : content;
  const intentWordCount = getWordCount(textWithoutUrl);
  const intentWordsMet = !intentMode || intentWordCount >= 30;
  const hasPendingExtraction = uploadedMedia.some(m => m.extracted_status === 'pending');

  // [NEW] Track pending transcription separately for UX feedback
  const hasPendingTranscription = uploadedMedia.some(m =>
    m.extracted_status === 'pending' && m.extracted_kind === 'transcript'
  );

  // [NEW] Combined flag: local transcribingMediaId OR DB pending state
  // This ensures UI stays locked even during the initial DB update window
  const isTranscriptionInProgress = !!transcribingMediaId || hasPendingTranscription;

  // [NEW] Block publish during transcription
  const canPublish = !hasPendingExtraction && !transcribingMediaId && (content.trim().length > 0 || uploadedMedia.length > 0 || !!detectedUrl || !!quotedPost) && intentWordsMet;
  const isLoading = isPublishing || isGeneratingQuiz || isFinalizingPublish;

  // Note: Toast on transcription completion is now handled by the transcribingMediaId reset effect above

  // Find media with extracted text (OCR/transcription) sufficient for gate (>120 chars)
  const mediaWithExtractedText = uploadedMedia.find(m =>
    m.extracted_status === 'done' &&
    m.extracted_text &&
    m.extracted_text.length > 120
  );

  // [FIX] Check if quotedPost has media with OCR/transcription (for reshares)
  const quotedPostMediaWithExtractedText = quotedPost?.media?.find((m: any) =>
    m.extracted_status === 'done' &&
    m.extracted_text &&
    m.extracted_text.length > 120
  );

  // [FIX] Word count of the ORIGINAL quoted post (source) - used for reshare gate logic
  // The resharer is tested on the SOURCE content, NEVER on their own comment
  const quotedPostWordCount = quotedPost?.content ? getWordCount(quotedPost.content) : 0;

  // Gate status indicator (real-time feedback)
  // Character-based gate applies ONLY to reshares (quotedPost), not free text
  const gateStatus = (() => {
    // [FIX] Gate already passed in Feed Reader - bypass
    if (quotedPost?._gatePassed === true) {
      return { label: 'Quiz già superato', requiresGate: false };
    }

    // Gate attivo se c'è un URL
    if (detectedUrl) {
      return { label: 'Gate attivo', requiresGate: true };
    }

    // [FIX] Check media gate logic for DIRECT UPLOADS (new media, not reshare)
    // REGOLA D'ORO: L'autore non fa mai il test sul proprio commento
    // Usa getMediaGateForComposer che ignora wordCount e testa SOLO sull'OCR
    if (uploadedMedia.length > 0 && !quotedPost) {
      const hasExtracted = !!mediaWithExtractedText;
      const mediaGate = getMediaGateForComposer(hasExtracted);

      if (mediaGate.gateRequired) {
        // Per upload diretti con OCR, sempre SOURCE_ONLY (3 domande sul media)
        const activeMedia = mediaWithExtractedText;
        return {
          label: activeMedia?.extracted_kind === 'ocr'
            ? 'Gate OCR attivo'
            : 'Gate trascrizione attivo',
          requiresGate: true
        };
      }
      // Media senza OCR o commento qualsiasi: nessun gate per l'autore
      return { label: 'Nessun gate', requiresGate: false };
    }

    // [FIX] Gate per reshare di post con media OCR/trascrizione
    // Usa le parole del POST ORIGINALE (quotedPost.content), NON il commento del resharer
    if (quotedPostMediaWithExtractedText) {
      const mediaGate = getMediaTestMode(quotedPostWordCount, true);
      if (mediaGate.testMode === 'SOURCE_ONLY') {
        return {
          label: quotedPostMediaWithExtractedText?.extracted_kind === 'ocr'
            ? 'Gate OCR (fonte)'
            : 'Gate trascrizione (fonte)',
          requiresGate: true
        };
      } else if (mediaGate.testMode === 'MIXED') {
        return { label: 'Gate mixed (fonte)', requiresGate: true };
      } else {
        return { label: 'Gate completo (fonte)', requiresGate: true };
      }
    }

    // [FIX] Gate per reshare di post TEXT-ONLY (senza media, senza URL nel post originale)
    // L'utente che ricondivide fa il test sul TESTO del POST ORIGINALE
    // Il commento che scrive nel composer NON viene MAI usato per il gate
    if (quotedPost && !quotedPostMediaWithExtractedText) {
      if (quotedPostWordCount > 120) {
        return { label: 'Gate completo (fonte)', requiresGate: true };
      }
      if (quotedPostWordCount > 30) {
        return { label: 'Gate light (fonte)', requiresGate: true };
      }
      // Post originale ≤30 parole: nessun gate
      return { label: 'Nessun gate', requiresGate: false };
    }

    // Nessun gate per testo libero senza URL
    return { label: 'Nessun gate', requiresGate: false };
  })();

  // Reset all state for clean composer on reopen
  const resetAllState = () => {
    setContent('');
    setDetectedUrl(null);
    setUrlPreview(null);
    setIsPreviewLoading(false);
    setContentCategory(null);
    setShowReader(false);
    setReaderClosing(false);
    setShowQuiz(false);
    setQuizData(null);
    setQuizPassed(false);
    setIntentMode(false);
    clearMedia();
  };

  // Reset state when modal opens to ensure clean state for new posts
  useEffect(() => {
    if (isOpen) {
      // Only reset if there's residual state from previous session
      if (showReader || showQuiz || quizData || readerClosing) {
        console.log('[ComposerModal] Resetting residual state on open');
        resetAllState();
      }
    }
  }, [isOpen]);

  // Handle content change from Tiptap editor
  const handleEditorChange = (markdown: string, plainText: string) => {
    setContent(markdown);
  };

  // Rich Text formatting via Tiptap
  const applyFormatting = (format: 'bold' | 'italic' | 'underline') => {
    haptics.light();
    if (!editorRef.current) return;

    switch (format) {
      case 'bold':
        editorRef.current.toggleBold();
        break;
      case 'italic':
        editorRef.current.toggleItalic();
        break;
      case 'underline':
        editorRef.current.toggleUnderline();
        break;
    }
  };

  useEffect(() => {
    const urls = content.match(URL_REGEX);
    if (urls && urls.length > 0) {
      const rawUrl = urls[0];
      const sanitizedUrl = sanitizeUrl(rawUrl);

      console.log('[Composer] URL detected:', {
        rawUrl,
        sanitizedUrl,
        hostname: (() => { try { return new URL(sanitizedUrl).hostname; } catch { return 'invalid'; } })()
      });

      if (sanitizedUrl !== detectedUrl) {
        setDetectedUrl(sanitizedUrl);
        loadPreview(sanitizedUrl);
      }
    } else if (!urls && detectedUrl) {
      setDetectedUrl(null);
      setUrlPreview(null);
    }
  }, [content]);

  const loadPreview = async (url: string) => {
    console.log('[Composer] loadPreview called for:', url);
    setIsPreviewLoading(true);
    setUrlPreview(null);
    setIntentMode(false); // Reset intent mode on new URL

    try {
      const host = new URL(url).hostname.toLowerCase();
      console.log('[Composer] URL hostname:', host);

      // For blocked platforms, we now fetch from edge function to get OpenGraph metadata
      // The edge function will return success=false but with metadata for the preview card

      // Fetch preview - main operation
      const preview = await fetchArticlePreview(url);
      console.log('[Composer] fetchArticlePreview result:', { success: preview?.success, error: preview?.error, contentQuality: preview?.contentQuality });

      // Check if content is blocked or minimal - activate Intent Mode
      if (!preview.success || preview.contentQuality === 'blocked' || preview.contentQuality === 'minimal') {
        console.log('[Composer] Intent mode activated - content not analyzable:', preview.error || preview.contentQuality);
        setIntentMode(true);
        setUrlPreview({
          url,
          platform: preview.platform || 'intent',
          contentQuality: preview.contentQuality || 'blocked',
          // Use metadata from OpenGraph if available, fallback to generic title
          title: preview.title || 'Contenuto non analizzabile',
          hostname: host,
          image: preview.image, // Image from OpenGraph
          author: preview.author, // Author from OpenGraph
          description: preview.description, // Description from OpenGraph
        });
        setIsPreviewLoading(false);
        return;
      }

      // Success - set preview IMMEDIATELY (don't block on classification)
      // FIX: Ensure qaSourceRef is always present for generateQA
      const buildQaSourceRef = (url: string, platform?: string) => {
        if (preview.qaSourceRef) return preview.qaSourceRef;

        try {
          const urlObj = new URL(url);
          const host = urlObj.hostname.toLowerCase();

          if (platform === 'youtube' || host.includes('youtube') || host.includes('youtu.be')) {
            const videoId = host.includes('youtu.be')
              ? urlObj.pathname.slice(1).split('?')[0]
              : urlObj.searchParams.get('v');
            if (videoId) return { kind: 'youtubeId' as const, id: videoId, url };
          }
          if (platform === 'spotify' || host.includes('spotify')) {
            const spotifyMatch = url.match(/track\/([a-zA-Z0-9]+)/);
            if (spotifyMatch) return { kind: 'spotifyId' as const, id: spotifyMatch[1], url };
          }
          if (platform === 'twitter' || host.includes('twitter') || host.includes('x.com')) {
            const tweetMatch = url.match(/status\/(\d+)/);
            if (tweetMatch) return { kind: 'tweetId' as const, id: tweetMatch[1], url };
          }
        } catch { }

        return { kind: 'url' as const, id: url, url };
      };

      const qaSourceRef = buildQaSourceRef(url, preview.platform);
      setUrlPreview({ url, ...preview, qaSourceRef });
      setIsPreviewLoading(false); // Show preview now

      // Classification in background - non-blocking
      classifyContent({
        text: content,
        title: preview.title,
        summary: preview.content || preview.summary || preview.excerpt
      }).then(setContentCategory).catch((err) => {
        console.warn('[Composer] Classification failed (non-blocking):', err);
      });

      return; // Early return since we already set loading=false
    } catch (error) {
      console.error('[Composer] Error loading preview:', error);
      toast.error('Errore nel caricamento dell\'anteprima.');
      setDetectedUrl(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handlePublish = async () => {
    // Allow publish if user has text, media, a detected URL, or a quoted post (reshare)
    if (!user || (!content.trim() && !detectedUrl && uploadedMedia.length === 0 && !quotedPost)) return;

    addBreadcrumb('publish_attempt', { hasUrl: !!detectedUrl, hasMediaOCR: !!mediaWithExtractedText, isIOS });

    // [FIX] BYPASS GATE if user already passed quiz in Feed Reader
    if (quotedPost?._gatePassed === true) {
      console.log('[Composer] Gate bypass - quiz already passed in Feed Reader');
      addBreadcrumb('gate_bypass', { reason: '_gatePassed' });
      await publishPost();
      return;
    }

    console.log('[Composer] handlePublish called:', {
      detectedUrl,
      isPreviewLoading,
      urlPreviewSuccess: urlPreview?.success,
      urlPreviewError: urlPreview?.error,
      hasMediaOCR: !!mediaWithExtractedText,
      isIOS
    });

    // [EXISTING] Branch for URL-based content
    if (detectedUrl) {
      // Wait for preview to finish loading
      if (isPreviewLoading) {
        toast.info('Sto caricando l\'anteprima...');
        return;
      }

      // Intent Mode: Skip reader/quiz, publish directly with user text as source
      if (intentMode) {
        if (intentWordCount < 30) {
          toast.error('Aggiungi almeno 30 parole per pubblicare questo contenuto.');
          return;
        }
        console.log('[Composer] Intent mode publish - skipping reader/quiz');
        addBreadcrumb('intent_mode_publish');
        await publishPost(true); // Pass isIntent flag
        return;
      }

      // Check if preview failed or doesn't exist
      if (!urlPreview || urlPreview.success === false) {
        console.log('[Composer] Cannot open reader - preview failed or missing');
        toast.error(urlPreview?.message || 'Impossibile recuperare il contenuto della fonte.');
        return;
      }

      // All platforms: Use reader experience
      console.log('[Composer] Opening reader with valid preview');
      addBreadcrumb('reader_open');
      setReaderClosing(false);
      setShowReader(true);
      return;
    }

    // [NEW] Branch for media uploads - use getMediaTestMode for consistent logic
    // [FIX] Branch for DIRECT media uploads (author) - REGOLA D'ORO
    // L'autore non fa MAI il test sul proprio commento, solo sull'OCR/trascrizione
    if (uploadedMedia.length > 0 && !quotedPost) {
      // Check for any media with extracted text (single or multi-media)
      const mediaWithText = uploadedMedia.filter(m =>
        m.extracted_status === 'done' &&
        m.extracted_text &&
        m.extracted_text.length > 50 // Lower threshold for carousel aggregation
      );
      const hasExtracted = mediaWithText.length > 0;
      const mediaGate = getMediaGateForComposer(hasExtracted);

      console.log('[Composer] Direct media gate (author):', {
        hasExtracted,
        mediaWithTextCount: mediaWithText.length,
        gateRequired: mediaGate.gateRequired,
        testMode: mediaGate.testMode,
        questionCount: mediaGate.questionCount,
        note: 'Author wordCount ignored per Golden Rule'
      });

      if (mediaGate.gateRequired) {
        // For multi-media, use aggregated text; for single, use single media
        if (mediaWithText.length > 1) {
          // Multi-media: generate quiz on aggregated text
          const aggregatedText = getAggregatedExtractedText();

          addBreadcrumb('multi_media_gate_start', {
            mediaCount: mediaWithText.length,
            aggregatedTextLength: aggregatedText.length,
            testMode: 'SOURCE_ONLY',
            questionCount: 3
          });

          await handleAggregatedMediaGateFlow(aggregatedText);
          return;
        } else {
          // Single media with extracted text
          const targetMedia = mediaWithText[0];

          addBreadcrumb('media_gate_start', {
            mediaId: targetMedia.id,
            kind: targetMedia.extracted_kind || 'ocr',
            testMode: 'SOURCE_ONLY',
            questionCount: 3
          });

          await handleMediaGateFlow(
            targetMedia,
            'SOURCE_ONLY',
            3
          );
          return;
        }
      }
      // No OCR = no gate per l'autore - pubblica direttamente
    }

    // [FIX] Branch for reshare of post with media OCR/transcription
    // Use quotedPostWordCount (SOURCE content), NOT wordCount (resharer's comment)
    if (quotedPostMediaWithExtractedText && quotedPost) {
      const mediaGate = getMediaTestMode(quotedPostWordCount, true); // Use SOURCE word count

      console.log('[Composer] Reshare media gate evaluation:', {
        quotedPostWordCount, // Log source word count, not user's
        testMode: mediaGate.testMode,
        questionCount: mediaGate.questionCount
      });

      addBreadcrumb('reshare_media_gate_start', {
        mediaId: quotedPostMediaWithExtractedText.id,
        kind: quotedPostMediaWithExtractedText.extracted_kind,
        testMode: mediaGate.testMode,
        questionCount: mediaGate.questionCount
      });

      await handleQuotedMediaGateFlow(
        quotedPostMediaWithExtractedText,
        mediaGate.testMode as 'SOURCE_ONLY' | 'MIXED' | 'USER_ONLY',
        mediaGate.questionCount as 1 | 3
      );
      return;
    }

    // [FIX] Branch for reshare of text-only posts (no media, no URL in original)
    // Gate based on ORIGINAL post content (source), NEVER on resharer's comment
    if (quotedPost && !quotedPostMediaWithExtractedText && !detectedUrl) {
      if (quotedPostWordCount > 30) {
        console.log('[Composer] Reshare text-only gate, source words:', quotedPostWordCount);

        addBreadcrumb('reshare_textonly_gate_start', {
          quotedPostWordCount,
          questionCount: quotedPostWordCount > 120 ? 3 : 1
        });

        // Generate quiz directly on the quoted post's content
        await handleReshareTextOnlyGateFlow(quotedPostWordCount > 120 ? 3 : 1);
        return;
      }
      // ≤30 words in original post: no gate, publish directly
      console.log('[Composer] Reshare text-only, no gate needed (source ≤30 words)');
      await publishPost();
      return;
    }

    // [EXISTING] Fallback: no gate required
    await publishPost();
  };

  // [NEW] Handle media gate flow (OCR/transcription) - similar to handleIOSQuizOnlyFlow
  const handleMediaGateFlow = async (
    media: typeof uploadedMedia[0],
    overrideTestMode?: 'SOURCE_ONLY' | 'MIXED' | 'USER_ONLY',
    overrideQuestionCount?: 1 | 3
  ) => {
    if (isGeneratingQuiz) return;

    try {
      setIsGeneratingQuiz(true);
      addBreadcrumb('media_generating_quiz', { testMode: overrideTestMode, questionCount: overrideQuestionCount });

      // [UX CHANGE] Use overlay instead of toast
      setShowAnalysisOverlay(true);

      const result = await generateQA({
        contentId: null,
        isPrePublish: true,
        title: '', // Media doesn't have a title
        qaSourceRef: { kind: 'mediaId', id: media.id },
        sourceUrl: undefined,
        userText: content,
        testMode: overrideTestMode || 'SOURCE_ONLY',
        questionCount: overrideQuestionCount || 3,
      });

      setShowAnalysisOverlay(false);
      addBreadcrumb('media_qa_generated', {
        hasQuestions: !!result.questions,
        error: result.error,
        pending: result.pending
      });

      if (result.pending) {
        toast.info('Estrazione testo in corso, riprova tra qualche secondo...');
        setIsGeneratingQuiz(false);
        return;
      }

      if (result.insufficient_context) {
        // Text insufficient: fallback to Intent Gate
        console.log('[Composer] Media text insufficient, activating intent mode');
        toast.warning('Testo insufficiente per il test. Aggiungi almeno 30 parole.');
        setIntentMode(true);
        setIsGeneratingQuiz(false);
        return;
      }

      if (result.error || !result.questions) {
        // [NEW] Allow publish without test when quiz generation fails
        console.error('[ComposerModal] Media quiz generation failed:', result.error);
        toast.warning('Test non disponibile. Puoi pubblicare comunque.', { duration: 5000 });
        setIsGeneratingQuiz(false);
        addBreadcrumb('media_quiz_failed_publish_anyway');
        await publishPost(); // Proceed without gate
        return;
      }

      // Show quiz
      setQuizData({
        qaId: result.qaId,
        questions: result.questions,
        sourceUrl: `media://${media.id}`, // Special identifier for media
      });
      setShowQuiz(true);
      addBreadcrumb('media_quiz_mount');

    } catch (error) {
      console.error('[ComposerModal] Media gate flow error:', error);
      // toast.dismiss();
      toast.error('Errore durante la generazione del quiz. Riprova.');
      addBreadcrumb('media_gate_error', { error: String(error) });
    } finally {
      setIsGeneratingQuiz(false);
      setShowAnalysisOverlay(false);
    }
  };

  // [NEW] Handle multi-media gate with aggregated text
  const handleAggregatedMediaGateFlow = async (aggregatedText: string) => {
    try {
      setIsGeneratingQuiz(true);
      addBreadcrumb('aggregated_media_generating_quiz', { textLength: aggregatedText.length });

      // [UX CHANGE] Use overlay instead of toast
      setShowAnalysisOverlay(true);

      const result = await generateQA({
        contentId: null,
        isPrePublish: true,
        title: 'Contenuto multi-media',
        qaSourceRef: { kind: 'url', id: 'media://aggregated', url: 'media://aggregated' },
        sourceUrl: undefined,
        userText: aggregatedText, // Use aggregated text as source
        testMode: 'SOURCE_ONLY',
        questionCount: 3,
      });

      setShowAnalysisOverlay(false);
      addBreadcrumb('aggregated_media_qa_generated', {
        hasQuestions: !!result.questions,
        error: result.error
      });

      if (result.insufficient_context) {
        console.log('[Composer] Aggregated media text insufficient');
        toast.warning('Testo estratto insufficiente. Puoi pubblicare comunque.', { duration: 5000 });
        setIsGeneratingQuiz(false);
        await publishPost();
        return;
      }

      if (result.error || !result.questions) {
        console.error('[ComposerModal] Aggregated media quiz generation failed:', result.error);
        toast.warning('Test non disponibile. Puoi pubblicare comunque.', { duration: 5000 });
        setIsGeneratingQuiz(false);
        addBreadcrumb('aggregated_media_quiz_failed_publish_anyway');
        await publishPost();
        return;
      }

      setQuizData({
        qaId: result.qaId,
        questions: result.questions,
        sourceUrl: 'media://aggregated',
      });
      setShowQuiz(true);
      addBreadcrumb('aggregated_media_quiz_mount');

    } catch (error) {
      console.error('[ComposerModal] Aggregated media gate flow error:', error);
      // toast.dismiss();
      toast.error('Errore durante la generazione del quiz. Riprova.');
      addBreadcrumb('aggregated_media_gate_error', { error: String(error) });
    } finally {
      setIsGeneratingQuiz(false);
      setShowAnalysisOverlay(false);
    }
  };

  // [FIX] Handle reshare of post with media OCR/transcription
  const handleQuotedMediaGateFlow = async (
    media: any,
    overrideTestMode?: 'SOURCE_ONLY' | 'MIXED' | 'USER_ONLY',
    overrideQuestionCount?: 1 | 3
  ) => {
    if (isGeneratingQuiz) return;

    try {
      setIsGeneratingQuiz(true);
      addBreadcrumb('reshare_media_generating_quiz', { testMode: overrideTestMode, questionCount: overrideQuestionCount });

      // [UX CHANGE] Use overlay instead of toast
      setShowAnalysisOverlay(true);

      const result = await generateQA({
        contentId: quotedPost?.id || null,
        isPrePublish: true,
        title: '', // Media doesn't have a title
        qaSourceRef: { kind: 'mediaId', id: media.id },
        sourceUrl: undefined,
        userText: content,
        testMode: overrideTestMode || 'SOURCE_ONLY',
        questionCount: overrideQuestionCount || 3,
        quotedPostId: quotedPost?.id, // Reshare: reuse original quiz if exists
      });

      setShowAnalysisOverlay(false);
      addBreadcrumb('reshare_media_qa_generated', {
        hasQuestions: !!result.questions,
        error: result.error,
        pending: result.pending
      });

      // Handle pending (extraction still in progress - should not happen for reshare)
      if (result.pending) {
        toast.info('Estrazione testo in corso, riprova tra qualche secondo...');
        setIsGeneratingQuiz(false);
        return;
      }

      if (result.insufficient_context) {
        // Text insufficient: fallback to Intent Gate
        console.log('[Composer] Reshare media text insufficient, activating intent mode');
        toast.warning('Testo insufficiente per il test. Aggiungi almeno 30 parole.');
        setIntentMode(true);
        setIsGeneratingQuiz(false);
        return;
      }

      if (result.error || !result.questions) {
        // [FIX] Block publish if reshare quiz lookup failed - this should not happen
        console.error('[ComposerModal] Reshare media quiz lookup/generation failed:', result.error);
        toast.error('Impossibile recuperare il test originale. Riprova.', { duration: 5000 });
        setIsGeneratingQuiz(false);
        addBreadcrumb('reshare_media_quiz_failed_blocked');
        return;
      }

      // Show quiz
      setQuizData({
        qaId: result.qaId,
        questions: result.questions,
        sourceUrl: `media://${media.id}`, // Special identifier for media
      });
      setShowQuiz(true);
      addBreadcrumb('reshare_media_quiz_mount');

    } catch (error) {
      console.error('[ComposerModal] Reshare media gate flow error:', error);
      // toast.dismiss();
      toast.error('Errore durante la generazione del quiz. Riprova.');
      addBreadcrumb('reshare_media_gate_error', { error: String(error) });
    } finally {
      setIsGeneratingQuiz(false);
      setShowAnalysisOverlay(false);
    }
  };

  // [FIX] Handle reshare of text-only posts - quiz on the original post's content
  // The resharer is tested on the SOURCE (quotedPost.content), not their own comment
  const handleReshareTextOnlyGateFlow = async (questionCount: 1 | 3) => {
    if (isGeneratingQuiz || !quotedPost || !user) return;

    try {
      setIsGeneratingQuiz(true);
      addBreadcrumb('reshare_textonly_generating_quiz', { questionCount });

      // [UX CHANGE] Use overlay instead of toast
      setShowAnalysisOverlay(true);

      const result = await generateQA({
        contentId: quotedPost.id,
        isPrePublish: true,
        title: quotedPost.author?.full_name || quotedPost.author?.username || 'Post',
        // For text-only posts, use 'url' kind with post:// protocol
        qaSourceRef: { kind: 'url', id: `post://${quotedPost.id}`, url: `post://${quotedPost.id}` },
        sourceUrl: undefined,
        userText: quotedPost.content, // Use SOURCE text, not resharer's comment
        testMode: 'USER_ONLY', // Test on the original author's text
        questionCount,
        quotedPostId: quotedPost.id, // Reshare: reuse original quiz if exists
      });

      setShowAnalysisOverlay(false);
      addBreadcrumb('reshare_textonly_qa_generated', {
        hasQuestions: !!result.questions,
        error: result.error
      });

      if (result.insufficient_context) {
        // Should not happen since we already checked >30 words
        console.log('[Composer] Reshare text-only insufficient context');
        toast.warning('Testo insufficiente per il test.');
        setIsGeneratingQuiz(false);
        return;
      }

      if (result.error || !result.questions) {
        // [FIX] Block publish if reshare quiz lookup failed - this should not happen
        console.error('[ComposerModal] Reshare text-only quiz lookup/generation failed:', result.error);
        toast.error('Impossibile recuperare il test originale. Riprova.', { duration: 5000 });
        setIsGeneratingQuiz(false);
        addBreadcrumb('reshare_textonly_quiz_failed_blocked');
        return;
      }

      // Show quiz - user will be tested on the original post's content
      setQuizData({
        qaId: result.qaId,
        questions: result.questions,
        sourceUrl: `post://${quotedPost.id}`,
      });
      setShowQuiz(true);
      addBreadcrumb('reshare_textonly_quiz_mount');

    } catch (error) {
      console.error('[ComposerModal] Reshare text-only gate flow error:', error);
      // toast.dismiss();
      toast.error('Errore durante la generazione del quiz. Riprova.');
      addBreadcrumb('reshare_textonly_gate_error', { error: String(error) });
    } finally {
      setIsGeneratingQuiz(false);
      setShowAnalysisOverlay(false);
    }
  };

  // FIXED: Uses qaSourceRef instead of full-text summary, blocks publish on failure
  const handleIOSQuizOnlyFlow = async () => {
    if (isGeneratingQuiz || !urlPreview || !user) return;

    try {
      setIsGeneratingQuiz(true);
      addBreadcrumb('ios_generating_quiz');

      // Check if qaSourceRef is available (required for source-first)
      if (!urlPreview.qaSourceRef) {
        console.error('[ComposerModal] iOS: Missing qaSourceRef');
        toast.error('Impossibile avviare il test: riferimento mancante. Riprova.');
        setIsGeneratingQuiz(false);
        return;
      }

      // Share originale (nessun quotedPost) → sempre SOURCE_ONLY
      // Il commento dell'utente è suo, non ha senso testarlo su ciò che ha scritto lui
      // Reshare (quotedPost presente) → valuta il commento dell'autore ORIGINALE
      const isReshare = !!quotedPost;
      let testMode: 'SOURCE_ONLY' | 'MIXED' | 'USER_ONLY';

      if (isReshare && quotedPost.content) {
        const originalAuthorWordCount = getWordCount(quotedPost.content);
        testMode = getTestModeWithSource(originalAuthorWordCount);
      } else {
        testMode = 'SOURCE_ONLY';
      }

      // [UX CHANGE] Use overlay instead of toast
      setShowAnalysisOverlay(true);

      const result = await generateQA({
        contentId: null,
        isPrePublish: true,
        title: urlPreview.title || '',
        qaSourceRef: urlPreview.qaSourceRef,
        sourceUrl: detectedUrl || undefined,
        userText: content,
        testMode: testMode,
      });

      setShowAnalysisOverlay(false);
      addBreadcrumb('ios_qa_generated', { hasQuestions: !!result.questions, error: result.error, error_code: result.error_code });

      // NEW: Handle validation errors with retry UI
      if (result.error_code) {
        addBreadcrumb('ios_validation_error', { code: result.error_code });
        setQuizData({
          errorState: {
            code: result.error_code,
            message: result.message || 'Errore nell\'analisi'
          },
          onRetry: handleRetryWithCacheClear,
          onCancel: () => {
            addBreadcrumb('quiz_closed', { via: 'error_cancelled' });
            setShowQuiz(false);
            setQuizData(null);
          }
        });
        setShowQuiz(true);
        setIsGeneratingQuiz(false);
        return;
      }

      if (result.insufficient_context) {
        toast.error('Contenuto insufficiente per generare il test');
        addBreadcrumb('ios_insufficient');
        setIsGeneratingQuiz(false);
        return; // DO NOT publish - block
      }

      if (result.error || !result.questions) {
        console.error('[ComposerModal] iOS Quiz generation failed:', result.error);
        toast.error('Errore generazione quiz. Riprova.');
        addBreadcrumb('ios_quiz_error', { error: result.error });
        setIsGeneratingQuiz(false);
        return; // DO NOT publish - block
      }

      // Show quiz directly (no reader) - include qaId
      addBreadcrumb('ios_quiz_mount');
      setQuizData({
        qaId: result.qaId,
        questions: result.questions,
        sourceUrl: detectedUrl || '',
      });
      setShowQuiz(true);

    } catch (error) {
      console.error('[ComposerModal] iOS quiz flow error:', error);
      // toast.dismiss();
      toast.error('Errore durante la generazione del quiz. Riprova.');
      addBreadcrumb('ios_quiz_flow_error', { error: String(error) });
      // DO NOT publish on error - gate is mandatory
    } finally {
      setIsGeneratingQuiz(false);
      setShowAnalysisOverlay(false);
    }
  };

  // NEW: Handler for retry with cache invalidation
  const handleRetryWithCacheClear = async () => {
    if (!urlPreview?.qaSourceRef || !user) return;

    try {
      addBreadcrumb('quiz_closed', { via: 'retry_start' });
      setShowQuiz(false);
      setQuizData(null);
      setIsGeneratingQuiz(true);

      // [UX CHANGE] Use overlay instead of toast
      setShowAnalysisOverlay(true);
      // toast.loading('Riprovo l\'analisi con dati freschi…');

      const isReshare = !!quotedPost;
      let testMode: 'SOURCE_ONLY' | 'MIXED' | 'USER_ONLY';

      if (isReshare && quotedPost?.content) {
        const originalAuthorWordCount = getWordCount(quotedPost.content);
        testMode = getTestModeWithSource(originalAuthorWordCount);
      } else {
        testMode = 'SOURCE_ONLY';
      }

      const result = await generateQA({
        contentId: null,
        isPrePublish: true,
        title: urlPreview?.title || '',
        qaSourceRef: urlPreview.qaSourceRef,
        sourceUrl: detectedUrl || urlPreview?.url,
        userText: content,
        testMode: testMode,
        forceRefresh: true, // KEY: Clear cache before retry
      });

      setShowAnalysisOverlay(false);
      // toast.dismiss();

      // Handle same error again → Fallback to Intent Mode
      if (result.error_code) {
        toast.dismiss();
        console.log('[ComposerModal] Second retry failed, activating Intent Mode');
        addBreadcrumb('retry_fallback_intent', { code: result.error_code });

        // Close quiz modal and clean state
        addBreadcrumb('quiz_closed', { via: 'retry_fallback' });
        setShowQuiz(false);
        setQuizData(null);
        setIsGeneratingQuiz(false);

        // Activate Intent Mode
        setIntentMode(true);

        // Show friendly message
        toast.info('Contenuto non analizzabile. Aggiungi almeno 30 parole per condividere.');

        return;
      }

      if (result.error || !result.questions) {
        toast.dismiss();
        console.log('[ComposerModal] Second retry error, activating Intent Mode');
        addBreadcrumb('retry_error_intent', { error: result.error });

        addBreadcrumb('quiz_closed', { via: 'retry_error' });
        setShowQuiz(false);
        setQuizData(null);
        setIsGeneratingQuiz(false);

        setIntentMode(true);
        toast.info('Contenuto non analizzabile. Aggiungi almeno 30 parole per condividere.');

        return;
      }

      // Success! Show quiz
      addBreadcrumb('retry_quiz_success');
      setQuizData({
        qaId: result.qaId,
        questions: result.questions,
        sourceUrl: detectedUrl || urlPreview?.url || '',
      });
      setShowQuiz(true);

    } catch (error) {
      // toast.dismiss();
      toast.error('Errore durante il retry. Riprova più tardi.');
      addBreadcrumb('retry_error', { error: String(error) });
    } finally {
      setIsGeneratingQuiz(false);
      setShowAnalysisOverlay(false);
    }
  };

  const closeReaderSafely = async (preserveUrlState = false) => {
    addBreadcrumb('reader_close_start');
    setReaderClosing(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    setShowReader(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    setReaderClosing(false);

    // Reset URL state when user closes without completing (allows new URL detection)
    if (!preserveUrlState) {
      setDetectedUrl(null);
      setUrlPreview(null);
    }

    addBreadcrumb('reader_closed');
  };

  const handleReaderComplete = async () => {
    if (isGeneratingQuiz) return;

    addBreadcrumb('reader_complete_start');

    try {
      if (!urlPreview || !user) {
        await closeReaderSafely(false);
        return;
      }

      // Check if qaSourceRef is available (required for source-first)
      if (!urlPreview.qaSourceRef) {
        console.error('[ComposerModal] Missing qaSourceRef');
        toast.error('Impossibile avviare il test: riferimento mancante. Riprova.');
        await closeReaderSafely(false);
        return; // DO NOT publish
      }

      setIsGeneratingQuiz(true);

      // Share originale (nessun quotedPost) → sempre SOURCE_ONLY
      // Il commento dell'utente è suo, non ha senso testarlo su ciò che ha scritto lui
      // Reshare (quotedPost presente) → valuta il commento dell'autore ORIGINALE
      const isReshare = !!quotedPost;
      let testMode: 'SOURCE_ONLY' | 'MIXED' | 'USER_ONLY';

      if (isReshare && quotedPost.content) {
        const originalAuthorWordCount = getWordCount(quotedPost.content);
        testMode = getTestModeWithSource(originalAuthorWordCount);
      } else {
        testMode = 'SOURCE_ONLY';
      }

      // [UX CHANGE] Use overlay instead of toast
      setShowAnalysisOverlay(true);
      // toast.loading('Stiamo mettendo a fuoco ciò che conta…');

      const result = await generateQA({
        contentId: null,
        isPrePublish: true,
        title: urlPreview.title || '',
        qaSourceRef: urlPreview.qaSourceRef,
        sourceUrl: detectedUrl || undefined,
        userText: content,
        testMode: testMode,
      });

      setShowAnalysisOverlay(false);
      // toast.dismiss();

      // NEW: Handle validation errors with retry UI
      if (result.error_code) {
        addBreadcrumb('reader_validation_error', { code: result.error_code });
        await closeReaderSafely(true);
        setQuizData({
          errorState: {
            code: result.error_code,
            message: result.message || 'Errore nell\'analisi'
          },
          onRetry: handleRetryWithCacheClear,
          onCancel: () => {
            addBreadcrumb('quiz_closed', { via: 'error_cancelled' });
            setShowQuiz(false);
            setQuizData(null);
          }
        });
        setShowQuiz(true);
        setIsGeneratingQuiz(false);
        return;
      }

      if (result.insufficient_context) {
        toast.error('Contenuto insufficiente per generare il test');
        addBreadcrumb('quiz_insufficient');
        await closeReaderSafely(false);
        return; // DO NOT publish - block
      }

      // Minimal validation: just check it's a non-empty array
      const hasQuestions = Array.isArray(result.questions) && result.questions.length > 0;

      if (result.error || !hasQuestions) {
        console.error('[ComposerModal] Quiz generation failed:', {
          error: result.error,
          hasQuestions
        });
        addBreadcrumb('quiz_unavailable');
        toast.error('Quiz non disponibile. Riprova.');
        await closeReaderSafely(false);
        return; // DO NOT publish - block
      }

      // Mount quiz first, then close reader (prevents intermediate blank state)
      // Include qaId for server-side validation
      setQuizData({
        qaId: result.qaId,
        questions: result.questions,
        sourceUrl: detectedUrl || '',
      });
      setShowQuiz(true);
      addBreadcrumb('quiz_mount');

      // Wait one frame to ensure quiz is rendered above reader
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      // NOW close reader (quiz is already visible on top) - preserve URL state
      await closeReaderSafely(true);
    } catch (error) {
      console.error('[ComposerModal] handleReaderComplete error:', error);
      toast.dismiss();
      toast.error('Errore durante la generazione del quiz. Riprova.');
      addBreadcrumb('quiz_error', { error: String(error) });

      try {
        await closeReaderSafely(false);
      } catch (closeError) {
        console.error('[ComposerModal] closeReaderSafely error:', closeError);
      }
      // DO NOT publish on error - gate is mandatory
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleQuizSubmit = async (answers: Record<string, string>) => {
    if (!user || !quizData) return { passed: false, score: 0, total: 0, wrongIndexes: [] };

    try {
      // SECURITY HARDENED: Include qaId for server-side validation
      const { data, error } = await supabase.functions.invoke('submit-qa', {
        body: {
          qaId: quizData.qaId,
          postId: null,
          sourceUrl: quizData.sourceUrl,
          answers,
          gateType: 'composer'
        }
      });

      if (error || !data) {
        console.error('Error validating quiz:', error);
        setQuizPassed(false);
        return { passed: false, score: 0, total: 0, wrongIndexes: [] };
      }

      // Use ONLY server verdict - no client override
      const passed = !!data.passed;
      setQuizPassed(passed);

      return data;
    } catch (error) {
      console.error('Error validating quiz:', error);
      setQuizPassed(false);
      return { passed: false, score: 0, total: 0, wrongIndexes: [] };
    }
  };

  const publishPost = async (isIntentPost = false) => {
    if (!user) return;

    setIsPublishing(true);

    // Mark publish flow started in localStorage for crash diagnostics
    localStorage.setItem('publish_flow_step', 'publish_started');
    localStorage.setItem('publish_flow_at', String(Date.now()));

    try {
      addBreadcrumb('publish_start', { hasUrl: !!detectedUrl, hasMedia: uploadedMedia.length > 0 });

      // Snapshot inputs (avoid state mutation issues during async)
      const snapshotDetectedUrl = detectedUrl;
      const snapshotPreview = urlPreview;
      const snapshotContent = content;
      const snapshotUploadedMedia = [...uploadedMedia];

      // If user pasted only a URL, stripping it would make content empty.
      // For reshares (quoted post) or media-only posts we allow an empty commentary.
      const strippedText = snapshotContent.replace(URL_REGEX, '').trim();
      const mediaIdsSnapshot = snapshotUploadedMedia.map((m) => m.id);

      // Detect if quoting an editorial
      const isQuotingEditorial = quotedPost?.shared_url?.startsWith('focus://') ||
        quotedPost?.author?.username === 'ilpunto';

      // FIX: For editorials with missing data, we need to fetch from the original source
      // The quotedPost might not have article_content populated (legacy posts)
      let editorialData = {
        shared_url: quotedPost?.shared_url,
        shared_title: quotedPost?.shared_title,
        article_content: quotedPost?.article_content,
        preview_img: quotedPost?.preview_img,
      };

      if (isQuotingEditorial && (!editorialData.article_content || !editorialData.shared_title)) {
        console.log('[Composer] Editorial missing data, will rely on backend to fetch');
        addBreadcrumb('editorial_missing_data', {
          hasTitle: !!editorialData.shared_title,
          hasContent: !!editorialData.article_content
        });
      }
      const allowEmptyCommentary = !!quotedPost || mediaIdsSnapshot.length > 0;

      // NEVER auto-fill with title/excerpt - only use actual user-written text
      // This prevents duplicated text appearing in post cards
      const cleanContent = strippedText;

      // TEMP: Disable classification during publish to prevent crash/reload
      addBreadcrumb('publish_classify_skipped_by_client');

      // Reuse pending publish idempotency key if it matches the same payload (crash/retry)
      const pending = getPendingPublish();
      const isRecentPending = !!pending && pending.timestamp > Date.now() - 5 * 60 * 1000;

      const sameMedia =
        !!pending &&
        Array.isArray(pending.mediaIds) &&
        pending.mediaIds.length === mediaIdsSnapshot.length &&
        pending.mediaIds.every((id, idx) => id === mediaIdsSnapshot[idx]);

      const canReusePending =
        isRecentPending &&
        !!pending &&
        pending.content === cleanContent &&
        pending.sharedUrl === (snapshotDetectedUrl || null) &&
        pending.quotedPostId === (quotedPost?.id || null) &&
        sameMedia;

      const idempotencyKey = canReusePending
        ? pending!.idempotencyKey
        : generateIdempotencyKey(user.id);

      if (!canReusePending) {
        // Save pending publish BEFORE network call
        setPendingPublish({
          idempotencyKey,
          content: cleanContent,
          sharedUrl: snapshotDetectedUrl || null,
          quotedPostId: quotedPost?.id || null,
          mediaIds: mediaIdsSnapshot,
          timestamp: Date.now(),
        });
      }

      // Publish via backend function to avoid Safari crashes during direct DB writes
      addBreadcrumb('publish_insert_start', { contentLen: cleanContent.length, via: 'publish-post', idempotencyKey });

      let postId: string | undefined;
      let wasIdempotent = false;
      let usedFallback = false;

      // Use isQuotingEditorial already defined above

      try {
        // For Intent posts, pass metadata from urlPreview (extracted from OpenGraph/Firecrawl)
        const intentMetadata = isIntentPost && snapshotPreview ? {
          sharedTitle: snapshotPreview.title || null,
          previewImg: snapshotPreview.image || snapshotPreview.previewImg || null,
        } : {};

        const { data, error: fnError } = await supabase.functions.invoke('publish-post', {
          body: {
            content: cleanContent,
            // For editorials: embed metadata directly, don't use quoted_post_id
            sharedUrl: isQuotingEditorial ? editorialData.shared_url : (snapshotDetectedUrl || null),
            sharedTitle: isQuotingEditorial ? editorialData.shared_title : (intentMetadata.sharedTitle || null),
            previewImg: isQuotingEditorial ? editorialData.preview_img : (intentMetadata.previewImg || null),
            articleContent: isQuotingEditorial ? editorialData.article_content : null,
            quotedPostId: isQuotingEditorial ? null : (quotedPost?.id || null),
            mediaIds: mediaIdsSnapshot,
            idempotencyKey,
            isIntent: isIntentPost, // Intent Gate flag
          },
        });

        if (fnError) {
          // Log detailed error info
          const errInfo = {
            name: fnError.name,
            message: fnError.message,
            status: (fnError as any).status,
            context: (fnError as any).context,
          };
          console.error('[Publish] Edge function error:', errInfo);
          addBreadcrumb('publish_fn_error', errInfo);
          throw fnError;
        }

        postId = (data as any)?.postId as string | undefined;
        wasIdempotent = (data as any)?.idempotent === true;

        // Check for backend error response
        if ((data as any)?.error) {
          const backendErr = {
            error: (data as any).error,
            stage: (data as any).stage,
            code: (data as any).code,
            details: (data as any).details,
          };
          console.error('[Publish] Backend returned error:', backendErr);
          addBreadcrumb('publish_backend_error', backendErr);
          throw new Error(`Backend: ${backendErr.error} (stage: ${backendErr.stage})`);
        }

        if (!postId) {
          console.error('[Publish] No postId in response:', data);
          addBreadcrumb('publish_no_postid', { data: JSON.stringify(data) });
          throw new Error('publish_post_missing_id');
        }
      } catch (fnErr) {
        // FALLBACK: Direct insert if edge function fails
        console.warn('[Publish] Edge function failed, trying direct insert fallback...');
        addBreadcrumb('publish_fallback_start', { originalError: String(fnErr) });

        try {
          // For Intent posts, include metadata from urlPreview in fallback too
          const intentMetadataFallback = isIntentPost && snapshotPreview ? {
            shared_title: snapshotPreview.title || null,
            preview_img: snapshotPreview.image || snapshotPreview.previewImg || null,
            is_intent: true,
          } : {};

          const { data: directInsert, error: directErr } = await supabase
            .from('posts')
            .insert({
              content: cleanContent.substring(0, 5000),
              author_id: user.id,
              shared_url: isQuotingEditorial ? editorialData.shared_url : (snapshotDetectedUrl || null),
              shared_title: isQuotingEditorial ? editorialData.shared_title : (intentMetadataFallback.shared_title || null),
              preview_img: isQuotingEditorial ? editorialData.preview_img : (intentMetadataFallback.preview_img || null),
              quoted_post_id: isQuotingEditorial ? null : (quotedPost?.id || null),
              is_intent: intentMetadataFallback.is_intent || false,
            })
            .select('id')
            .single();

          if (directErr) {
            console.error('[Publish] Direct insert also failed:', directErr);
            addBreadcrumb('publish_fallback_error', { code: directErr.code, message: directErr.message });
            // Show detailed error to user
            toast.error(`Pubblicazione fallita: ${directErr.message || directErr.code || 'errore sconosciuto'}`, { duration: 6000 });
            return;
          }

          if (!directInsert?.id) {
            console.error('[Publish] Direct insert returned no id');
            addBreadcrumb('publish_fallback_no_id');
            toast.error('Pubblicazione fallita: nessun ID restituito', { duration: 5000 });
            return;
          }

          postId = directInsert.id;
          usedFallback = true;
          addBreadcrumb('publish_fallback_success', { postId });

          // Link media in fallback path (best effort)
          if (mediaIdsSnapshot.length > 0) {
            const rows = mediaIdsSnapshot.map((mediaId, idx) => ({
              post_id: postId!,
              media_id: mediaId,
              order_idx: idx,
            }));
            const { error: mediaErr } = await supabase.from('post_media').insert(rows);
            if (mediaErr) {
              console.warn('[Publish] Fallback media link failed:', mediaErr);
            }
          }
        } catch (fallbackErr) {
          console.error('[Publish] Fallback also threw:', fallbackErr);
          addBreadcrumb('publish_fallback_catch', { error: String(fallbackErr) });
          toast.error(`Pubblicazione fallita: ${String(fallbackErr)}`, { duration: 6000 });
          return;
        }
      }

      // Clear pending publish on success
      clearPendingPublish();

      addBreadcrumb('publish_insert_done', { postId, wasIdempotent, usedFallback });

      // IMPORTANT: avoid heavy immediate refetch on iOS (can trigger Safari reload).
      // Instead, push an optimistic post into cache so it appears immediately, then refetch later.
      addBreadcrumb('publish_finalize');

      // Mark publish flow success in localStorage
      localStorage.setItem('publish_flow_step', 'publish_success');
      localStorage.setItem('publish_flow_at', String(Date.now()));

      haptics.success();
      toast.success(wasIdempotent ? 'Post già pubblicato.' : 'Condiviso.');

      if (postId) {
        addBreadcrumb('publish_optimistic_cache', { postId });

        const optimisticPost = {
          id: postId,
          author: {
            id: user.id,
            username: profile?.username || 'tu',
            full_name: profile?.full_name || null,
            avatar_url: profile?.avatar_url || null,
          },
          content: cleanContent,
          topic_tag: null,
          shared_title: snapshotPreview?.title || null,
          shared_url: snapshotDetectedUrl || null,
          preview_img: snapshotPreview?.image || null,
          full_article: null,
          article_content: null,
          trust_level: null,
          stance: null,
          sources: [],
          created_at: new Date().toISOString(),
          quoted_post_id: quotedPost?.id || null,
          category: contentCategory || null,
          quoted_post: null,
          media: (snapshotUploadedMedia || []).map((m: any) => ({
            id: m.id,
            type: m.type,
            url: m.url,
            thumbnail_url: m.thumbnail_url ?? null,
            width: m.width ?? null,
            height: m.height ?? null,
            mime: m.mime,
            duration_sec: m.duration_sec ?? null,
          })),
          reactions: { hearts: 0, comments: 0 },
          user_reactions: { has_hearted: false, has_bookmarked: false },
          questions: [],
        };

        // Update BOTH query keys to ensure immediate visibility
        // 1) Broad ['posts'] filter
        queryClient.setQueriesData({ queryKey: ['posts'] }, (old: any) => {
          const list = Array.isArray(old) ? old : [];
          if (list.some((p: any) => p?.id === postId)) return list;
          return [optimisticPost, ...list];
        });

        // 2) Specific ['posts', user.id] key used by Feed
        queryClient.setQueryData(['posts', user.id], (old: any) => {
          const list = Array.isArray(old) ? old : [];
          if (list.some((p: any) => p?.id === postId)) return list;
          return [optimisticPost, ...list];
        });

        // If this is a reshare, also bump the ORIGINAL post share counter immediately.
        // Backend increments shares_count for quotedPostId on successful publish.
        if (!wasIdempotent && quotedPost?.id && !isQuotingEditorial) {
          const bump = (old: any) => {
            const list = Array.isArray(old) ? old : [];
            return list.map((p: any) =>
              p?.id === quotedPost.id
                ? { ...p, shares_count: (p.shares_count ?? 0) + 1 }
                : p
            );
          };

          queryClient.setQueriesData({ queryKey: ['posts'] }, bump);
          queryClient.setQueryData(['posts', user.id], bump);
        }

        // ===== HARDENING 3: Notify parent about new post for scroll-to =====
        if (postId) {
          onPublishSuccess?.(postId);
        }
      }

      // iOS/Safari stability: keep a lightweight blocking overlay while we teardown UI
      setIsFinalizingPublish(true);

      const closeDelay = isIOS ? 900 : 0;
      window.setTimeout(() => {
        // Close UI first, then refresh feed in the background
        resetAllState();
        onClose();

        // iOS: if something left the body locked (Radix/Dialog + quiz lock interplay), force-unlock AFTER close
        // Keep this lightweight and conditional to avoid unnecessary style churn.
        if (isIOS) {
          requestAnimationFrame(() => {
            window.setTimeout(() => {
              const needsUnlock =
                document.body.classList.contains('quiz-open') ||
                document.body.classList.contains('reader-open') ||
                document.body.style.overflow === 'hidden' ||
                document.body.style.touchAction === 'none';

              if (needsUnlock) {
                addBreadcrumb('post_publish_force_unlock_body');
                forceUnlockBodyScroll();
              }
            }, 160);
          });
        }

        // Clear localStorage markers after successful close
        localStorage.removeItem('publish_flow_step');
        localStorage.removeItem('publish_flow_at');

        // Non-iOS: refetch immediately to hydrate optimistic data with full joins
        // iOS: delay refetch to avoid memory spikes
        const refreshDelay = isIOS ? 1400 : 0;
        window.setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: ['posts'] });
        }, refreshDelay);

        // Note: component may unmount right after onClose(); setting state after that is OK to skip.
        // We still try to clear overlay when possible (non-modal close paths).
        try { setIsFinalizingPublish(false); } catch { }
      }, closeDelay);
    } catch (error) {
      console.error('[Publish] Unexpected error:', error);
      addBreadcrumb('publish_catch', { error: String(error) });
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Errore: ${errMsg}`, { duration: 5000 });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleMediaSelect = (files: File[], type: 'image' | 'video') => {
    uploadMedia(files, type);
  };

  if (!isOpen) return null;

  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() ||
    profile?.username?.substring(0, 2).toUpperCase() || 'U';

  return (
    <>
      {/* Lightweight blocking overlay used during publish teardown (iOS Safari stability) - NO blur to reduce GPU pressure */}
      {isFinalizingPublish && (
        <div className="fixed inset-0 z-[10080] bg-black/70 flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
            <div className="mx-auto mb-3 h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-foreground">Stiamo finalizzando la pubblicazione…</p>
            <p className="mt-1 text-xs text-muted-foreground">Un attimo ancora.</p>
          </div>
        </div>
      )}

      {/*
        IMPORTANT (iOS): `position: fixed` containers often don't resize with the virtual keyboard.
        Using `absolute` + `100dvh` lets `interactive-widget=resizes-content` push the whole layout up.
      */}
      <div className="absolute inset-0 z-50 flex flex-col h-[100dvh]">
        {/* Backdrop - desktop only */}
        <div
          className="hidden md:block absolute inset-0 bg-black/60"
          onClick={onClose}
        />

        {/* Container: full-screen mobile, centered modal desktop */}
        {/* Uses 100dvh (Dynamic Viewport Height) which resizes with virtual keyboard */}
        <div
          className={cn(
            "relative flex flex-col w-full",
            // Mobile: full dynamic viewport height, keyboard will resize this
            "h-[100dvh]",
            // Desktop: centered modal with max height
            "md:h-auto md:max-h-[85vh] md:w-full md:max-w-xl md:mx-auto md:my-8 md:rounded-2xl",
            "bg-background md:bg-card",
            "border-0 md:border md:border-border",
            "animate-scale-in"
          )}
        >
          {/* Inner flex container - toolbar will be pushed up by keyboard */}
          <div className="flex flex-col h-full">
            {/* Minimal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Check if there's any content to lose
                  const hasContent = content.trim().length > 0 || uploadedMedia.length > 0 || !!detectedUrl;
                  if (hasContent) {
                    setShowCancelConfirm(true);
                  } else {
                    // No content, just close
                    onClose();
                  }
                }}
                className="text-muted-foreground hover:text-foreground -ml-2"
              >
                Annulla
              </Button>

              <Button
                onClick={handlePublish}
                disabled={!canPublish || isLoading || isPreviewLoading || isTranscriptionInProgress}
                className={cn(
                  "px-5 py-1.5 h-auto rounded-full font-semibold text-sm",
                  "bg-primary hover:bg-primary/90 text-primary-foreground",
                  "disabled:opacity-50"
                )}
              >
                {isTranscriptionInProgress ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Attendere...
                  </>
                ) : isPreviewLoading ? 'Caricamento...' : isLoading ? (isGeneratingQuiz ? 'Generazione...' : 'Pubblicazione...') : 'Pubblica'}
              </Button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto">
              {/* Avatar + Textarea inline (X-style) */}
              <div className="flex gap-3 px-4 pt-4">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
                  <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <TiptapEditor
                    ref={editorRef}
                    initialContent=""
                    onChange={handleEditorChange}
                    placeholder="Cosa sta succedendo?"
                    maxLength={3000}
                    disabled={isLoading}
                    editorClassName="min-h-[120px]"
                  />
                </div>
              </div>

              {/* Content previews area */}
              <div className="px-4 py-3 space-y-3">
                {/* Intent Mode Indicator - word counter */}
                {intentMode && (
                  <div className="bg-secondary border border-border rounded-xl p-3">
                    <p className="text-sm text-muted-foreground mb-2">
                      Questo contenuto non è leggibile dal sistema. Per condividerlo, aggiungi il tuo punto di vista.
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-medium tabular-nums",
                        intentWordCount >= 30 ? "text-emerald-500" : "text-muted-foreground"
                      )}>
                        {intentWordCount}/30 parole
                      </span>
                      {intentWordCount >= 30 && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white text-xs">✓</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Gate status indicator - subtle */}
                {(detectedUrl || quotedPost || mediaWithExtractedText || quotedPostMediaWithExtractedText) && !intentMode && gateStatus.requiresGate && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Comprensione richiesta</span>
                  </div>
                )}

                {/* URL Preview - Minimal */}
                {urlPreview && (
                  <div className="border border-border rounded-xl overflow-hidden bg-card">
                    {urlPreview.image && (
                      <div className="aspect-[2/1] w-full overflow-hidden">
                        <img
                          src={urlPreview.image}
                          alt={urlPreview.title || ''}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="px-3 py-2.5">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {urlPreview.domain || (urlPreview.url ? (() => { try { return new URL(urlPreview.url).hostname; } catch { return ''; } })() : '')}
                      </p>
                      <p className="text-sm font-medium text-foreground line-clamp-2">
                        {urlPreview.title}
                      </p>
                      {urlPreview.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {urlPreview.description}
                        </p>
                      )}
                    </div>

                    {/* YouTube Fallback Banner for Spotify Podcasts */}
                    {urlPreview.youtubeFallback && urlPreview.youtubeFallbackMessage && (
                      <div className="mx-3 mb-2.5 p-2 bg-primary/10 border border-primary/30 rounded-lg">
                        <p className="text-xs text-primary flex items-center gap-2">
                          <Youtube className="h-4 w-4 flex-shrink-0" />
                          {urlPreview.youtubeFallbackMessage}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Quoted Post - Editorial vs Regular */}
                {quotedPost && (
                  quotedPost.shared_url?.startsWith('focus://') || quotedPost.author?.username === 'ilpunto' ? (
                    <QuotedEditorialCard
                      title={quotedPost.shared_title || quotedPost.content}
                      variant="composer"
                    />
                  ) : (
                    <QuotedPostCard
                      quotedPost={quotedPost}
                      parentSources={[]}
                    />
                  )
                )}

                {/* Media Preview */}
                {uploadedMedia.length > 0 && (
                  <MediaPreviewTray
                    media={uploadedMedia}
                    onRemove={removeMedia}
                    onReorder={reorderMedia}
                    onRequestTranscription={handleRequestTranscription}
                    onRequestOCR={handleRequestOCR}
                    onRequestBatchExtraction={requestBatchExtraction}
                    isTranscribing={isTranscriptionInProgress}
                    isBatchExtracting={isBatchExtracting}
                  />
                )}

                {isUploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Caricamento media...
                  </div>
                )}
              </div>
            </div>

            {/* Toolbar: NOT fixed - part of flex flow, keyboard pushes it up */}
            {/* On iOS, we also apply a transform offset from visualViewport API */}
            <div className="flex-shrink-0">
              <MediaActionBar
                onFilesSelected={handleMediaSelect}
                disabled={isUploading || isLoading}
                maxTotalMedia={10}
                currentMediaCount={uploadedMedia.length}
                characterCount={content.length}
                maxCharacters={3000}
                onFormat={applyFormatting}
                keyboardOffset={keyboardOffset}
                onGenerateInfographic={handleGenerateInfographic}
                infographicEnabled={wordCount >= 50}
                isGeneratingInfographic={isGeneratingInfographic}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reader Gate */}
      {showReader && urlPreview && (
        <SourceReaderGate
          isOpen={showReader}
          isClosing={readerClosing}
          onClose={() => {
            void closeReaderSafely(false);
          }}
          source={urlPreview}
          onComplete={handleReaderComplete}
        />
      )}

      {/* Quiz Modal - permissive render: let QuizModal show error state if questions invalid */}
      {showQuiz && quizData && (
        <div className="fixed inset-0 z-[10060]">
          <QuizModal
            questions={Array.isArray(quizData.questions) ? quizData.questions : []}
            qaId={quizData.qaId}
            onSubmit={handleQuizSubmit}
            onCancel={() => {
              // If there's a custom onCancel in quizData (for error state), use it
              if (quizData.onCancel) {
                quizData.onCancel();
              } else {
                // User cancelled DURING quiz (before completing)
                addBreadcrumb('quiz_cancel_during');
                addBreadcrumb('quiz_closed', { via: 'cancelled' });
                forceUnlockBodyScroll(); // Ensure scroll is released
                setShowQuiz(false);
                setQuizData(null);
                setQuizPassed(false);
                // Return to composer - user can try again
              }
            }}
            onComplete={(passed) => {
              // Quiz finished (pass or fail)
              // FIX iOS Safari crash: NO full-screen overlay on iOS after quiz
              // Just use toast feedback and start publish directly
              addBreadcrumb('quiz_complete_handler', { passed, isIOS });

              // iOS: Do NOT call forceUnlockBodyScroll here - let QuizModal's deferred unlock handle it
              // This avoids "style churn" during the critical unmount phase
              if (!isIOS) {
                forceUnlockBodyScroll();
              } else {
                addBreadcrumb('composer_quiz_complete_no_force_unlock_ios');
              }

              // STEP 1: Add explicit quiz_closed breadcrumb before unmount
              addBreadcrumb('quiz_closed', { via: passed ? 'passed' : 'failed' });
              // STEP 2: Immediately unmount Quiz UI to reduce memory - NOTHING ELSE
              setShowQuiz(false);
              setQuizData(null);
              setQuizPassed(false);
              addBreadcrumb('quiz_unmount_requested');

              if (passed) {
                // Save quiz_passed marker BEFORE any async operations
                // This enables recovery if iOS crashes before publish completes
                localStorage.setItem('publish_flow_step', 'quiz_passed');
                localStorage.setItem('publish_flow_at', String(Date.now()));
                addBreadcrumb('quiz_passed_marker_set');

                // iOS: Skip the full-screen overlay entirely to prevent crash
                // Non-iOS: Use the overlay for visual feedback
                if (isIOS) {
                  // iOS path: NO overlay, just toast + very delayed publish
                  addBreadcrumb('quiz_passed_ios_no_overlay');

                  // Wait for quiz unmount + deferred scroll unlock to fully settle
                  requestAnimationFrame(() => {
                    const publishDelay = 800; // longer delay for full DOM settle
                    window.setTimeout(() => {
                      addBreadcrumb('publish_after_quiz_start');
                      const loadingId = toast.loading('Pubblicazione…');
                      publishPost()
                        .then(() => {
                          // publishPost handles close + refresh
                        })
                        .catch((e) => {
                          console.error('[ComposerModal] publishPost error:', e);
                          addBreadcrumb('publish_error', { error: String(e) });
                          toast.error('Errore pubblicazione');
                        })
                        .finally(() => {
                          toast.dismiss(loadingId);
                        });
                    }, publishDelay);
                  });
                } else {
                  // Non-iOS path: show overlay then publish
                  requestAnimationFrame(() => {
                    window.setTimeout(() => {
                      addBreadcrumb('quiz_unmounted_overlay_show');
                      setIsFinalizingPublish(true);

                      window.setTimeout(() => {
                        addBreadcrumb('publish_after_quiz_start');
                        const loadingId = toast.loading('Pubblicazione…');
                        publishPost()
                          .then(() => {
                            // publishPost handles close + refresh
                          })
                          .catch((e) => {
                            console.error('[ComposerModal] publishPost error:', e);
                            addBreadcrumb('publish_error', { error: String(e) });
                            toast.error('Errore pubblicazione');
                            setIsFinalizingPublish(false);
                          })
                          .finally(() => {
                            toast.dismiss(loadingId);
                          });
                      }, 120);
                    }, 50);
                  });
                }
              } else {
                // Failed - already closed quiz above, just show message
                toast.info('Puoi riprovare quando vuoi.');
                addBreadcrumb('quiz_failed_return_to_composer');
              }
            }}
            provider="Comprehension Gate"
            postCategory={contentCategory}
            // CRITICAL: Pass error state props from quizData
            errorState={quizData.errorState}
            onRetry={quizData.onRetry}
          />
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Annullare il post?</AlertDialogTitle>
            <AlertDialogDescription>
              Il contenuto che hai scritto verrà eliminato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continua a modificare</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetAllState();
                onClose();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina bozza
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AnalysisOverlay isVisible={showAnalysisOverlay} message={isGeneratingInfographic ? "Sintetizzando i concetti chiave in un'infografica..." : "Analisi in corso..."} />
    </>
  );
}

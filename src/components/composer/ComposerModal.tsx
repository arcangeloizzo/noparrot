import { useState, useEffect, useRef } from "react";
import { X, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { MediaActionBar } from "./MediaActionBar";
import { MediaPreviewTray } from "@/components/media/MediaPreviewTray";
import { fetchArticlePreview, classifyContent, generateQA } from "@/lib/ai-helpers";
import { QuotedPostCard } from "@/components/feed/QuotedPostCard";
import { SourceReaderGate } from "./SourceReaderGate";
import { QuizModal } from "@/components/ui/quiz-modal";
import { getWordCount, getTestModeWithSource } from '@/lib/gate-utils';
import { MentionDropdown } from "@/components/feed/MentionDropdown";
import { useUserSearch } from "@/hooks/useUserSearch";
import { useQueryClient } from "@tanstack/react-query";
import { updateCognitiveDensityWeighted } from "@/lib/cognitiveDensity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { cn } from "@/lib/utils";
import { addBreadcrumb, generateIdempotencyKey, setPendingPublish, clearPendingPublish, getPendingPublish } from "@/lib/crashBreadcrumbs";
import { forceUnlockBodyScroll } from "@/lib/bodyScrollLock";

// iOS detection for stability tweaks (includes iPadOS reporting as Mac)
const isIOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1));

interface ComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotedPost?: any;
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
    
    // t.co (Twitter shortlinks) - keep as is, backend resolves
    // bit.ly, tinyurl, etc - keep as is, backend resolves
    
  } catch (e) {
    console.warn('[Composer] URL parse error during sanitization:', e);
  }
  
  return url;
};

export function ComposerModal({ isOpen, onClose, quotedPost }: ComposerModalProps) {
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
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
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { uploadMedia, uploadedMedia, removeMedia, clearMedia, isUploading } = useMediaUpload();
  const { data: mentionUsers = [], isLoading: isSearching } = useUserSearch(mentionQuery);

  const canPublish = content.trim().length > 0 || uploadedMedia.length > 0 || !!detectedUrl;
  const isLoading = isPublishing || isGeneratingQuiz;

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
    setMentionQuery('');
    setShowMentions(false);
    setCursorPosition(0);
    setSelectedMentionIndex(0);
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

  const handleSelectMention = (user: any) => {
    const textBeforeCursor = content.slice(0, cursorPosition);
    const textAfterCursor = content.slice(cursorPosition);
    
    const beforeMention = textBeforeCursor.replace(/@\w*$/, '');
    const newText = `${beforeMention}@${user.username} ${textAfterCursor}`;
    const newCursorPos = beforeMention.length + user.username.length + 2;
    
    setContent(newText);
    setShowMentions(false);
    setMentionQuery('');
    setSelectedMentionIndex(0);
    setCursorPosition(newCursorPos);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [mentionUsers]);

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
    
    try {
      // Block unsupported platforms (Instagram, Facebook) before calling API
      const host = new URL(url).hostname.toLowerCase();
      console.log('[Composer] URL hostname:', host);
      
      if (
        host.includes('instagram.com') ||
        host.includes('facebook.com') ||
        host.includes('m.facebook.com') ||
        host.includes('fb.com') ||
        host.includes('fb.watch')
      ) {
        console.log('[Composer] Blocked unsupported platform:', host);
        toast.error('Instagram e Facebook non sono supportati. Apri il link nel browser.');
        setDetectedUrl(null);
        return;
      }

      const preview = await fetchArticlePreview(url);
      console.log('[Composer] fetchArticlePreview result:', { success: preview?.success, error: preview?.error });
      
      // Check for errors (now always structured)
      if (!preview.success) {
        console.log('[Composer] Preview failed:', preview.error, preview.message);
        toast.error(preview.message || 'Impossibile caricare l\'anteprima.');
        setDetectedUrl(null);
        return;
      }
      
      // Success - set preview
      setUrlPreview({ url, ...preview });
      
      const category = await classifyContent({
        text: content,
        title: preview.title,
        summary: preview.content || preview.summary || preview.excerpt
      });
      setContentCategory(category);
    } catch (error) {
      console.error('[Composer] Error loading preview:', error);
      toast.error('Errore nel caricamento dell\'anteprima.');
      setDetectedUrl(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handlePublish = async () => {
    // Allow publish if user has text, media, or a detected URL
    if (!user || (!content.trim() && !detectedUrl && uploadedMedia.length === 0)) return;
    
    addBreadcrumb('publish_attempt', { hasUrl: !!detectedUrl, isIOS });
    
    console.log('[Composer] handlePublish called:', { 
      detectedUrl, 
      isPreviewLoading, 
      urlPreviewSuccess: urlPreview?.success,
      urlPreviewError: urlPreview?.error,
      isIOS
    });

    if (detectedUrl) {
      // Wait for preview to finish loading
      if (isPreviewLoading) {
        toast.info('Sto caricando l\'anteprima...');
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

    await publishPost();
  };
  
  // iOS-specific: Skip reader, go directly to quiz (mirrors comment flow)
  const handleIOSQuizOnlyFlow = async () => {
    if (isGeneratingQuiz || !urlPreview || !user) return;
    
    try {
      setIsGeneratingQuiz(true);
      addBreadcrumb('ios_generating_quiz');
      
      // Check if content is too short (Spotify without lyrics, etc.)
      if (
        urlPreview.platform === 'spotify' &&
        (!urlPreview.transcript || urlPreview.transcript.length < 100)
      ) {
        toast.info('Contenuto Spotify senza testo, pubblicazione diretta');
        addBreadcrumb('ios_skip_quiz_spotify');
        await publishPost();
        return;
      }
      
      const userWordCount = getWordCount(content);
      const testMode = getTestModeWithSource(userWordCount);
      
      toast.loading('Stiamo mettendo a fuoco ciò che conta…');
      
      const summaryForQA = (urlPreview.content || urlPreview.summary || urlPreview.excerpt || '').substring(0, 5000);
      
      const result = await generateQA({
        contentId: null,
        isPrePublish: true,
        title: urlPreview.title || '',
        summary: summaryForQA,
        sourceUrl: detectedUrl || undefined,
        userText: content,
        testMode: testMode,
      });
      
      toast.dismiss();
      addBreadcrumb('ios_qa_generated', { hasQuestions: !!result.questions, error: result.error });
      
      if (result.insufficient_context) {
        toast.info('Contenuto troppo breve, pubblicazione diretta');
        addBreadcrumb('ios_skip_quiz_short');
        await publishPost();
        return;
      }
      
      if (result.error || !result.questions) {
        console.error('[ComposerModal] iOS Quiz generation failed:', result.error);
        toast.error('Errore generazione quiz, pubblicazione diretta');
        addBreadcrumb('ios_quiz_error', { error: result.error });
        await publishPost();
        return;
      }
      
      // Show quiz directly (no reader)
      addBreadcrumb('ios_quiz_mount');
      setQuizData({
        questions: result.questions,
        sourceUrl: detectedUrl || '',
      });
      setShowQuiz(true);
      
    } catch (error) {
      console.error('[ComposerModal] iOS quiz flow error:', error);
      toast.dismiss();
      toast.error('Errore durante la generazione del quiz');
      addBreadcrumb('ios_quiz_flow_error', { error: String(error) });
      
      // Fallback: publish anyway
      try {
        await publishPost();
      } catch (publishError) {
        console.error('[ComposerModal] iOS publishPost fallback error:', publishError);
      }
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const closeReaderSafely = async () => {
    addBreadcrumb('reader_close_start');
    setReaderClosing(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    setShowReader(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    setReaderClosing(false);
    addBreadcrumb('reader_closed');
  };

  const handleReaderComplete = async () => {
    if (isGeneratingQuiz) return;

    addBreadcrumb('reader_complete_start');

    try {
      if (!urlPreview || !user) {
        await closeReaderSafely();
        return;
      }

      if (
        urlPreview.platform === 'spotify' &&
        (!urlPreview.transcript || urlPreview.transcript.length < 100)
      ) {
        toast.info('Contenuto Spotify senza testo, pubblicazione diretta');
        await closeReaderSafely();
        await publishPost();
        return;
      }

      setIsGeneratingQuiz(true);

      const userWordCount = getWordCount(content);
      const testMode = getTestModeWithSource(userWordCount);

      toast.loading('Stiamo mettendo a fuoco ciò che conta…');

      const summaryForQA = (urlPreview.content || urlPreview.summary || urlPreview.excerpt || '').substring(0, 5000);

      const result = await generateQA({
        contentId: null,
        isPrePublish: true,
        title: urlPreview.title || '',
        summary: summaryForQA,
        sourceUrl: detectedUrl || undefined,
        userText: content,
        testMode: testMode,
      });

      toast.dismiss();

      if (result.insufficient_context) {
        toast.info('Contenuto troppo breve, pubblicazione diretta');
        await closeReaderSafely();
        await publishPost();
        return;
      }

      // Minimal validation: just check it's a non-empty array
      // QuizModal handles its own error state for invalid questions
      const hasQuestions = Array.isArray(result.questions) && result.questions.length > 0;

      if (result.error || !hasQuestions) {
        console.error('[ComposerModal] Quiz generation failed:', { 
          error: result.error, 
          hasQuestions
        });
        addBreadcrumb('quiz_unavailable_fallback');
        toast.info('Quiz non disponibile, pubblicazione diretta');
        await closeReaderSafely();
        await publishPost();
        return;
      }

      // Mount quiz first, then close reader (prevents intermediate blank state)
      setQuizData({
        questions: result.questions,
        sourceUrl: detectedUrl || '',
      });
      setShowQuiz(true);
      addBreadcrumb('quiz_mount');

      // Wait one frame to ensure quiz is rendered above reader
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      // NOW close reader (quiz is already visible on top)
      await closeReaderSafely();
    } catch (error) {
      console.error('[ComposerModal] handleReaderComplete error:', error);
      toast.dismiss();
      toast.error('Errore durante la generazione del quiz');

      try {
        await closeReaderSafely();
      } catch (closeError) {
        console.error('[ComposerModal] closeReaderSafely error:', closeError);
      }

      try {
        await publishPost();
      } catch (publishError) {
        console.error('[ComposerModal] publishPost fallback error:', publishError);
      }
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleQuizSubmit = async (answers: Record<string, string>) => {
    if (!user || !quizData) return { passed: false, score: 0, total: 0, wrongIndexes: [] };

    try {
      const { data, error } = await supabase.functions.invoke('validate-answers', {
        body: {
          postId: null,
          sourceUrl: quizData.sourceUrl,
          answers,
          gateType: 'composer'
        }
      });

      if (error) throw error;

      const actualPassed = data.passed && (data.total - data.score) <= 2;
      setQuizPassed(actualPassed);
      
      return data;
    } catch (error) {
      console.error('Error validating quiz:', error);
      setQuizPassed(false);
      return { passed: false, score: 0, total: 0, wrongIndexes: [] };
    }
  };

  const publishPost = async () => {
    if (!user) return;

    setIsPublishing(true);
    try {
      addBreadcrumb('publish_start', { hasUrl: !!detectedUrl, hasMedia: uploadedMedia.length > 0 });

      // Snapshot inputs (avoid state mutation issues during async)
      const snapshotDetectedUrl = detectedUrl;
      const snapshotPreview = urlPreview;
      const snapshotContent = content;
      const snapshotUploadedMedia = [...uploadedMedia];

      // If user pasted only a URL, stripping it would make content empty (DB requires content NOT NULL)
      const strippedText = snapshotContent.replace(URL_REGEX, '').trim();
      const cleanContent =
        strippedText ||
        snapshotPreview?.title ||
        (snapshotDetectedUrl ? `Link: ${new URL(snapshotDetectedUrl).hostname}` : '');

      // TEMP: Disable classification during publish to prevent crash/reload
      addBreadcrumb('publish_classify_skipped_by_client');

      // Reuse pending publish idempotency key if it matches the same payload (crash/retry)
      const mediaIdsSnapshot = snapshotUploadedMedia.map((m) => m.id);
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

      try {
        const { data, error: fnError } = await supabase.functions.invoke('publish-post', {
          body: {
            content: cleanContent,
            sharedUrl: snapshotDetectedUrl || null,
            quotedPostId: quotedPost?.id || null,
            mediaIds: mediaIdsSnapshot,
            idempotencyKey,
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
          const { data: directInsert, error: directErr } = await supabase
            .from('posts')
            .insert({
              content: cleanContent.substring(0, 5000),
              author_id: user.id,
              shared_url: snapshotDetectedUrl || null,
              quoted_post_id: quotedPost?.id || null,
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

      // IMPORTANT: avoid heavy immediate refetch (can trigger Safari reload). Let Feed refresh shortly after.
      addBreadcrumb('publish_finalize');
      toast.success(wasIdempotent ? 'Post già pubblicato.' : 'Condiviso.');

      // Close UI first, then refresh feed in the background
      resetAllState();
      onClose();

      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['posts'] });
      }, 600);
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
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-md" 
          onClick={onClose} 
        />
        
        <div className={cn(
          "relative w-full max-w-2xl max-h-[90vh] overflow-hidden",
          "bg-gradient-to-b from-card/95 to-card/90 backdrop-blur-xl",
          "border border-white/10 rounded-3xl shadow-2xl",
          "animate-scale-in"
        )}>
          <div className="flex flex-col h-full">
            {/* Modern Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/10">
              <Avatar className="w-11 h-11 aspect-square ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
                <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  Nuovo Post
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                </h2>
                <p className="text-xs text-muted-foreground">Condividi con la community</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onClose}
                className="rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Modern Textarea */}
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => {
                    const value = e.target.value;
                    const cursorPos = e.target.selectionStart;
                    
                    setContent(value);
                    setCursorPosition(cursorPos);

                    const textBeforeCursor = value.slice(0, cursorPos);
                    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

                    if (mentionMatch) {
                      setMentionQuery(mentionMatch[1]);
                      setShowMentions(true);
                    } else {
                      setShowMentions(false);
                      setMentionQuery('');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (!showMentions || mentionUsers.length === 0) return;
                    
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedMentionIndex((prev) => 
                        (prev + 1) % mentionUsers.length
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedMentionIndex((prev) => 
                        (prev - 1 + mentionUsers.length) % mentionUsers.length
                      );
                    } else if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSelectMention(mentionUsers[selectedMentionIndex]);
                    } else if (e.key === 'Escape') {
                      setShowMentions(false);
                    }
                  }}
                  placeholder="Cosa vuoi condividere? Usa @ per menzionare..."
                  className={cn(
                    "min-h-[140px] resize-none text-[16px] leading-relaxed",
                    "bg-white/5 border-white/10 rounded-2xl",
                    "focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
                    "placeholder:text-muted-foreground/60",
                    "transition-all duration-200"
                  )}
                  rows={5}
                />
                
                {showMentions && (
                  <MentionDropdown
                    users={mentionUsers}
                    selectedIndex={selectedMentionIndex}
                    onSelect={handleSelectMention}
                    isLoading={isSearching}
                    position="below"
                  />
                )}
              </div>

              {/* URL Preview - Compact Modern */}
              {urlPreview && (
                <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/5 hover:bg-white/8 transition-colors">
                  {urlPreview.image && (
                    <div className="aspect-[2/1] w-full overflow-hidden bg-muted/20">
                      <img 
                        src={urlPreview.image}
                        alt={urlPreview.title || ''}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-3">
                    <div className="text-xs text-primary/80 font-medium mb-1">
                      {urlPreview.domain || (urlPreview.url ? new URL(urlPreview.url).hostname : '')}
                    </div>
                    <div className="font-semibold text-sm line-clamp-2 text-foreground">
                      {urlPreview.title}
                    </div>
                    {urlPreview.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {urlPreview.description}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quoted Post */}
              {quotedPost && (
                <QuotedPostCard 
                  quotedPost={quotedPost} 
                  parentSources={[]} 
                />
              )}

              {/* Media Preview */}
              {uploadedMedia.length > 0 && (
                <MediaPreviewTray
                  media={uploadedMedia}
                  onRemove={removeMedia}
                />
              )}

              {/* Modern Media Action Bar */}
              <MediaActionBar
                onFilesSelected={handleMediaSelect}
                disabled={isUploading || isLoading}
              />
              
              {isUploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Caricamento media...
                </div>
              )}
            </div>

            {/* Modern Footer */}
            <div className="p-4 border-t border-white/10 flex justify-end">
              <Button
                onClick={handlePublish}
                disabled={!canPublish || isLoading || isPreviewLoading}
                className={cn(
                  "px-6 py-2.5 rounded-full font-semibold",
                  "bg-gradient-to-r from-primary to-primary/80",
                  "hover:shadow-lg hover:shadow-primary/25 hover:scale-105",
                  "active:scale-95 transition-all duration-200",
                  "disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none"
                )}
              >
                {isPreviewLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Caricamento...
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {isGeneratingQuiz ? "Generazione..." : "Pubblicazione..."}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Pubblica
                  </div>
                )}
              </Button>
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
            void closeReaderSafely();
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
            onSubmit={handleQuizSubmit}
            onCancel={() => {
              // User cancelled DURING quiz (before completing)
              addBreadcrumb('quiz_cancel_during');
              forceUnlockBodyScroll(); // Ensure scroll is released
              setShowQuiz(false);
              setQuizData(null);
              setQuizPassed(false);
              // Return to composer - user can try again
            }}
            onComplete={async (passed) => {
              // Quiz finished (pass or fail)
              addBreadcrumb('quiz_complete_handler', { passed });

              // Ensure scroll is unlocked before any state changes
              forceUnlockBodyScroll();

              if (passed) {
                addBreadcrumb('publish_after_quiz');

                // Stability: unmount Quiz UI BEFORE publish to avoid memory spikes/white screens
                setShowQuiz(false);
                setQuizData(null);
                setQuizPassed(false);

                // Allow React to commit unmount before heavy work (extra buffer on iOS)
                await new Promise((r) => setTimeout(r, isIOS ? 220 : 120));

                const loadingId = toast.loading('Pubblicazione…');
                try {
                  await publishPost();
                  // publishPost handles close + refresh
                } catch (e) {
                  console.error('[ComposerModal] publishPost error:', e);
                  addBreadcrumb('publish_error', { error: String(e) });
                  toast.error('Errore pubblicazione');

                  // Return to composer (non-iOS path may still have quiz mounted)
                  setShowQuiz(false);
                  setQuizData(null);
                  setQuizPassed(false);
                } finally {
                  toast.dismiss(loadingId);
                }
              } else {
                // Failed - close quiz and return to composer
                setShowQuiz(false);
                setQuizData(null);
                setQuizPassed(false);
                toast.info('Puoi riprovare quando vuoi.');
                addBreadcrumb('quiz_failed_return_to_composer');
              }
            }}
            provider="Comprehension Gate"
            postCategory={contentCategory}
          />
        </div>
      )}
    </>
  );
}

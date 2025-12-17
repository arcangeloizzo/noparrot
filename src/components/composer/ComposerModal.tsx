import { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { MediaUploadButton } from "@/components/media/MediaUploadButton";
import { MediaPreviewTray } from "@/components/media/MediaPreviewTray";
import { fetchArticlePreview, classifyContent } from "@/lib/ai-helpers";
import { QuotedPostCard } from "@/components/feed/QuotedPostCard";
import { SourceReaderGate } from "./SourceReaderGate";
import { generateQA } from "@/lib/ai-helpers";
import { QuizModal } from "@/components/ui/quiz-modal";
import { getWordCount, getTestModeWithSource } from '@/lib/gate-utils';
import { MentionDropdown } from "@/components/feed/MentionDropdown";
import { useUserSearch } from "@/hooks/useUserSearch";
import { useQueryClient } from "@tanstack/react-query";
import { updateCognitiveDensityWeighted } from "@/lib/cognitiveDensity";

interface ComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotedPost?: any;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export function ComposerModal({ isOpen, onClose, quotedPost }: ComposerModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [urlPreview, setUrlPreview] = useState<any>(null);
  const [contentCategory, setContentCategory] = useState<string | null>(null);
  const [showReader, setShowReader] = useState(false);
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

  // Reset selection when users change
  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [mentionUsers]);

  // Detect URL in content
  useEffect(() => {
    const urls = content.match(URL_REGEX);
    if (urls && urls.length > 0) {
      const url = urls[0];
      console.log('[Composer] URL detected:', url);
      if (url !== detectedUrl) {
        console.log('[Composer] Setting new URL:', url);
        setDetectedUrl(url);
        loadPreview(url);
      }
    } else if (!urls && detectedUrl) {
      console.log('[Composer] No URL found, clearing');
      setDetectedUrl(null);
      setUrlPreview(null);
    }
  }, [content]);

  const loadPreview = async (url: string) => {
    try {
      console.log('[Composer] Loading preview for:', url);
      const preview = await fetchArticlePreview(url);
      
      console.log('[Composer] Preview result:', preview);
      
      if (preview) {
        setUrlPreview({
          url: url,
          ...preview
        });
        console.log('[Composer] Preview set successfully');
        
        // Classifica il contenuto immediatamente dopo aver caricato la preview
        const category = await classifyContent({
          text: content,
          title: preview.title,
          summary: preview.content || preview.summary || preview.excerpt
        });
        console.log('[Composer] Content classified as:', category);
        setContentCategory(category);
      } else {
        console.log('[Composer] No preview data returned');
      }
    } catch (error) {
      console.error('[Composer] Error loading preview:', error);
    }
  };

  const handlePublish = async () => {
    if (!user || !content.trim()) return;

    // Se c'è un link → apri reader + comprehension gate
    if (detectedUrl) {
      setShowReader(true);
      return;
    }

    // Nessun link → pubblica subito
    await publishPost();
  };

  const handleReaderComplete = async () => {
    if (isGeneratingQuiz) return; // Prevent double clicks
    
    // NON smontare reader qui - farlo solo dopo successo delle operazioni async
    
    if (!urlPreview || !user) {
      setShowReader(false);
      return;
    }

    // Se Spotify senza lyrics sufficienti, pubblica direttamente
    if (urlPreview.platform === 'spotify' && 
        (!urlPreview.transcript || urlPreview.transcript.length < 100)) {
      setShowReader(false);
      toast.info('Contenuto Spotify senza testo, pubblicazione diretta');
      try {
        await publishPost();
      } catch (e) {
        console.error('[ComposerModal] publishPost fallback error:', e);
        toast.error('Errore pubblicazione');
      }
      return;
    }

    setIsGeneratingQuiz(true);
    
    try {
      // Calcola testMode basato sul testo utente
      const userWordCount = getWordCount(content);
      const testMode = getTestModeWithSource(userWordCount);

      toast.loading('Stiamo mettendo a fuoco ciò che conta…');

      // Per lyrics/contenuti lunghi, passa fino a 5000 caratteri (copre 99% delle canzoni)
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
        setShowReader(false);
        try {
          await publishPost();
        } catch (e) {
          console.error('[ComposerModal] publishPost error:', e);
          toast.error('Errore pubblicazione');
        }
        return;
      }

      if (result.error || !result.questions) {
        console.error('[ComposerModal] Quiz generation failed:', result.error);
        toast.error('Errore generazione quiz, pubblicazione diretta');
        setShowReader(false);
        try {
          await publishPost();
        } catch (e) {
          console.error('[ComposerModal] publishPost error:', e);
          toast.error('Errore pubblicazione');
        }
        return;
      }

      // Successo! Smonta reader in modo sincrono e mostra quiz dopo breve delay
      flushSync(() => {
        setShowReader(false);
      });
      
      // Piccolo delay per permettere cleanup completo del reader
      await new Promise(resolve => setTimeout(resolve, 50));
      
      setQuizData({
        questions: result.questions,
        sourceUrl: detectedUrl || ''
      });
      setShowQuiz(true);
    } catch (error) {
      console.error('[ComposerModal] handleReaderComplete error:', error);
      toast.dismiss();
      toast.error('Errore durante la generazione del quiz');
      setShowReader(false);
      // Wrap publishPost in try-catch per evitare doppio crash
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
      
      // NON chiamare setShowQuiz o publishPost qui!
      // Salva lo stato e lascia che QuizModal mostri il feedback
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
      // Rimuovi tutti gli URL dal contenuto prima di pubblicare
      const cleanContent = content.replace(URL_REGEX, '').trim();
      
      // Classifica il contenuto usando AI
      const category = await classifyContent({
        text: cleanContent,
        title: urlPreview?.title,
        summary: urlPreview?.content || urlPreview?.summary || urlPreview?.excerpt
      });

      console.log('[ComposerModal] Content classified as:', category);
      
      const { data: insertedPost, error: postError } = await supabase
        .from('posts')
        .insert({
          content: cleanContent,
          author_id: user.id,
          shared_url: detectedUrl || null,
          shared_title: urlPreview?.title || null,
          preview_img: urlPreview?.image || null,
          article_content: urlPreview?.content || null,
          embed_html: urlPreview?.embedHtml || null,
          transcript: urlPreview?.transcript || null,
          transcript_source: urlPreview?.transcriptSource || null,
          quoted_post_id: quotedPost?.id || null,
          category: category || null
        })
        .select()
        .single();

      if (postError) throw postError;

      // Salvare post_media
      if (uploadedMedia.length > 0 && insertedPost) {
        for (let i = 0; i < uploadedMedia.length; i++) {
          await supabase.from('post_media').insert({
            post_id: insertedPost.id,
            media_id: uploadedMedia[i].id,
            order_idx: i
          });
        }
      }

      // Aggiorna cognitive density con peso
      if (category) {
        const action = quotedPost?.id ? 'SHARE_POST' : 'CREATE_POST';
        await updateCognitiveDensityWeighted(user.id, category, action);
      }

      // Invalida queries per ricaricare il feed immediatamente
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      await queryClient.refetchQueries({ queryKey: ['posts'] });
      
      toast.success('Condiviso.');
      setContent('');
      setDetectedUrl(null);
      setUrlPreview(null);
      clearMedia();
      onClose();
    } catch (error) {
      console.error('Error publishing post:', error);
      toast.error('Errore pubblicazione');
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div 
          className="absolute inset-0 bg-background/80 backdrop-blur-sm" 
          onClick={onClose} 
        />
        
        <Card className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden glass-panel border-glass shadow-glass">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border/50">
              <h2 className="text-xl font-semibold text-foreground">
                Nuovo Post
              </h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onClose}
                className="hover:bg-muted/50"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Textarea con Mention */}
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
                  placeholder="Scrivi il tuo pensiero… Usa @ per menzionare"
                  className="min-h-[120px] resize-none text-[15px]"
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

              {/* URL Preview */}
              {urlPreview && (
                <div className="border border-border rounded-2xl overflow-hidden">
                  {urlPreview.image && (
                    <div className="aspect-video w-full overflow-hidden bg-muted">
                      <img 
                        src={urlPreview.image}
                        alt={urlPreview.title || ''}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-3">
                    <div className="text-xs text-muted-foreground mb-1">
                      {urlPreview.domain || (urlPreview.url ? new URL(urlPreview.url).hostname : '')}
                    </div>
                    <div className="font-semibold text-sm line-clamp-2">
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

              {/* Media Upload */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <MediaUploadButton
                    type="image"
                    onFilesSelected={(files) => uploadMedia(files, 'image')}
                    maxFiles={4}
                    disabled={isUploading}
                  />
                  <MediaUploadButton
                    type="video"
                    onFilesSelected={(files) => uploadMedia(files, 'video')}
                    maxFiles={1}
                    disabled={isUploading}
                  />
                  {isUploading && (
                    <span className="text-xs text-muted-foreground">
                      Caricamento...
                    </span>
                  )}
                </div>
                <MediaPreviewTray
                  media={uploadedMedia}
                  onRemove={removeMedia}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border/30 flex justify-end">
              <Button
                onClick={handlePublish}
                disabled={!content.trim() || isPublishing || isGeneratingQuiz}
                className="rounded-full px-6"
              >
                {isPublishing ? "Pubblicazione..." : isGeneratingQuiz ? "Generazione quiz..." : "Pubblica"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Reader Gate */}
      {showReader && urlPreview && (
        <SourceReaderGate
          isOpen={showReader}
          onClose={() => setShowReader(false)}
          source={urlPreview}
          onComplete={handleReaderComplete}
        />
      )}

      {/* Quiz Modal */}
      {showQuiz && quizData && (
        <QuizModal
          questions={quizData.questions}
          onSubmit={handleQuizSubmit}
          onCancel={() => {
            // Usa requestAnimationFrame per dare tempo al QuizModal di fare cleanup
            requestAnimationFrame(() => {
              const shouldPublish = quizPassed;
              setShowQuiz(false);
              setQuizData(null);
              setQuizPassed(false);
              
              // Se il quiz è passato, pubblica dopo che l'utente chiude il modal
              if (shouldPublish) {
                toast.success('Hai fatto chiarezza.');
                publishPost().catch((e) => {
                  console.error('[ComposerModal] publishPost error:', e);
                  toast.error('Errore pubblicazione');
                });
              }
            });
          }}
          provider="Comprehension Gate"
          postCategory={contentCategory}
        />
      )}
    </>
  );
}

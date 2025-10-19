import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Link, Plus, User, ChevronLeft, Image, FileText, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GateQueueManager, SourceWithGate, GateQueueState } from '@/lib/comprehension-gate-extended';
import { GateQueueModal } from './GateQueueModal';
import { SourceChip } from './SourceChip';
import { SourceReaderGate } from './SourceReaderGate';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { fetchArticlePreview, generateQA, validateAnswers } from '@/lib/ai-helpers';
import { QuizModal } from '@/components/ui/quiz-modal';
import { QuotedPostCard } from '@/components/feed/QuotedPostCard';
import { MentionDropdown } from '@/components/feed/MentionDropdown';
import { useUserSearch } from '@/hooks/useUserSearch';

interface ComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotedPost?: {
    id: string;
    content: string;
    created_at: string;
    shared_url?: string | null;
    shared_title?: string | null;
    preview_img?: string | null;
    author: {
      username: string;
      full_name: string | null;
      avatar_url: string | null;
    };
  } | null;
}

export const ComposerModal: React.FC<ComposerModalProps> = ({ isOpen, onClose, quotedPost }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [newSource, setNewSource] = useState('');
  const [showGateQueue, setShowGateQueue] = useState(false);
  const [gateQueueState, setGateQueueState] = useState<GateQueueState | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<any>(null);
  const [showReader, setShowReader] = useState(false);
  const [currentReaderSource, setCurrentReaderSource] = useState<any>(null);
  const [sourceMetadata, setSourceMetadata] = useState<Record<string, any>>({});
  
  // Mention state management
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // User search for mentions
  const { data: mentionUsers = [], isLoading: isSearching } = useUserSearch(mentionQuery);

  // Create queue manager for sources with gate states
  const queueManager = useMemo(() => {
    if (sources.length === 0) return null;
    return new GateQueueManager(sources, setGateQueueState);
  }, [sources]);

  // Check if all sources are passed
  const allSourcesPassed = useMemo(() => {
    if (sources.length === 0) return true; // No sources = can publish
    return gateQueueState?.allPassed || false;
  }, [sources.length, gateQueueState?.allPassed]);

  const addSource = async () => {
    if (newSource.trim() && !sources.includes(newSource.trim())) {
      const url = newSource.trim();
      
      // Show loading toast
      toast({
        title: 'Caricamento fonte...',
        description: 'Recupero informazioni dall\'articolo'
      });
      
      // Wait for metadata before adding source
      const metadata = await fetchArticlePreview(url);
      
      if (metadata) {
        setSourceMetadata(prev => ({ ...prev, [url]: metadata }));
        setSources([...sources, url]);
        setNewSource('');
        
        toast({
          title: '✅ Fonte aggiunta',
          description: metadata.title || 'Fonte pronta'
        });
      } else {
        toast({
          title: 'Errore',
          description: 'Impossibile recuperare informazioni dalla fonte',
          variant: 'destructive'
        });
      }
    }
  };

  const removeSource = (index: number) => {
    const removedSource = sources[index];
    setSources(sources.filter((_, i) => i !== index));
    
    // If queue manager exists, remove from queue as well
    if (queueManager && gateQueueState) {
      const sourceInQueue = gateQueueState.sources.find(s => s.url === removedSource);
      if (sourceInQueue) {
        queueManager.removeSource(sourceInQueue.id);
      }
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;

    // If no sources, publish immediately
    if (sources.length === 0) {
      publishContent();
      return;
    }

    // Start comprehension gate for sources
    toast({
      title: 'Validazione fonti...',
      description: 'Leggi e comprendi le fonti per pubblicare'
    });
    
    setCurrentSourceIndex(0);
    await startSourceGate(0);
  };

  const startSourceGate = async (index: number) => {
    console.log('[startSourceGate] Called with index:', index, 'Total sources:', sources.length);
    
    if (index >= sources.length) {
      // All sources passed!
      console.log('[startSourceGate] All sources validated, publishing...');
      toast({
        title: '✅ Tutte le fonti validate!',
        description: 'Pubblicazione in corso...'
      });
      await publishContent();
      return;
    }

    const sourceUrl = sources[index];
    const metadata = sourceMetadata[sourceUrl];
    
    if (!metadata) {
      toast({
        title: 'Errore',
        description: 'Impossibile caricare la fonte',
        variant: 'destructive'
      });
      return;
    }

    // 1. First show the Reader
    setCurrentReaderSource({
      url: sourceUrl,
      title: metadata.title || '',
      content: metadata.excerpt || metadata.summary || '',
      sourceIndex: index,
      ...metadata
    });
    setShowReader(true);
  };

  // Handler when Reader is completed
  const handleReaderComplete = async () => {
    setShowReader(false);
    
    if (!currentReaderSource) return;
    
    const sourceUrl = currentReaderSource.url;
    const index = currentReaderSource.sourceIndex;
    const metadata = currentReaderSource;

    toast({
      title: 'Generazione Q&A...',
      description: `Fonte ${index + 1}/${sources.length}`
    });

    const result = await generateQA({
      contentId: null,
      isPrePublish: true,
      title: metadata.title || '',
      summary: metadata.content || metadata.summary || '',
      excerpt: metadata.excerpt,
      type: metadata.type || 'article',
      sourceUrl: sourceUrl,
    });

    if (result.insufficient_context) {
      toast({
        title: 'Contenuto insufficiente',
        description: 'Puoi comunque usare questa fonte',
        variant: 'default'
      });
      // Skip to next source
      setCurrentSourceIndex(index + 1);
      startSourceGate(index + 1);
      return;
    }

    if (result.error || !result.questions) {
      toast({
        title: 'Errore generazione quiz',
        description: result.error || 'Impossibile generare Q&A',
        variant: 'destructive'
      });
      return;
    }

    // 2. Then show the Quiz
    setCurrentQuiz({
      questions: result.questions,
      sourceUrl: sourceUrl,
      sourceIndex: index,
      metadata
    });
    setShowQuiz(true);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setContent(value);
    setCursorPosition(cursorPos);

    // Detect @ mentions
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }
  };

  const handleSelectMention = (user: { username: string }) => {
    const textBeforeCursor = content.slice(0, cursorPosition);
    const textAfterCursor = content.slice(cursorPosition);
    
    // Remove the partial @mention and replace with full @username
    const beforeMention = textBeforeCursor.replace(/@\w*$/, '');
    const newText = `${beforeMention}@${user.username} ${textAfterCursor}`;
    
    setContent(newText);
    setShowMentions(false);
    setMentionQuery('');
    
    // Focus back on textarea
    setTimeout(() => {
      contentTextareaRef.current?.focus();
      const newCursorPos = beforeMention.length + user.username.length + 2;
      contentTextareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };


  const publishContent = async () => {
    if (!user) {
      toast({
        title: 'Errore',
        description: 'Devi essere autenticato per pubblicare un post',
        variant: 'destructive'
      });
      return;
    }

    setIsPublishing(true);

    try {
      // Get metadata for the first source if available
      const firstSourceUrl = sources.length > 0 ? sources[0] : null;
      let firstSourceMetadata = firstSourceUrl ? sourceMetadata[firstSourceUrl] : null;

      // Fallback: if metadata not available, fetch it now
      if (firstSourceUrl && !firstSourceMetadata) {
        toast({
          title: 'Recupero informazioni fonte...',
          description: 'Attendi...'
        });
        firstSourceMetadata = await fetchArticlePreview(firstSourceUrl);
        if (firstSourceMetadata) {
          setSourceMetadata(prev => ({ ...prev, [firstSourceUrl]: firstSourceMetadata }));
        }
      }

    const { data: postData, error } = await supabase
      .from('posts')
      .insert({
        content,
        author_id: user.id,
        sources: sources.length > 0 ? sources : null,
        // Don't copy metadata from quoted post if it's an original post (no shared_url)
        shared_title: (quotedPost && !quotedPost.shared_url) 
          ? null  // Original quoted post
          : (quotedPost?.shared_title || firstSourceMetadata?.title || null),
        shared_url: (quotedPost && !quotedPost.shared_url)
          ? null  // Original quoted post
          : (quotedPost?.shared_url || firstSourceUrl),
        preview_img: (quotedPost && !quotedPost.shared_url)
          ? null  // Original quoted post
          : (quotedPost?.preview_img || firstSourceMetadata?.previewImg || null),
        quoted_post_id: quotedPost?.id || null,
      })
      .select()
      .single();

      if (error) throw error;
      if (!postData) throw new Error('Failed to create post');

      toast({
        title: 'Post pubblicato!',
        description: 'Il tuo post è stato pubblicato con successo',
      });

      // Update post_qa records with the real post_id
      for (const source of sources) {
        await supabase
          .from('post_qa')
          .update({ post_id: postData.id })
          .eq('source_url', source)
          .is('post_id', null);
        
        // Update post_gate_attempts records as well
        await supabase
          .from('post_gate_attempts')
          .update({ post_id: postData.id })
          .eq('source_url', source)
          .is('post_id', null)
          .eq('user_id', user.id);
      }

      // Refresh posts feed
      queryClient.invalidateQueries({ queryKey: ['posts'] });

      // Reset modal state and close
      setContent('');
      setSources([]);
      setNewSource('');
      setSourceMetadata({});
      setGateQueueState(null);
      setCurrentSourceIndex(0);
      setShowQuiz(false);
      setCurrentQuiz(null);
      onClose();
    } catch (error: any) {
      console.error('[publishContent] Error details:', {
        message: error.message,
        stack: error.stack,
        error: error,
        sources: sources,
        content: content.substring(0, 50) + '...'
      });
      toast({
        title: 'Errore',
        description: `Si è verificato un errore durante la pubblicazione: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleGateComplete = () => {
    setShowGateQueue(false);
    // Show toast notification before publishing
    setTimeout(() => {
      publishContent();
    }, 100);
  };

  // Fetch user profile for avatar
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('avatar_url, full_name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setUserProfile(data));
    }
  }, [user]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarContent = () => {
    if (userProfile?.avatar_url) {
      return (
        <img
          src={userProfile.avatar_url}
          alt="Avatar"
          className="w-8 h-8 rounded-full object-cover"
        />
      );
    }

    return (
      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-semibold">
        {userProfile?.full_name ? getInitials(userProfile.full_name) : '?'}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-[340px] mx-4 bg-card rounded-3xl shadow-lg border border-border max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-foreground">Crea</h2>
          </div>
          
          <div className="flex items-center space-x-3">
            {getAvatarContent()}
            <button
              onClick={handleSubmit}
              disabled={!content.trim() || isPublishing}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                content.trim() && !isPublishing
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isPublishing ? 'Pubblicazione...' : 'Pubblica'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-5 space-y-5 overflow-y-auto">
          {/* Text Area */}
          <div className="relative z-10">
            <textarea
              ref={contentTextareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder={quotedPost ? "Aggiungi il tuo commento..." : "Scrivi qui il tuo Knowledge Drop..."}
              className="w-full min-h-[120px] p-0 bg-transparent border-0 resize-none focus:outline-none text-foreground placeholder:text-muted-foreground text-base leading-relaxed"
              autoFocus
            />
            
            {showMentions && (
              <MentionDropdown
                users={mentionUsers}
                onSelect={handleSelectMention}
                isLoading={isSearching}
                position="below"
              />
            )}
          </div>

          {/* Quoted Post Preview */}
          {quotedPost && (
            <QuotedPostCard quotedPost={quotedPost} />
          )}

          {/* Sources Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Fonti</span>
              <button
                onClick={() => document.getElementById('source-input')?.focus()}
                className="text-sm text-primary font-medium hover:underline"
              >
                Aggiungi Fonti
              </button>
            </div>

            {/* Add Source Input */}
            <div className="flex space-x-2">
              <input
                id="source-input"
                type="url"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 px-4 py-3 bg-input rounded-lg border border-border focus:ring-2 focus:ring-primary focus:outline-none text-sm text-foreground"
                onKeyPress={(e) => e.key === 'Enter' && addSource()}
              />
              <button
                onClick={addSource}
                disabled={!newSource.trim()}
                className={cn(
                  "px-4 py-3 rounded-lg transition-colors",
                  newSource.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Sources List with Gate States */}
            {sources.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 overflow-hidden">
                  {sources.map((sourceUrl, index) => {
                    const sourceWithGate = gateQueueState?.sources.find(s => s.url === sourceUrl);
                    if (sourceWithGate) {
                      return (
                        <SourceChip
                          key={sourceWithGate.id}
                          source={sourceWithGate}
                          onRemove={() => removeSource(index)}
                        />
                      );
                    }
                    
                    // Fallback for sources not yet in queue
                    return (
                      <div
                        key={index}
                        className="inline-flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 text-sm"
                      >
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                        <span className="text-foreground truncate max-w-[200px]">
                          {sourceUrl}
                        </span>
                        <button
                          onClick={() => removeSource(index)}
                          className="text-muted-foreground hover:text-foreground ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                
                {/* Gate Status Message */}
                {sources.length > 0 && !allSourcesPassed && (
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                    <p className="text-xs text-accent">
                      💡 <strong>Comprehension Gate™:</strong> Per pubblicare, completa la lettura e il test per tutte le fonti aggiunte. Il post verrà pubblicato automaticamente al completamento.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between p-5 border-t border-border">
          <div className="flex items-center space-x-4">
            <button className="p-2 text-muted-foreground hover:text-primary transition-colors">
              <FileText className="w-5 h-5" />
            </button>
            <button className="p-2 text-muted-foreground hover:text-primary transition-colors">
              <Image className="w-5 h-5" />
            </button>
            <button className="p-2 text-muted-foreground hover:text-primary transition-colors">
              <MapPin className="w-5 h-5" />
            </button>
          </div>
          
          <div className="text-xs text-muted-foreground">
            {content.length}/280
          </div>
        </div>
      </div>
      
      {/* Reader Modal */}
      {showReader && currentReaderSource && (
        <SourceReaderGate
          source={currentReaderSource}
          isOpen={showReader}
          onClose={() => {
            setShowReader(false);
            setCurrentReaderSource(null);
            setIsPublishing(false);
          }}
          onComplete={handleReaderComplete}
        />
      )}

      {/* Quiz Modal */}
      {showQuiz && currentQuiz && user && (
        <QuizModal
          questions={currentQuiz.questions}
          provider="gemini"
          onSubmit={async (answers) => {
            const result = await validateAnswers({
              postId: null,
              sourceUrl: currentQuiz.sourceUrl,
              answers,
              gateType: 'composer'
            });

            if (result.passed) {
              console.log('[QuizModal] Test passed, moving to next source');
              
              // Close quiz modal
              setShowQuiz(false);
              setCurrentQuiz(null);
              
              // Move to next source
              const nextIndex = currentSourceIndex + 1;
              setCurrentSourceIndex(nextIndex);
              
              // Wait for state to update before proceeding
              setTimeout(async () => {
                console.log('[QuizModal] Calling startSourceGate with index:', nextIndex);
                await startSourceGate(nextIndex);
              }, 100);
            } else {
              // Test failed: close modal and show error
              setShowQuiz(false);
              setCurrentQuiz(null);
              toast({
                title: 'Test fallito',
                description: 'Non hai superato il test di comprensione. Riprova a leggere la fonte.',
                variant: 'destructive'
              });
            }

            return result;
          }}
          onCancel={() => {
            setShowQuiz(false);
            setCurrentQuiz(null);
            toast({
              title: 'Pubblicazione annullata',
              description: 'Devi completare il test per tutte le fonti'
            });
          }}
        />
      )}
    </div>
  );
};
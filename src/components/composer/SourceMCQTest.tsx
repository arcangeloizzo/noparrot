// SourceMCQTest - Multiple choice test for source comprehension
// ==============================================================
// ✅ Shows 3 questions (2 macro + 1 detail) for source
// ✅ SECURITY HARDENED: No client-side correctId - validation via submit-qa
// ✅ Deterministic questions based on source URL/domain

import React, { useState, useEffect } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SourceWithGate } from '@/lib/comprehension-gate-extended';
import { fetchArticlePreview, generateQA, validateAnswers, type QuizQuestion } from '@/lib/ai-helpers';
import { getWordCount, getTestModeWithSource } from '@/lib/gate-utils';
import { supabase } from '@/integrations/supabase/client';
import { haptics } from '@/lib/haptics';

interface SourceMCQTestProps {
  source: SourceWithGate;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (passed: boolean) => void;
}

export const SourceMCQTest: React.FC<SourceMCQTestProps> = ({
  source,
  isOpen,
  onClose,
  onComplete
}) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [wrongQuestions, setWrongQuestions] = useState<Set<string>>(new Set());
  const [showResult, setShowResult] = useState<'correct' | 'wrong' | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [qaId, setQaId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && source) {
      loadQuestionsForSource();
    }
  }, [isOpen, source]);

  const loadQuestionsForSource = async () => {
    setIsLoadingQuestions(true);
    setQuestionError(null);
    
    // Reset state
    setCurrentQuestion(0);
    setAnswers({});
    setWrongQuestions(new Set());
    setShowResult(null);
    setIsComplete(false);
    setQaId(null);
    
    try {
      console.log('[SourceMCQTest] Loading questions for:', source.url);
      
      // 1. Fetch article preview to get metadata and qaSourceRef
      const preview = await fetchArticlePreview(source.url);
      
      if (!preview || !preview.success) {
        throw new Error('Impossibile recuperare il contenuto della fonte');
      }
      
      console.log('[SourceMCQTest] Preview fetched:', {
        title: preview.title?.substring(0, 50),
        qaSourceRef: preview.qaSourceRef,
        type: preview.type
      });
      
      // Check if qaSourceRef is available
      if (!preview.qaSourceRef) {
        throw new Error('Riferimento contenuto mancante');
      }
      
      // 2. Calcola testMode
      // Per SourceMCQTest, usato tipicamente nel flow originale (non reshare),
      // forziamo SOURCE_ONLY perché non ha senso testare l'utente su ciò che scrive lui
      const testMode: 'SOURCE_ONLY' | 'MIXED' | 'USER_ONLY' = 'SOURCE_ONLY';

      console.log('[SourceMCQTest] Test mode:', testMode);
      
      // 3. Generate AI questions using qaSourceRef (source-first)
      const result = await generateQA({
        contentId: null,
        isPrePublish: true,
        title: preview.title || source.title || '',
        qaSourceRef: preview.qaSourceRef,
        sourceUrl: source.url,
        userText: '', // No userText for original shares
        testMode: testMode,
      });
      
      console.log('[SourceMCQTest] Generate QA result:', {
        hasQuestions: !!result.questions,
        questionCount: result.questions?.length,
        hasError: !!result.error,
        insufficientContext: !!result.insufficient_context
      });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      if (result.insufficient_context) {
        throw new Error('Contenuto insufficiente per generare domande');
      }
      
      if (!result.questions || result.questions.length === 0) {
        throw new Error('Formato domande non valido');
      }
      
      console.log('[SourceMCQTest] Questions loaded successfully');
      setQuestions(result.questions);
      
      // Store qaId if returned
      if ((result as any).qaId) {
        setQaId((result as any).qaId);
      }
      
    } catch (error: any) {
      console.error('[SourceMCQTest] Error loading questions:', error);
      setQuestionError(error.message || 'Errore nel caricamento delle domande');
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  // SECURITY HARDENED: NO feedback until server validation
  // Fixes "every answer appears correct" bug
  const handleAnswer = async (questionId: string, choiceId: string) => {
    if (isSubmitting) return;
    
    // Haptic on selection
    haptics.selection();
    
    // Store the answer
    const newAnswers = { ...answers, [questionId]: choiceId };
    setAnswers(newAnswers);
    
    // If this is the last question, submit all answers for validation
    if (currentQuestion === questions.length - 1) {
      setIsSubmitting(true);
      
      try {
        const result = await validateAnswers({
          qaId: qaId || undefined,
          postId: null,
          sourceUrl: source.url,
          answers: newAnswers,
          gateType: 'composer'
        });
        
        // SECURITY: Only show feedback AFTER server responds
        if (result.passed) {
          haptics.success();
          setShowResult('correct');
          setTimeout(() => {
            setShowResult(null);
            setIsComplete(true);
          }, 1500);
        } else {
          // Mark wrong questions based on server response
          haptics.warning();
          setWrongQuestions(new Set(result.wrongIndexes));
          setShowResult('wrong');
          
          setTimeout(() => {
            setShowResult(null);
            // Reset to first wrong question for retry
            const firstWrongIndex = questions.findIndex(q => result.wrongIndexes.includes(q.id));
            if (firstWrongIndex >= 0) {
              setCurrentQuestion(firstWrongIndex);
              // Clear answers for wrong questions to allow retry
              const clearedAnswers = { ...newAnswers };
              result.wrongIndexes.forEach(id => delete clearedAnswers[id]);
              setAnswers(clearedAnswers);
            } else {
              // All wrong or test failed completely
              onComplete(false);
            }
          }, 1500);
        }
      } catch (error) {
        console.error('[SourceMCQTest] Validation error:', error);
        // SECURITY: On error, show failure - never assume correct
        haptics.warning();
        setShowResult('wrong');
        setTimeout(() => setShowResult(null), 1500);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Not last question - move to next WITHOUT any feedback
      // NO setShowResult('correct') - that was the bug!
      setTimeout(() => {
        setCurrentQuestion(prev => prev + 1);
      }, 300);
    }
  };

  const handleRetry = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setWrongQuestions(new Set());
    setShowResult(null);
    setIsComplete(false);
  };

  if (!isOpen) return null;

  // Loading state
  if (isLoadingQuestions) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-background rounded-2xl w-[90vw] max-w-md p-8 text-center border border-border">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-foreground font-medium mb-2">Stiamo mettendo a fuoco ciò che conta…</p>
          <p className="text-sm text-muted-foreground">Sto selezionando i punti che contano…</p>
        </div>
      </div>
    );
  }

  // Error state
  if (questionError) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-background rounded-2xl w-[90vw] max-w-md p-6 text-center border border-border">
          <div className="w-16 h-16 bg-trust-low/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-trust-low" />
          </div>
          <h2 className="text-xl font-semibold mb-2 text-foreground">Errore</h2>
          <p className="text-muted-foreground mb-4">{questionError}</p>
          <div className="space-y-2">
            <Button onClick={() => {
              haptics.light();
              loadQuestionsForSource();
            }} className="w-full">
              Riprova
            </Button>
            <Button onClick={onClose} variant="outline" className="w-full">
              Chiudi
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) return null;

  if (isComplete) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-background rounded-2xl w-[90vw] max-w-md p-6 text-center border border-border">
          <div className="mb-6">
            <div className="w-16 h-16 bg-[hsl(var(--cognitive-correct))]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-[hsl(var(--cognitive-correct))] animate-bounce-check" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-foreground">
              Possiamo procedere.
            </h2>
            <p className="text-muted-foreground">
              Hai messo a fuoco. Ora puoi continuare.
            </p>
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={() => {
                haptics.success();
                onComplete(true);
              }} 
              className="w-full bg-[hsl(var(--cognitive-correct))] hover:bg-[hsl(var(--cognitive-correct))]/90 text-white"
            >
              Continua
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];
  const isQuestionWrong = wrongQuestions.has(question.id);
  const questionType = currentQuestion < 2 ? 'macro' : 'detail';

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-background rounded-2xl w-[90vw] h-[84vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-foreground">
              Mettiamo a fuoco.
            </h2>
            <span className="text-sm text-muted-foreground">
              Passo {currentQuestion + 1} di {questions.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Source Info */}
        <div className="p-4 border-b border-border bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Fonte: <span className="text-foreground font-medium">{source.title}</span>
          </p>
        </div>

        {/* Question */}
        <div className="p-4 flex-1 overflow-y-auto">
          <div className={cn(
            "mb-6 p-4 rounded-lg border-2 transition-all duration-300",
            showResult === 'correct' && "bg-[hsl(var(--cognitive-correct))]/10 border-[hsl(var(--cognitive-correct))] animate-mint-flash",
            showResult === 'wrong' && "bg-[hsl(var(--cognitive-incorrect))]/20 border-[hsl(var(--cognitive-incorrect))] animate-shake",
            !showResult && "bg-card border-border"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2 py-1 rounded text-xs font-medium",
                  questionType === 'macro' ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"
                )}>
                  {questionType === 'macro' ? 'Comprensione' : 'Dettaglio'}
                </span>
                {showResult === 'correct' && (
                  <Check className="w-5 h-5 text-[hsl(var(--cognitive-correct))] animate-bounce-check" />
                )}
              </div>
              {isQuestionWrong && (
                <span className="text-xs text-[hsl(var(--cognitive-incorrect))]">
                  Riprova
                </span>
              )}
            </div>
            
            <h3 className="font-medium mb-4 text-foreground">
              {question.stem}
            </h3>
            
            <div className="space-y-2">
              {question.choices.map((choice) => (
                <Button
                  key={choice.id}
                  variant="outline"
                  onClick={() => handleAnswer(question.id, choice.id)}
                  disabled={showResult !== null || isSubmitting}
                  className="w-full justify-start text-left h-auto p-3 bg-card hover:bg-muted border-border hover:border-border text-foreground"
                >
                  {isSubmitting && currentQuestion === questions.length - 1 ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {choice.text}
                </Button>
              ))}
            </div>
          </div>

          {isQuestionWrong && showResult !== 'correct' && (
            <div className="p-3 bg-[hsl(var(--cognitive-incorrect))]/10 border border-[hsl(var(--cognitive-incorrect))]/20 rounded-lg">
              <p className="text-sm text-[hsl(var(--cognitive-incorrect))]">
                Non è questa la prospettiva giusta. Riprova.
              </p>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Passo {currentQuestion + 1} di {questions.length}
            </span>
            <span className="text-sm text-muted-foreground">
              {Object.keys(answers).length} risposte
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentQuestion / questions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

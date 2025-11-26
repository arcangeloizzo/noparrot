// SourceMCQTest - Multiple choice test for source comprehension
// ==============================================================
// ✅ Shows 3 questions (2 macro + 1 detail) for source
// ✅ Max 2 attempts per question with shake/bounce animations
// ✅ Deterministic questions based on source URL/domain

import React, { useState, useEffect } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SourceWithGate } from '@/lib/comprehension-gate-extended';
import { fetchArticlePreview, generateQA, type QuizQuestion } from '@/lib/ai-helpers';
import { getWordCount, getTestModeWithSource } from '@/lib/gate-utils';

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
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [showResult, setShowResult] = useState<'correct' | 'wrong' | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);

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
    setAttempts({});
    setShowResult(null);
    setIsComplete(false);
    
    try {
      console.log('[SourceMCQTest] Loading questions for:', source.url);
      
      // 1. Fetch article preview to get full metadata
      const preview = await fetchArticlePreview(source.url);
      
      if (!preview) {
        throw new Error('Impossibile recuperare il contenuto della fonte');
      }
      
      console.log('[SourceMCQTest] Preview fetched:', {
        title: preview.title?.substring(0, 50),
        summaryLength: preview.summary?.length,
        contentLength: preview.content?.length,
        excerptLength: preview.excerpt?.length,
        type: preview.type
      });
      
      // 2. Calcola testMode se c'è testo utente
      const userText = (source as any).userText || '';
      const userWordCount = getWordCount(userText);
      const testMode = userText ? getTestModeWithSource(userWordCount) : 'SOURCE_ONLY';

      console.log('[SourceMCQTest] Test mode:', testMode, 'userWordCount:', userWordCount);
      
      // 3. Generate AI questions
      const result = await generateQA({
        contentId: null,
        isPrePublish: true,
        title: preview.title || source.title || '',
        summary: preview.content || preview.summary || preview.excerpt || '',
        excerpt: preview.excerpt || '',
        type: preview.type as any || 'article',
        sourceUrl: source.url,
        userText: userText,
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
      
      if (!result.questions || result.questions.length !== 3) {
        throw new Error('Formato domande non valido');
      }
      
      console.log('[SourceMCQTest] Questions loaded successfully');
      setQuestions(result.questions);
      
    } catch (error: any) {
      console.error('[SourceMCQTest] Error loading questions:', error);
      setQuestionError(error.message || 'Errore nel caricamento delle domande');
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleAnswer = (questionId: string, choiceId: string) => {
    const question = questions.find(q => q.id === questionId);
    if (!question) return;

    const isCorrect = choiceId === question.correctId;
    
    if (isCorrect) {
      setAnswers(prev => ({ ...prev, [questionId]: choiceId }));
      setShowResult('correct');
      
      setTimeout(() => {
        setShowResult(null);
        if (currentQuestion < questions.length - 1) {
          setCurrentQuestion(prev => prev + 1);
        } else {
          // Test completed successfully
          setIsComplete(true);
        }
      }, 1500);
    } else {
      const currentAttempts = attempts[questionId] || 0;
      const newAttempts = currentAttempts + 1;
      setAttempts(prev => ({ ...prev, [questionId]: newAttempts }));
      
      if (newAttempts >= 2) {
        // Max attempts reached - fail the test
        setTimeout(() => {
          onComplete(false);
        }, 1000);
        return;
      }
      
      setShowResult('wrong');
      setTimeout(() => setShowResult(null), 800);
    }
  };

  const handleRetry = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setAttempts({});
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
            <Button onClick={() => loadQuestionsForSource()} className="w-full">
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
              onClick={() => onComplete(true)} 
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
  const questionAttempts = attempts[question.id] || 0;
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
              {questionAttempts > 0 && (
                <span className="text-xs text-[hsl(var(--cognitive-incorrect))]">
                  Tentativo {questionAttempts + 1}/2
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
                  disabled={showResult !== null}
                  className="w-full justify-start text-left h-auto p-3 bg-card hover:bg-muted border-border hover:border-border text-foreground"
                >
                  {choice.text}
                </Button>
              ))}
            </div>
          </div>

          {questionAttempts > 0 && showResult !== 'correct' && (
            <div className="p-3 bg-[hsl(var(--cognitive-incorrect))]/10 border border-[hsl(var(--cognitive-incorrect))]/20 rounded-lg">
              <p className="text-sm text-[hsl(var(--cognitive-incorrect))]">
                {questionAttempts === 1 
                  ? "Non è questa la prospettiva giusta. Hai un altro tentativo." 
                  : "Ultimo tentativo disponibile."}
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
              {Object.keys(answers).length} risposte corrette
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
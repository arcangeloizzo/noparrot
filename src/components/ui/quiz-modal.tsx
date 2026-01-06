import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "./button";
import { CheckCircle2, XCircle } from "lucide-react";
import { QuizQuestion } from "@/lib/ai-helpers";
import { cn } from "@/lib/utils";
import { updateCognitiveDensityWeighted } from "@/lib/cognitiveDensity";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lockBodyScroll, unlockBodyScroll, getCurrentLockOwner } from "@/lib/bodyScrollLock";
import { addBreadcrumb } from "@/lib/crashBreadcrumbs";

interface QuizModalProps {
  questions: QuizQuestion[];
  onSubmit: (answers: Record<string, string>) => Promise<{ passed: boolean; score?: number; total?: number; wrongIndexes: string[] }>;
  onCancel?: () => void;
  onComplete?: (passed: boolean) => void; // Called when quiz finishes (pass or fail)
  provider?: string;
  postCategory?: string;
}

export function QuizModal({ questions, onSubmit, onCancel, onComplete, postCategory }: QuizModalProps) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; score?: number; total?: number; wrongIndexes: string[] } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [questionAttempts, setQuestionAttempts] = useState<Record<string, number>>({});
  const [totalErrors, setTotalErrors] = useState(0);
  const [showRetryMessage, setShowRetryMessage] = useState(false);

  // Protezione unmount per evitare setState su componenti smontati
  const isMountedRef = useRef(true);
  const timeoutRefs = useRef<number[]>([]);

  // Guard to prevent double-firing of close/complete handlers (iOS Safari double-tap issue)
  const closeInProgressRef = useRef(false);
  const [buttonsDisabled, setButtonsDisabled] = useState(false);

  const safeSetTimeout = useCallback((callback: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      if (isMountedRef.current) {
        callback();
      }
    }, ms);
    timeoutRefs.current.push(id);
    return id;
  }, []);

  // Cleanup al unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      timeoutRefs.current.forEach(id => clearTimeout(id));
      timeoutRefs.current = [];
    };
  }, []);

  // Body scroll lock - Use centralized utility
  useEffect(() => {
    // Quiz takes over lock from reader (if reader had it)
    addBreadcrumb('quiz_mount');
    addBreadcrumb('quiz_scroll_lock');
    lockBodyScroll('quiz');

    return () => {
      addBreadcrumb('quiz_cleanup_start');
      // Only unlock if quiz still owns the lock (avoid double-unlock if forceUnlock was called)
      const owner = getCurrentLockOwner();
      if (owner === 'quiz') {
        addBreadcrumb('quiz_scroll_unlock_do');
        unlockBodyScroll('quiz');
      } else {
        addBreadcrumb('quiz_scroll_unlock_skipped', { currentOwner: owner });
      }
      addBreadcrumb('quiz_cleanup_done');
    };
  }, []);

  // Debugging: log questions received
  useEffect(() => {
    console.log('[QuizModal] Received questions:', questions);
    console.log('[QuizModal] Questions type:', typeof questions);
    console.log('[QuizModal] Is array:', Array.isArray(questions));
    console.log('[QuizModal] Length:', questions?.length);
  }, [questions]);

  // Validate questions is actually an array
  const validQuestions = Array.isArray(questions) ? questions : [];
  const currentQuestion = validQuestions[currentStep];
  const hasValidQuestions = validQuestions.length > 0 && currentQuestion;

  // Safety check - if no valid questions, show error state
  if (!hasValidQuestions) {
    console.log('[QuizModal] No valid questions - showing error state');
    return (
      <div 
        className="fixed inset-0 bg-black/80 z-[9999] pointer-events-auto"
        onClick={(e) => e.target === e.currentTarget && onCancel?.()}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-auto">
          <div 
            className="bg-card rounded-2xl w-full max-w-md p-8 text-center shadow-2xl border border-border pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ pointerEvents: 'auto' }}
          >
            <h2 className="text-xl font-bold mb-4 text-foreground">Errore nel caricamento</h2>
            <p className="text-muted-foreground mb-6">Non è stato possibile caricare le domande. Riprova più tardi.</p>
            <Button onClick={(e) => { e.stopPropagation(); onCancel?.(); }} variant="outline" className="w-full pointer-events-auto">Chiudi</Button>
          </div>
        </div>
      </div>
    );
  }

  // SECURITY HARDENED: No client-side validation - all answers submitted to server
  const handleAnswer = async (questionId: string, choiceId: string) => {
    if (showFeedback) return;
    
    setSelectedChoice(choiceId);
    const newAnswers = { ...answers, [questionId]: choiceId };
    setAnswers(newAnswers);
    
    // Move to next question or submit
    if (currentStep < validQuestions.length - 1) {
      setShowFeedback(true);
      setIsCorrect(true); // Show neutral feedback while progressing
      safeSetTimeout(() => {
        setCurrentStep(prev => prev + 1);
        resetFeedback();
      }, 500);
    } else {
      // Last question - submit all answers for server-side validation
      setShowFeedback(true);
      handleFinalSubmit();
    }
  };

  const resetFeedback = () => {
    setSelectedChoice(null);
    setIsCorrect(null);
    setShowFeedback(false);
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    addBreadcrumb('quiz_submit_start');
    try {
      const validationResult = await onSubmit(answers);
      setResult(validationResult);
      addBreadcrumb('quiz_submit_result', { passed: validationResult.passed });
      
      // Se passato e c'è una categoria, incrementa cognitive_density con peso COMMENT_WITH_GATE
      if (validationResult.passed && user && postCategory) {
        await updateCognitiveDensityWeighted(user.id, postCategory, 'COMMENT_WITH_GATE');
      }

      // AUTO-PUBLISH: se passato, chiama onComplete(true) automaticamente dopo breve delay
      // L'utente NON deve premere "Chiudi" - il publish parte da solo
      if (validationResult.passed && onComplete) {
        addBreadcrumb('quiz_auto_complete_scheduled');
        setButtonsDisabled(true);
        safeSetTimeout(() => {
          if (closeInProgressRef.current) return;
          closeInProgressRef.current = true;
          addBreadcrumb('quiz_auto_complete_fire');
          onComplete(true);
        }, 800); // 800ms per far vedere "Hai compreso" poi auto-chiude
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
      addBreadcrumb('quiz_submit_error', { error: String(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Ignore backdrop clicks if result is showing (user must use button)
    // Also ignore if close is already in progress
    if (result || closeInProgressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.target === e.currentTarget && onCancel) {
      e.preventDefault();
      e.stopPropagation();
      addBreadcrumb('quiz_closed', { via: 'backdrop' });
      onCancel();
    }
  };

  // Centralized close handler to prevent double-firing
  const handleCloseClick = (passed: boolean) => {
    if (closeInProgressRef.current) {
      addBreadcrumb('quiz_close_ignored_double', { passed });
      return;
    }
    closeInProgressRef.current = true;
    setButtonsDisabled(true);
    addBreadcrumb('quiz_close_tap', { passed });

    if (passed) {
      addBreadcrumb('quiz_complete_passed');
      addBreadcrumb('quiz_closed', { via: 'complete', passed: true });
      onComplete ? onComplete(true) : onCancel?.();
    } else {
      addBreadcrumb('quiz_complete_failed');
      addBreadcrumb('quiz_closed', { via: 'complete', passed: false });
      onComplete ? onComplete(false) : onCancel?.();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-[9999] pointer-events-auto touch-none"
      onClick={handleBackdropClick}
      style={{ pointerEvents: 'auto' }}
    >
      <div 
        className="fixed inset-0 z-[10000] flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4 pointer-events-auto touch-none"
        style={{ pointerEvents: 'auto' }}
      >
        <div 
          className="bg-background rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl pointer-events-auto flex flex-col"
          onClick={(e) => e.stopPropagation()}
          style={{ 
            pointerEvents: 'auto', 
            maxHeight: 'calc(100dvh - 2rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
          }}
        >
          
          {result ? (
            <div className="p-6 sm:p-8 text-center flex-1 overflow-y-auto">
              {result.passed ? (
                <>
                  <div className="mb-4 sm:mb-6 flex justify-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[hsl(var(--cognitive-correct))]/20 flex items-center justify-center">
                      <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-[hsl(var(--cognitive-correct))]" />
                    </div>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Hai compreso.</h2>
                  <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base">Pubblicazione in corso…</p>
                  {/* Il bottone resta come fallback ma non è richiesto - auto-publish parte */}
                  <Button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleCloseClick(true);
                    }} 
                    disabled={buttonsDisabled}
                    className="w-full font-medium pointer-events-auto" 
                    style={{ pointerEvents: 'auto' }}
                  >
                    {buttonsDisabled ? 'Pubblicazione…' : 'Pubblica ora'}
                  </Button>
                </>
              ) : (
                <>
                  <div className="mb-4 sm:mb-6 flex justify-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[hsl(var(--cognitive-incorrect))]/30 flex items-center justify-center">
                      <XCircle className="w-10 h-10 sm:w-12 sm:h-12 text-[hsl(var(--cognitive-incorrect))]" />
                    </div>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Non ancora.</h2>
                  <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base">La comprensione richiede tempo, non fretta.</p>
                  <Button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleCloseClick(false);
                    }} 
                    disabled={buttonsDisabled}
                    variant="outline" 
                    className="w-full font-medium pointer-events-auto" 
                    style={{ pointerEvents: 'auto' }}
                  >
                    {buttonsDisabled ? 'Chiusura…' : 'Chiudi'}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="p-4 sm:p-6 border-b border-border flex-shrink-0">
                <h2 className="text-lg sm:text-xl font-bold text-center">Mettiamo a fuoco.</h2>
                <p className="text-xs sm:text-sm text-muted-foreground text-center mt-1 sm:mt-2">Una domanda alla volta, per vedere più chiaro.</p>
                <div className="flex justify-center gap-2 mt-3 sm:mt-4">
                  {validQuestions.map((_, idx) => (
                    <div key={idx} className={cn("w-2 h-2 rounded-full transition-all duration-200",
                      idx < currentStep ? "bg-[hsl(var(--cognitive-correct))]" : 
                      idx === currentStep ? "bg-[hsl(var(--cognitive-glow-blue))] scale-125" : "bg-muted")} />
                  ))}
                </div>
              </div>

              <div 
                className="p-4 sm:p-6 flex-1 overflow-y-auto min-h-0 overscroll-contain touch-pan-y"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <p className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-2">Passo {currentStep + 1} — facciamo chiarezza su questo punto.</p>
                <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6">{currentQuestion.stem}</h3>

                <div className="space-y-2 sm:space-y-3">
                  {(currentQuestion.choices || []).map((choice) => {
                    const isSelected = selectedChoice === choice.id;
                    // SECURITY: No client-side correctId check - just show selection state
                    const isSelectedAndFeedback = showFeedback && isSelected;

                    return (
                      <button 
                        key={choice.id} 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!showFeedback) handleAnswer(currentQuestion.id, choice.id);
                        }}
                        disabled={showFeedback}
                        style={{ pointerEvents: 'auto' }}
                        className={cn("w-full p-3 sm:p-5 rounded-xl sm:rounded-2xl text-left transition-all border-2 pointer-events-auto text-sm sm:text-base",
                          !showFeedback && !isSelected && "border-border bg-muted/20 hover:border-muted-foreground hover:bg-muted/40",
                          !showFeedback && isSelected && "border-[hsl(var(--cognitive-glow-blue))] bg-[hsl(var(--cognitive-glow-blue))]/10",
                          isSelectedAndFeedback && "border-[hsl(var(--cognitive-glow-blue))] bg-[hsl(var(--cognitive-glow-blue))]/10")}>
                        <span className={cn("flex-1 leading-relaxed", isSelectedAndFeedback && "font-medium")}>{choice.text}</span>
                      </button>
                    );
                  })}
                </div>

                {showFeedback && (
                  <div className={cn("p-3 sm:p-5 rounded-xl sm:rounded-2xl mt-4 sm:mt-6 text-center animate-fade-in",
                    isCorrect ? "bg-[hsl(var(--cognitive-correct))]/10 border-2 border-[hsl(var(--cognitive-correct))]/30" : 
                    "bg-[hsl(var(--cognitive-incorrect))]/20 border-2 border-[hsl(var(--cognitive-incorrect))]/40")}>
                    <p className={cn("font-medium text-sm sm:text-[15px]", isCorrect ? "text-[hsl(var(--cognitive-correct))]" : "text-foreground")}>
                      {isCorrect ? "Ottimo. Continuiamo." : "Questa parte non è ancora limpida. Riguardiamola insieme."}
                    </p>
                    {!isCorrect && showRetryMessage && (
                      <p className="text-xs sm:text-sm mt-1 sm:mt-2 opacity-80">Hai ancora 1 tentativo disponibile.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex gap-3 pointer-events-auto flex-shrink-0" style={{ pointerEvents: 'auto', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
                {onCancel && <Button onClick={(e) => { e.stopPropagation(); addBreadcrumb('quiz_closed', { via: 'cancel' }); addBreadcrumb('quiz_cancel_button'); onCancel(); }} variant="outline" className="flex-1 pointer-events-auto" style={{ pointerEvents: 'auto' }}>Annulla</Button>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

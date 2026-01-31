import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "./button";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { QuizQuestion } from "@/lib/ai-helpers";
import { cn } from "@/lib/utils";
import { updateCognitiveDensityWeighted } from "@/lib/cognitiveDensity";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lockBodyScroll, unlockBodyScroll, getCurrentLockOwner } from "@/lib/bodyScrollLock";
import { addBreadcrumb } from "@/lib/crashBreadcrumbs";
import { toast } from "sonner";
import { haptics } from "@/lib/haptics";

interface QuizModalProps {
  questions: QuizQuestion[];
  qaId: string; // Required for server-side step validation
  onSubmit: (answers: Record<string, string>) => Promise<{ passed: boolean; score?: number; total?: number; wrongIndexes: string[] }>;
  onCancel?: () => void;
  onComplete?: (passed: boolean) => void;
  provider?: string;
  postCategory?: string;
  // NEW: Error state for validation failures with retry option
  errorState?: {
    code: 'ERROR_INSUFFICIENT_CONTENT' | 'ERROR_METADATA_ONLY';
    message: string;
  };
  onRetry?: () => void;
}

export function QuizModal({ questions, qaId, onSubmit, onCancel, onComplete, postCategory, errorState, onRetry }: QuizModalProps) {
  // DEBUG: Log props to verify errorState is being passed correctly
  console.log('[QuizModal] Render with props:', { 
    hasErrorState: !!errorState, 
    errorCode: errorState?.code,
    hasOnRetry: !!onRetry,
    questionsCount: questions?.length,
    qaId: qaId ? 'present' : 'missing'
  });
  
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; score?: number; total?: number; wrongIndexes: string[] } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [stepFeedback, setStepFeedback] = useState<{ isCorrect: boolean } | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [totalErrors, setTotalErrors] = useState(0);

  // Protezione unmount per evitare setState su componenti smontati
  const isMountedRef = useRef(true);
  const timeoutRefs = useRef<number[]>([]);

  // Guard to prevent double-firing of close/complete handlers
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

  // Body scroll lock
  useEffect(() => {
    addBreadcrumb('quiz_mount');
    addBreadcrumb('quiz_scroll_lock');
    lockBodyScroll('quiz');

    return () => {
      addBreadcrumb('quiz_cleanup_start');
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

  // NEW: Show dedicated error state with retry button for validation failures
  if (errorState) {
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
            <div className="mb-6 flex justify-center">
              <div className="w-16 h-16 rounded-full bg-[hsl(var(--cognitive-incorrect))]/20 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-[hsl(var(--cognitive-incorrect))]" />
              </div>
            </div>
            <h2 className="text-xl font-bold mb-3 text-foreground">L'analisi del contenuto non è stata ottimale</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              {errorState.code === 'ERROR_METADATA_ONLY' 
                ? "Il contenuto estratto contiene troppi elementi di interfaccia. Riprova per un'analisi più accurata."
                : "Non è stato possibile estrarre abbastanza contenuto dalla fonte. Riprova o aggiungi più contesto."}
            </p>
            <div className="space-y-3">
              <Button onClick={(e) => { e.stopPropagation(); onRetry?.(); }} className="w-full pointer-events-auto">
                <RefreshCw className="w-4 h-4 mr-2" />
                Riprova Analisi
              </Button>
              <Button onClick={(e) => { e.stopPropagation(); onCancel?.(); }} variant="outline" className="w-full pointer-events-auto">
                Annulla
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Validate questions is actually an array
  const validQuestions = Array.isArray(questions) ? questions : [];
  const currentQuestion = validQuestions[currentStep];
  const hasValidQuestions = validQuestions.length > 0 && currentQuestion;

  // Safety check - if no valid questions or no qaId, show error state
  if (!hasValidQuestions || !qaId) {
    console.log('[QuizModal] No valid questions or qaId - showing error state', { hasValidQuestions, qaId });
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

  /**
   * PRIVACY-SAFE STEP VALIDATION
   * Calls submit-qa with mode: "step" to get only { isCorrect: boolean }
   * Server never reveals correctId to client
   */
  const validateStep = async (questionId: string, choiceId: string): Promise<{ isCorrect: boolean } | null> => {
    try {
      // FORENSIC LOGGING: Track exact values being sent
      console.log('[QuizModal] ===== STEP VALIDATION =====');
      console.log('[QuizModal] qaId:', qaId);
      console.log('[QuizModal] questionId:', questionId, '(type:', typeof questionId, ')');
      console.log('[QuizModal] choiceId:', choiceId, '(type:', typeof choiceId, ')');
      
      const { data, error } = await supabase.functions.invoke('submit-qa', {
        body: { qaId, questionId, choiceId, mode: 'step' }
      });

      if (error) {
        console.error('[QuizModal] Step validation INVOKE error:', error);
        return null;
      }

      console.log('[QuizModal] Server response:', JSON.stringify(data));

      if (data && typeof data.isCorrect === 'boolean') {
        console.log('[QuizModal] Step result: isCorrect =', data.isCorrect);
        return { isCorrect: data.isCorrect };
      }

      if (data?.error) {
        console.error('[QuizModal] Server returned error:', data.error, data.code);
      } else {
        console.error('[QuizModal] Invalid step response format:', data);
      }
      return null;
    } catch (err) {
      console.error('[QuizModal] Step validation exception:', err);
      return null;
    }
  };

  /**
   * Handle answer selection with server-side step validation
   * BLOCK-ON-WRONG UX: User must answer correctly to proceed
   * 2 total errors = immediate failure
   */
  const handleAnswer = async (questionId: string, choiceId: string) => {
    if (showFeedback || isSubmitting) return;
    
    // Haptic on selection
    haptics.selection();
    
    setSelectedChoice(choiceId);
    setIsSubmitting(true);
    
    const newAnswers = { ...answers, [questionId]: choiceId };
    setAnswers(newAnswers);
    
    // STEP MODE: Validate single question server-side
    const stepResult = await validateStep(questionId, choiceId);
    
    if (!stepResult) {
      // FAIL-CLOSED: Show error, block quiz
      toast.error("Errore nella verifica della risposta");
      setIsSubmitting(false);
      return;
    }
    
    // Show feedback (blue for correct, yellow for incorrect)
    setStepFeedback(stepResult);
    setShowFeedback(true);
    
    if (!stepResult.isCorrect) {
      // WRONG ANSWER - haptic warning
      haptics.warning();
      const newTotalErrors = totalErrors + 1;
      setTotalErrors(newTotalErrors);
      
      if (newTotalErrors >= 2) {
        // 2nd error = IMMEDIATE FAILURE
        addBreadcrumb('quiz_fail_2_errors');
        safeSetTimeout(() => {
          setResult({ passed: false, wrongIndexes: [] });
        }, 800);
        return;
      }
      
      // 1st error: show feedback but DON'T advance - allow retry
      safeSetTimeout(() => {
        setSelectedChoice(null);
        setShowFeedback(false);
        setStepFeedback(null);
        setIsSubmitting(false);
        // Stay on same question - user must answer correctly
      }, 800);
      return;
    }
    
    // CORRECT ANSWER - proceed
    if (currentStep < validQuestions.length - 1) {
      // Move to next question
      safeSetTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setSelectedChoice(null);
        setShowFeedback(false);
        setStepFeedback(null);
        setIsSubmitting(false);
      }, 800);
    } else {
      // FINAL: Last question answered correctly - submit all for final verdict
      safeSetTimeout(() => {
        handleFinalSubmit(newAnswers);
      }, 600);
    }
  };

  /**
   * FINAL VERDICT - Server-only decision
   * Client never calculates passed status
   */
  const handleFinalSubmit = async (answersToSubmit: Record<string, string>) => {
    addBreadcrumb('quiz_submit_start');
    
    console.log('[QuizModal] handleFinalSubmit:', {
      answerCount: Object.keys(answersToSubmit).length,
      questionCount: validQuestions.length,
    });
    
    try {
      const validationResult = await onSubmit(answersToSubmit);
      
      console.log('[QuizModal] Server final result:', validationResult);
      
      // FAIL-FAST: If result is null/undefined, treat as failure
      if (!validationResult) {
        console.error('[QuizModal] Null validation result - treating as failure');
        setResult({ passed: false, wrongIndexes: [] });
        setIsSubmitting(false);
        return;
      }
      
      setResult(validationResult);
      addBreadcrumb('quiz_submit_result', { passed: validationResult.passed });
      
      // Haptic feedback on completion
      if (validationResult.passed) {
        haptics.success();
      } else {
        haptics.warning();
      }
      
      // Update cognitive density if passed
      if (validationResult.passed && user && postCategory) {
        await updateCognitiveDensityWeighted(user.id, postCategory, 'COMMENT_WITH_GATE');
      }

      // AUTO-PUBLISH: if passed, call onComplete(true) after delay
      if (validationResult.passed && onComplete) {
        addBreadcrumb('quiz_auto_complete_scheduled');
        setButtonsDisabled(true);
        safeSetTimeout(() => {
          if (closeInProgressRef.current) return;
          closeInProgressRef.current = true;
          addBreadcrumb('quiz_auto_complete_fire');
          onComplete(true);
        }, 800);
      }
    } catch (error) {
      console.error('[QuizModal] Error submitting quiz:', error);
      addBreadcrumb('quiz_submit_error', { error: String(error) });
      // FAIL-FAST on exception
      setResult({ passed: false, wrongIndexes: [] });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
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
      onComplete ? onComplete(true) : onCancel?.();
    } else {
      addBreadcrumb('quiz_complete_failed');
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
                    const showingFeedbackForThis = showFeedback && isSelected && stepFeedback;

                    return (
                      <button 
                        key={choice.id} 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!showFeedback && !isSubmitting) handleAnswer(currentQuestion.id, choice.id);
                        }}
                        disabled={showFeedback || isSubmitting}
                        style={{ pointerEvents: 'auto' }}
                        className={cn(
                          "w-full p-3 sm:p-5 rounded-xl sm:rounded-2xl text-left transition-all border-2 pointer-events-auto text-sm sm:text-base",
                          // Default state
                          !showFeedback && !isSelected && !isSubmitting && "border-border bg-muted/20 hover:border-muted-foreground hover:bg-muted/40",
                          // Selected but validating (loading)
                          !showFeedback && isSelected && isSubmitting && "border-[hsl(var(--cognitive-glow-blue))] bg-[hsl(var(--cognitive-glow-blue))]/10",
                          // Correct feedback - Blue NoParrot
                          showingFeedbackForThis && stepFeedback?.isCorrect && "border-[hsl(var(--cognitive-glow-blue))] bg-[hsl(var(--cognitive-glow-blue))]/20",
                          // Incorrect feedback - Yellow NoParrot
                          showingFeedbackForThis && stepFeedback?.isCorrect === false && "border-[hsl(var(--cognitive-incorrect))] bg-[hsl(var(--cognitive-incorrect))]/20",
                          // Other choices during feedback (dim)
                          showFeedback && !isSelected && "opacity-50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {/* Loading spinner when validating */}
                          {!showFeedback && isSelected && isSubmitting && (
                            <Loader2 className="w-4 h-4 animate-spin text-[hsl(var(--cognitive-glow-blue))]" />
                          )}
                          {/* Feedback icon */}
                          {showingFeedbackForThis && stepFeedback?.isCorrect && (
                            <CheckCircle2 className="w-5 h-5 text-[hsl(var(--cognitive-glow-blue))]" />
                          )}
                          {showingFeedbackForThis && stepFeedback?.isCorrect === false && (
                            <XCircle className="w-5 h-5 text-[hsl(var(--cognitive-incorrect))]" />
                          )}
                          <span className={cn("flex-1 leading-relaxed", showingFeedbackForThis && "font-medium")}>
                            {choice.text}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Submitting final indicator */}
                {showFeedback && isSubmitting && (
                  <div className="p-3 sm:p-5 rounded-xl sm:rounded-2xl mt-4 sm:mt-6 text-center animate-fade-in bg-muted/20 border-2 border-border">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <p className="font-medium text-sm sm:text-[15px] text-muted-foreground">
                        Sto verificando il risultato…
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex gap-3 pointer-events-auto flex-shrink-0" style={{ pointerEvents: 'auto', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
                {onCancel && (
                  <Button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      addBreadcrumb('quiz_closed', { via: 'cancel' }); 
                      onCancel(); 
                    }} 
                    variant="outline" 
                    className="flex-1 pointer-events-auto" 
                    style={{ pointerEvents: 'auto' }}
                    disabled={isSubmitting}
                  >
                    Annulla
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

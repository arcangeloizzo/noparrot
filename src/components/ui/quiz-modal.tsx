import { useState, useEffect } from "react";
import { Button } from "./button";
import { CheckCircle2, XCircle } from "lucide-react";
import { QuizQuestion } from "@/lib/ai-helpers";
import { cn } from "@/lib/utils";
import { updateCognitiveDensityWeighted } from "@/lib/cognitiveDensity";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface QuizModalProps {
  questions: QuizQuestion[];
  onSubmit: (answers: Record<string, string>) => Promise<{ passed: boolean; score?: number; total?: number; wrongIndexes: string[] }>;
  onCancel?: () => void;
  provider?: string;
  postCategory?: string;
}

export function QuizModal({ questions, onSubmit, onCancel, postCategory }: QuizModalProps) {
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

  const currentQuestion = questions[currentStep];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleAnswer = async (questionId: string, choiceId: string) => {
    if (showFeedback) return;
    
    setSelectedChoice(choiceId);
    setShowFeedback(true);
    
    const correct = currentQuestion.correctId === choiceId;
    setIsCorrect(correct);
    
    if (!correct) {
      setAnswers(prev => ({ ...prev, [questionId]: choiceId }));
      const attempts = (questionAttempts[questionId] || 0) + 1;
      setQuestionAttempts(prev => ({ ...prev, [questionId]: attempts }));
      const newTotalErrors = totalErrors + 1;
      setTotalErrors(newTotalErrors);
      
      // Mostra messaggio "riprova" solo se ha ancora tentativi GLOBALI disponibili
      setShowRetryMessage(newTotalErrors < 2 && attempts < 2);
      
      if (newTotalErrors >= 2) {
        // Non chiamare onSubmit, decidere localmente che è fallito
        setTimeout(() => {
          setResult({ passed: false, score: 0, total: questions.length, wrongIndexes: [] });
        }, 1500);
        return;
      }
      
      if (attempts >= 2) {
        setTimeout(() => {
          if (currentStep < questions.length - 1) {
            setCurrentStep(prev => prev + 1);
            resetFeedback();
          } else {
            handleFinalSubmit();
          }
        }, 1500);
      } else {
        setTimeout(() => resetFeedback(), 1500);
      }
    } else {
      setAnswers(prev => ({ ...prev, [questionId]: choiceId }));
      setShowRetryMessage(false);
      setTimeout(() => {
        if (currentStep < questions.length - 1) {
          setCurrentStep(prev => prev + 1);
          resetFeedback();
        } else {
          handleFinalSubmit();
        }
      }, 1500);
    }
  };

  const resetFeedback = () => {
    setSelectedChoice(null);
    setIsCorrect(null);
    setShowFeedback(false);
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const validationResult = await onSubmit(answers);
      setResult(validationResult);
      
      // Se passato e c'è una categoria, incrementa cognitive_density con peso COMMENT_WITH_GATE
      if (validationResult.passed && user && postCategory) {
        await updateCognitiveDensityWeighted(user.id, postCategory, 'COMMENT_WITH_GATE');
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onCancel) {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-[100]"
      onClick={handleBackdropClick}
    >
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div className="bg-background rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
          
          {result ? (
            <div className="p-8 text-center">
              {result.passed ? (
                <>
                  <div className="mb-6 flex justify-center">
                    <div className="w-20 h-20 rounded-full bg-[hsl(var(--cognitive-correct))]/20 flex items-center justify-center">
                      <CheckCircle2 className="w-12 h-12 text-[hsl(var(--cognitive-correct))]" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Hai compreso.</h2>
                  <p className="text-muted-foreground mb-6">Le tue parole ora hanno peso.</p>
                  <Button onClick={() => onCancel?.()} className="w-full font-medium">Chiudi</Button>
                </>
              ) : (
                <>
                  <div className="mb-6 flex justify-center">
                    <div className="w-20 h-20 rounded-full bg-[hsl(var(--cognitive-incorrect))]/30 flex items-center justify-center">
                      <XCircle className="w-12 h-12 text-[hsl(var(--cognitive-incorrect))]" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Non ancora.</h2>
                  <p className="text-muted-foreground mb-6">La comprensione richiede tempo, non fretta.</p>
                  <Button onClick={() => onCancel?.()} variant="outline" className="w-full font-medium">Chiudi</Button>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-bold text-center">Mettiamo a fuoco.</h2>
                <p className="text-sm text-muted-foreground text-center mt-2">Una domanda alla volta, per vedere più chiaro.</p>
                <div className="flex justify-center gap-2 mt-4">
                  {questions.map((_, idx) => (
                    <div key={idx} className={cn("w-2 h-2 rounded-full transition-all duration-200",
                      idx < currentStep ? "bg-[hsl(var(--cognitive-correct))]" : 
                      idx === currentStep ? "bg-[hsl(var(--cognitive-glow-blue))] scale-125" : "bg-muted")} />
                  ))}
                </div>
              </div>

              <div className="p-6">
                <p className="text-sm text-muted-foreground mb-2">Passo {currentStep + 1} — facciamo chiarezza su questo punto.</p>
                <h3 className="text-lg font-semibold mb-6">{currentQuestion.stem}</h3>

                <div className="space-y-3">
                  {currentQuestion.choices.map((choice) => {
                    const isSelected = selectedChoice === choice.id;
                    const isRightAndSelected = showFeedback && isSelected && choice.id === currentQuestion.correctId;
                    const isWrong = showFeedback && isSelected && choice.id !== currentQuestion.correctId;

                    return (
                      <button key={choice.id} onClick={() => !showFeedback && handleAnswer(currentQuestion.id, choice.id)}
                        disabled={showFeedback}
                        className={cn("w-full p-5 rounded-2xl text-left transition-all border-2",
                          !showFeedback && !isSelected && "border-border bg-muted/20 hover:border-muted-foreground hover:bg-muted/40",
                          !showFeedback && isSelected && "border-[hsl(var(--cognitive-glow-blue))] bg-[hsl(var(--cognitive-glow-blue))]/10",
                          isRightAndSelected && "border-[hsl(var(--cognitive-correct))] bg-[hsl(var(--cognitive-correct))]/10",
                          isWrong && "border-[hsl(var(--cognitive-incorrect))] bg-[hsl(var(--cognitive-incorrect))]/20")}>
                        <span className={cn("flex-1 leading-relaxed", (isRightAndSelected || isWrong) && "font-medium")}>{choice.text}</span>
                      </button>
                    );
                  })}
                </div>

                {showFeedback && (
                  <div className={cn("p-5 rounded-2xl mt-6 text-center animate-fade-in",
                    isCorrect ? "bg-[hsl(var(--cognitive-correct))]/10 border-2 border-[hsl(var(--cognitive-correct))]/30" : 
                    "bg-[hsl(var(--cognitive-incorrect))]/20 border-2 border-[hsl(var(--cognitive-incorrect))]/40")}>
                    <p className={cn("font-medium text-[15px]", isCorrect ? "text-[hsl(var(--cognitive-correct))]" : "text-foreground")}>
                      {isCorrect ? "Ottimo. Continuiamo." : "Questa parte non è ancora limpida. Riguardiamola insieme."}
                    </p>
                    {!isCorrect && showRetryMessage && (
                      <p className="text-sm mt-2 opacity-80">Hai ancora 1 tentativo disponibile.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 pb-6 flex gap-3">
                {onCancel && <Button onClick={onCancel} variant="outline" className="flex-1">Annulla</Button>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

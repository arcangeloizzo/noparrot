import { useState } from "react";
import { Button } from "./button";
import { Badge } from "./badge";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { QuizQuestion } from "@/lib/ai-helpers";

interface QuizModalProps {
  questions: QuizQuestion[];
  onSubmit: (answers: Record<string, string>) => Promise<{ passed: boolean; wrongIndexes: string[] }>;
  onCancel?: () => void;
  provider?: string;
}

export function QuizModal({ questions, onSubmit, onCancel, provider = 'gemini' }: QuizModalProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; wrongIndexes: string[] } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleAnswer = async (questionId: string, choiceId: string) => {
    if (showFeedback) return;
    
    setSelectedChoice(choiceId);
    setShowFeedback(true);
    
    const currentQuestion = questions[currentStep];
    const correct = currentQuestion.correctId === choiceId;
    setIsCorrect(correct);
    
    setAnswers(prev => ({ ...prev, [questionId]: choiceId }));
    
    if (correct) {
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
    } catch (error) {
      console.error('Error submitting quiz:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const allAnswered = Object.keys(answers).length === questions.length;

  if (result) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
          <div className="text-center">
            {result.passed ? (
              <>
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Test Superato! 🎉</h3>
                <p className="text-muted-foreground">
                  Hai dimostrato di aver compreso il contenuto. Ora puoi condividere!
                </p>
              </>
            ) : (
              <>
                <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Non Superato</h3>
                <p className="text-muted-foreground">
                  Servono almeno 2 risposte corrette su 3. Riprova dopo aver riletto il contenuto.
                </p>
              </>
            )}
          </div>
          <Button onClick={onCancel} className="w-full">
            Chiudi
          </Button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentStep];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg shadow-lg max-w-2xl w-full p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Test di Comprensione</h3>
            <p className="text-sm text-muted-foreground">
              Domanda {currentStep + 1} di {questions.length}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {provider === 'gemini' ? '🤖 Gemini' : '🧠 GPT'}
          </Badge>
        </div>

        {/* Progress */}
        <div className="flex gap-1">
          {questions.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full ${
                idx === currentStep ? 'bg-primary' :
                idx < currentStep ? 'bg-primary/50' :
                'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Question */}
        <div className="space-y-4">
          <p className="text-base font-medium">{currentQuestion.stem}</p>
          
          <div className="space-y-2">
            {currentQuestion.choices.map((choice) => {
              const isSelected = selectedChoice === choice.id;
              const isThisCorrect = currentQuestion.correctId === choice.id;
              
              let buttonClasses = 'w-full text-left p-4 rounded-lg border-2 transition-all relative';
              
              if (showFeedback && isSelected) {
                if (isCorrect) {
                  buttonClasses += ' border-green-500 bg-green-500/20';
                } else {
                  buttonClasses += ' border-red-500 bg-red-500/20';
                }
              } else if (showFeedback && !isCorrect && isThisCorrect) {
                buttonClasses += ' border-green-500 bg-green-500/10';
              } else if (answers[currentQuestion.id] === choice.id) {
                buttonClasses += ' border-primary bg-primary/10';
              } else {
                buttonClasses += ' border-border hover:border-primary/50 hover:bg-muted/50';
              }
              
              return (
                <button
                  key={choice.id}
                  onClick={() => handleAnswer(currentQuestion.id, choice.id)}
                  disabled={showFeedback}
                  className={buttonClasses}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium mr-2">{choice.id.toUpperCase()}.</span>
                      {choice.text}
                    </div>
                    
                    {showFeedback && isSelected && (
                      <span className="text-lg ml-2">
                        {isCorrect ? '✅' : '❌'}
                      </span>
                    )}
                    {showFeedback && !isCorrect && isThisCorrect && (
                      <span className="text-sm text-green-600 font-medium ml-2">✓ Corretta</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Feedback Message */}
          {showFeedback && (
            <div className={`p-3 rounded-lg ${isCorrect ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <p className={`text-sm font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                {isCorrect 
                  ? '🎉 Risposta corretta! Passaggio alla prossima domanda...'
                  : '❌ Risposta errata. Rivedi il contenuto e continua.'}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {onCancel && (
            <Button onClick={onCancel} variant="outline" className="flex-1">
              Annulla
            </Button>
          )}
          
          {showFeedback && !isCorrect && currentStep < questions.length - 1 && (
            <Button
              onClick={() => {
                setCurrentStep(prev => prev + 1);
                resetFeedback();
              }}
              className="flex-1"
            >
              Continua
            </Button>
          )}
          
          {showFeedback && !isCorrect && currentStep === questions.length - 1 && (
            <Button
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifica...
                </>
              ) : (
                'Termina Test'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

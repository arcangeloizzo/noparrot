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

  const handleAnswer = (questionId: string, choiceId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: choiceId }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length !== questions.length) return;
    
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
            {currentQuestion.choices.map((choice) => (
              <button
                key={choice.id}
                onClick={() => handleAnswer(currentQuestion.id, choice.id)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                  answers[currentQuestion.id] === choice.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <span className="font-medium mr-2">{choice.id.toUpperCase()}.</span>
                {choice.text}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {onCancel && (
            <Button onClick={onCancel} variant="outline" className="flex-1">
              Annulla
            </Button>
          )}
          
          {currentStep < questions.length - 1 ? (
            <Button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!answers[currentQuestion.id]}
              className="flex-1"
            >
              Avanti
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!allAnswered || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifica...
                </>
              ) : (
                'Invia Risposte'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

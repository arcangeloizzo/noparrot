// ComprehensionTest - Quiz component for feed posts
// ==================================================
// ✅ SECURITY HARDENED: No client-side correct answers
// ✅ Validation happens server-side only via submit-qa

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, Share, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MockPost } from "@/data/mockData";
import { validateAnswers, type QuizQuestion } from "@/lib/ai-helpers";

interface ComprehensionTestProps {
  post: MockPost;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  questions?: QuizQuestion[];
  sourceUrl?: string;
  qaId?: string;
}

export const ComprehensionTest = ({ 
  post, 
  isOpen, 
  onClose, 
  onComplete,
  questions: providedQuestions,
  sourceUrl,
  qaId
}: ComprehensionTestProps) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [wrongQuestions, setWrongQuestions] = useState<Set<string>>(new Set());
  const [showResult, setShowResult] = useState<'correct' | 'wrong' | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // HARDENED: Questions MUST come from server-side generate-qa
  // No fallback mock - if questions are missing, the component should not render
  if (!providedQuestions || providedQuestions.length === 0) {
    console.error('[ComprehensionTest] SECURITY: No questions provided. Cannot render without server-side questions.');
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-2xl p-6 text-center border border-gray-700 max-w-sm">
          <p className="text-red-400 mb-4">Errore: domande non disponibili</p>
          <Button onClick={onClose} variant="outline">Chiudi</Button>
        </div>
      </div>
    );
  }

  const questions: QuizQuestion[] = providedQuestions;

  // SECURITY HARDENED: NO feedback until server validation
  // Fixes "every answer appears correct" bug
  const handleAnswer = async (choiceId: string) => {
    if (isSubmitting) return;
    
    const question = questions[currentQuestion];
    const newAnswers = { ...answers, [question.id]: choiceId };
    setAnswers(newAnswers);
    
    // If this is the last question, submit all answers for validation
    if (currentQuestion === questions.length - 1) {
      setIsSubmitting(true);
      
      try {
        const result = await validateAnswers({
          qaId: qaId,
          postId: post.id,
          sourceUrl: sourceUrl || (post as any).shared_url,
          answers: newAnswers,
          gateType: 'share'
        });
        
        // SECURITY: Only show feedback AFTER server responds
        if (result.passed) {
          setShowResult('correct');
          setTimeout(() => {
            setShowResult(null);
            setIsComplete(true);
          }, 1500);
        } else {
          // Mark wrong questions based on server response
          setWrongQuestions(new Set(result.wrongIndexes));
          setShowResult('wrong');
          
          setTimeout(() => {
            setShowResult(null);
            // Reset to first wrong question for retry
            const firstWrongIndex = questions.findIndex(q => result.wrongIndexes.includes(q.id));
            if (firstWrongIndex >= 0) {
              setCurrentQuestion(firstWrongIndex);
              // Clear answers for wrong questions
              const clearedAnswers = { ...newAnswers };
              result.wrongIndexes.forEach(id => delete clearedAnswers[id]);
              setAnswers(clearedAnswers);
            }
          }, 1500);
        }
      } catch (error) {
        console.error('[ComprehensionTest] Validation error:', error);
        // SECURITY: On error, show failure - never assume correct
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

  const reset = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setWrongQuestions(new Set());
    setShowResult(null);
    setIsComplete(false);
  };

  if (isComplete) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-2xl w-[90vw] max-h-[84vh] p-6 text-center border border-gray-700">
          <div className="mb-6">
            <div className="w-16 h-16 bg-[hsl(var(--cognitive-correct))]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-[hsl(var(--cognitive-correct))]" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">Possiamo procedere.</h2>
            <p className="text-gray-300">
              Hai messo a fuoco. Le tue parole ora hanno peso.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={onComplete} 
              className="flex items-center gap-2 bg-primary hover:bg-primary/90"
            >
              <Share className="h-4 w-4" />
              Condividi
            </Button>
            
            <Button 
              onClick={onComplete} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Invia
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];
  const isQuestionWrong = wrongQuestions.has(question.id);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl w-[90vw] h-[84vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="font-semibold text-white">
            Mettiamo a fuoco. — Passo {currentQuestion + 1} di {questions.length}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Question */}
        <div className="p-4 flex-1 overflow-y-auto">
          <div className={cn(
            "mb-6 p-4 rounded-lg border-2 transition-all duration-300",
            showResult === 'correct' && "bg-[hsl(var(--cognitive-correct))]/10 border-[hsl(var(--cognitive-correct))] animate-mint-flash",
            showResult === 'wrong' && "bg-[hsl(var(--cognitive-incorrect))]/20 border-[hsl(var(--cognitive-incorrect))] animate-shake",
            !showResult && "bg-gray-800 border-gray-700"
          )}>
            <h3 className="font-medium mb-4 flex items-center text-white">
              {question.stem}
              {showResult === 'correct' && (
                <Check className="w-5 h-5 text-[hsl(var(--cognitive-correct))] ml-2 animate-bounce-check" />
              )}
            </h3>
            
            <div className="space-y-2">
              {question.choices.map((choice) => (
                <Button
                  key={choice.id}
                  variant="outline"
                  onClick={() => handleAnswer(choice.id)}
                  disabled={showResult !== null || isSubmitting}
                  className="w-full justify-start bg-gray-800 hover:bg-gray-700 text-white border-gray-600 hover:border-gray-500"
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
            <p className="text-sm text-[hsl(var(--cognitive-incorrect))] mb-4">
              Non è questa la prospettiva giusta. Riprova.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

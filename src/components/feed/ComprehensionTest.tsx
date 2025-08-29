import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { MockPost } from "@/data/mockData";

interface ComprehensionTestProps {
  post: MockPost;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const ComprehensionTest = ({ post, isOpen, onClose, onComplete }: ComprehensionTestProps) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null]);
  const [attempts, setAttempts] = useState<number[]>([0, 0, 0]);
  const [showResult, setShowResult] = useState<'correct' | 'wrong' | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  if (!isOpen) return null;

  const questions = post.questions || [
    {
      question: "Qual è il tema principale dell'articolo?",
      options: ["Tecnologia", "Politica", "Economia"],
      correct: 0
    },
    {
      question: "Secondo l'articolo, quale tendenza è evidenziata?",
      options: ["Crescita", "Declino", "Stabilità"],
      correct: 1
    },
    {
      question: "Quale dato specifico viene citato nel testo?",
      options: ["50%", "25%", "75%"],
      correct: 2
    }
  ];

  const handleAnswer = (optionIndex: number) => {
    const question = questions[currentQuestion];
    const isCorrect = optionIndex === question.correct;
    
    if (isCorrect) {
      setAnswers(prev => {
        const newAnswers = [...prev];
        newAnswers[currentQuestion] = optionIndex;
        return newAnswers;
      });
      setShowResult('correct');
      
      setTimeout(() => {
        setShowResult(null);
        if (currentQuestion < questions.length - 1) {
          setCurrentQuestion(prev => prev + 1);
        } else {
          setIsComplete(true);
        }
      }, 1500);
    } else {
      const newAttempts = [...attempts];
      newAttempts[currentQuestion]++;
      setAttempts(newAttempts);
      
      if (newAttempts[currentQuestion] >= 2) {
        // Max attempts reached, force correct answer
        setAnswers(prev => {
          const newAnswers = [...prev];
          newAnswers[currentQuestion] = question.correct;
          return newAnswers;
        });
        setShowResult('correct');
        
        setTimeout(() => {
          setShowResult(null);
          if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(prev => prev + 1);
          } else {
            setIsComplete(true);
          }
        }, 1500);
      } else {
        setShowResult('wrong');
        setTimeout(() => setShowResult(null), 800);
      }
    }
  };

  const reset = () => {
    setCurrentQuestion(0);
    setAnswers([null, null, null]);
    setAttempts([0, 0, 0]);
    setShowResult(null);
    setIsComplete(false);
  };

  if (isComplete) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="bg-surface-elevated rounded-3xl w-[90vw] max-h-[84vh] p-6 text-center border border-border">
          <div className="mb-6">
            <div className="w-16 h-16 bg-semantic-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-semantic-success" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-text-primary">Test Superato!</h2>
            <p className="text-text-secondary">
              Hai dimostrato di aver compreso l'articolo.
            </p>
          </div>
          
          <div className="space-y-3">
            <Button onClick={onComplete} className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white">
              Condividi
            </Button>
            <Button onClick={onComplete} className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white">
              Confuta
            </Button>
            <Button onClick={onComplete} className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white">
              Invia ad un amico
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="bg-surface-elevated rounded-3xl w-[90vw] h-[84vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">
            Test di Comprensione ({currentQuestion + 1}/{questions.length})
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-text-secondary hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Question */}
        <div className="p-4 flex-1 overflow-y-auto">
          <div className={cn(
            "mb-6 p-4 rounded-lg border-2 transition-all duration-300",
            showResult === 'correct' && "bg-semantic-success/10 border-semantic-success animate-mint-flash",
            showResult === 'wrong' && "bg-semantic-error/10 border-semantic-error animate-shake"
          )}>
            <h3 className="font-medium mb-4 flex items-center text-text-primary">
              {question.question}
              {showResult === 'correct' && (
                <Check className="w-5 h-5 text-semantic-success ml-2 animate-bounce-check" />
              )}
            </h3>
            
            <div className="space-y-2">
              {question.options.map((option, index) => (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => handleAnswer(index)}
                  disabled={showResult !== null}
                  className="w-full justify-start bg-surface-primary hover:bg-surface-secondary text-text-primary border-border"
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>

          {attempts[currentQuestion] > 0 && showResult !== 'correct' && (
            <p className="text-sm text-semantic-error mb-4">
              Tentativo {attempts[currentQuestion]}/2. 
              {attempts[currentQuestion] === 1 && " Riprova."}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};
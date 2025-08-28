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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="bg-white rounded-lg max-w-sm w-full p-6 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Test Superato!</h2>
            <p className="text-muted-foreground">
              Hai dimostrato di aver compreso l'articolo.
            </p>
          </div>
          
          <div className="space-y-3">
            <Button onClick={onComplete} className="w-full">
              Condividi
            </Button>
            <Button variant="outline" onClick={onComplete} className="w-full">
              Confuta
            </Button>
            <Button variant="ghost" onClick={onComplete} className="w-full">
              Invia ad un amico
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white rounded-lg max-w-sm w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">
            Test di Comprensione ({currentQuestion + 1}/{questions.length})
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Question */}
        <div className="p-4">
          <div className={cn(
            "mb-6 p-4 rounded-lg border-2 transition-all duration-300",
            showResult === 'correct' && "bg-green-50 border-green-200 animate-mint-flash",
            showResult === 'wrong' && "bg-red-50 border-red-200 animate-shake"
          )}>
            <h3 className="font-medium mb-4 flex items-center">
              {question.question}
              {showResult === 'correct' && (
                <Check className="w-5 h-5 text-green-600 ml-2 animate-bounce-check" />
              )}
            </h3>
            
            <div className="space-y-2">
              {question.options.map((option, index) => (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => handleAnswer(index)}
                  disabled={showResult !== null}
                  className="w-full justify-start"
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>

          {attempts[currentQuestion] > 0 && showResult !== 'correct' && (
            <p className="text-sm text-red-600 mb-4">
              Tentativo {attempts[currentQuestion]}/2. 
              {attempts[currentQuestion] === 1 && " Riprova."}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};
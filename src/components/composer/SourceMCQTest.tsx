// SourceMCQTest - Multiple choice test for source comprehension
// ==============================================================
// ✅ Shows 3 questions (2 macro + 1 detail) for source
// ✅ Max 2 attempts per question with shake/bounce animations
// ✅ Deterministic questions based on source URL/domain

import React, { useState, useEffect } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SourceWithGate, generateSourceQuiz } from '@/lib/comprehension-gate-extended';

interface SourceMCQTestProps {
  source: SourceWithGate;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (passed: boolean) => void;
}

interface Question {
  id: string;
  stem: string;
  choices: { id: string; text: string }[];
  correctId: string;
  type: 'macro' | 'detail';
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
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Generate deterministic questions based on source
      const generatedQuestions = generateQuestionsForSource(source);
      setQuestions(generatedQuestions);
      
      // Reset state
      setCurrentQuestion(0);
      setAnswers({});
      setAttempts({});
      setShowResult(null);
      setIsComplete(false);
    }
  }, [isOpen, source]);

  const generateQuestionsForSource = (source: SourceWithGate): Question[] => {
    // Hash-based deterministic generation
    const hash = source.url.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);

    const domain = getDomainType(source.url);
    const baseTitle = source.title || source.url;

    return [
      {
        id: 'q1',
        type: 'macro',
        stem: getQuestionStem(domain, 'macro1', baseTitle),
        choices: [
          { id: 'a', text: 'Il concetto principale espresso nel contenuto' },
          { id: 'b', text: 'Un argomento secondario non centrale' },
          { id: 'c', text: 'Un tema non trattato nella fonte' },
        ],
        correctId: 'a'
      },
      {
        id: 'q2', 
        type: 'macro',
        stem: getQuestionStem(domain, 'macro2', baseTitle),
        choices: [
          { id: 'a', text: 'Una congettura senza evidenze' },
          { id: 'b', text: 'Il supporto o evidenza presentata' },
          { id: 'c', text: 'Un\'opinione non presente nel testo' },
        ],
        correctId: 'b'
      },
      {
        id: 'q3',
        type: 'detail', 
        stem: getQuestionStem(domain, 'detail', baseTitle),
        choices: [
          { id: 'a', text: 'Un dettaglio inventato' },
          { id: 'b', text: 'Un elemento non menzionato' },
          { id: 'c', text: 'Il dettaglio specifico citato' },
        ],
        correctId: 'c'
      }
    ];
  };

  const getDomainType = (url: string): string => {
    try {
      const domain = new URL(url).hostname.toLowerCase();
      if (domain.includes('news') || domain.includes('bbc') || domain.includes('cnn')) return 'news';
      if (domain.includes('edu') || domain.includes('arxiv') || domain.includes('pubmed')) return 'academic';
      if (domain.includes('twitter') || domain.includes('facebook') || domain.includes('instagram')) return 'social';
      return 'general';
    } catch {
      return 'general';
    }
  };

  const getQuestionStem = (domain: string, type: string, title: string): string => {
    const templates = {
      news: {
        macro1: 'Qual è la notizia principale riportata?',
        macro2: 'Quale evidenza o fonte viene citata?',
        detail: 'Quale dato specifico viene menzionato?'
      },
      academic: {
        macro1: 'Qual è la tesi principale dell\'articolo?',
        macro2: 'Quale metodologia supporta la conclusione?',
        detail: 'Quale studio o ricerca viene citata?'
      },
      social: {
        macro1: 'Qual è il messaggio principale del post?',
        macro2: 'Quale reazione viene stimolata?',
        detail: 'Quale hashtag o riferimento specifico è presente?'
      },
      general: {
        macro1: 'Qual è il tema principale del contenuto?',
        macro2: 'Quale punto di vista viene espresso?', 
        detail: 'Quale informazione specifica viene fornita?'
      }
    };

    return templates[domain as keyof typeof templates]?.[type as keyof (typeof templates)['general']] ||
           templates.general[type as keyof (typeof templates)['general']];
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

  if (!isOpen || questions.length === 0) return null;

  if (isComplete) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-background rounded-2xl w-[90vw] max-w-md p-6 text-center border border-border">
          <div className="mb-6">
            <div className="w-16 h-16 bg-trust-high/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-trust-high animate-bounce-check" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-foreground">
              Test Superato!
            </h2>
            <p className="text-muted-foreground">
              Hai dimostrato di aver compreso la fonte.
            </p>
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={() => onComplete(true)} 
              className="w-full bg-trust-high hover:bg-trust-high/90 text-trust-high-text"
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

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-background rounded-2xl w-[90vw] h-[84vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-foreground">
              Test di Comprensione
            </h2>
            <span className="text-sm text-muted-foreground">
              ({currentQuestion + 1}/{questions.length})
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
            showResult === 'correct' && "bg-trust-high/10 border-trust-high animate-mint-flash",
            showResult === 'wrong' && "bg-trust-low/10 border-trust-low animate-shake",
            !showResult && "bg-card border-border"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2 py-1 rounded text-xs font-medium",
                  question.type === 'macro' ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"
                )}>
                  {question.type === 'macro' ? 'Comprensione' : 'Dettaglio'}
                </span>
                {showResult === 'correct' && (
                  <Check className="w-5 h-5 text-trust-high animate-bounce-check" />
                )}
              </div>
              {questionAttempts > 0 && (
                <span className="text-xs text-trust-low">
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
            <div className="p-3 bg-trust-low/10 border border-trust-low/20 rounded-lg">
              <p className="text-sm text-trust-low">
                {questionAttempts === 1 
                  ? "Risposta errata. Hai un altro tentativo." 
                  : "Ultimo tentativo disponibile."}
              </p>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Domanda {currentQuestion + 1} di {questions.length}
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
import React, { useEffect, useState, useRef } from "react";
import { useComprehensionGate } from "@/lib/comprehension-gate";
import { Button, ButtonProps } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Clock, ScrollText, CheckCircle } from "lucide-react";

interface GateButtonProps extends Omit<ButtonProps, 'onClick' | 'content'> {
  content: {
    id: string;
    title?: string;
    text?: string;
    url?: string;
  };
  onPassed: (result: any) => void;
  containerRef?: React.RefObject<HTMLElement>;
  showProgress?: boolean;
  children: React.ReactNode;
}

export function GateButton({ 
  content, 
  onPassed, 
  containerRef, 
  showProgress = true,
  children, 
  className,
  disabled,
  ...props 
}: GateButtonProps) {
  const { policy, startTracking, getProgress, openQuiz } = useComprehensionGate();
  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState({ seconds: 0, scrollRatio: 0 });
  const [ready, setReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const intervalRef = useRef<number>();

  // Start tracking when component mounts
  useEffect(() => {
    if (!started) {
      startTracking({ container: containerRef?.current ?? null });
      setStarted(true);
    }

    // Update progress periodically
    intervalRef.current = window.setInterval(() => {
      const currentProgress = getProgress();
      setProgress(currentProgress);
      
      const isReady = 
        currentProgress.seconds >= policy.minReadSeconds && 
        currentProgress.scrollRatio >= policy.minScrollRatio;
      setReady(isReady);
    }, 300);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [started, startTracking, getProgress, policy, containerRef]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (disabled || isProcessing) return;

    // Check if requirements are met
    if (!ready) {
      const timeLeft = Math.max(0, policy.minReadSeconds - progress.seconds);
      const scrollLeft = Math.max(0, (policy.minScrollRatio * 100) - (progress.scrollRatio * 100));
      
      toast({
        title: "Completa la lettura",
        description: `Tempo rimanente: ${timeLeft}s, Scroll: ${Math.round(scrollLeft)}%`,
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessing(true);
      
      // Open comprehension quiz
      const result = await openQuiz(content);
      
      if (!result.passed) {
        toast({
          title: "Quiz non superato",
          description: "Riprova con attenzione alle domande",
          variant: "destructive"
        });
        return;
      }

      // Success - call onPassed callback
      toast({
        title: "Comprehension Gate superato!",
        description: "Ora puoi procedere con l'azione",
        variant: "default"
      });
      
      onPassed(result);
      
    } catch (error) {
      console.error("Gate error:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il test",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const timeProgress = Math.min(100, (progress.seconds / policy.minReadSeconds) * 100);
  const scrollProgress = progress.scrollRatio * 100;

  return (
    <div className="space-y-3">
      {/* Progress Indicators */}
      {showProgress && (
        <Card className="p-4 glass-panel border-glass">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso lettura</span>
              <span className={cn(
                "font-medium transition-colors",
                ready ? "text-success" : "text-foreground"
              )}>
                {ready ? "Completato" : "In corso"}
              </span>
            </div>
            
            {/* Time Progress */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>
                  Tempo: {progress.seconds}s / {policy.minReadSeconds}s
                </span>
              </div>
              <Progress 
                value={timeProgress} 
                className="h-2"
              />
            </div>
            
            {/* Scroll Progress */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ScrollText className="w-3 h-3" />
                <span>
                  Scroll: {Math.round(scrollProgress)}% / {Math.round(policy.minScrollRatio * 100)}%
                </span>
              </div>
              <Progress 
                value={scrollProgress} 
                className="h-2"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Gate Button */}
      <Button
        onClick={handleClick}
        disabled={disabled || isProcessing}
        className={cn(
          "w-full hover-lift transition-all duration-200",
          ready && "ring-2 ring-success/50",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          {ready ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin" />
          )}
          {isProcessing ? "Elaborazione..." : children}
        </div>
      </Button>
    </div>
  );
}

export type { GateButtonProps };
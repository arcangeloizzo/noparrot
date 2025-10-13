// SourceReaderGate - Reading view with countdown and scroll tracking
// ==================================================================
// ✅ Displays source content with 10s countdown or scroll to bottom
// ✅ Unlocks test when reading requirements are met
// ✅ Shows progress bar and reading status

import React, { useState, useEffect, useRef } from 'react';
import { X, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SourceWithGate } from '@/lib/comprehension-gate-extended';

interface SourceReaderGateProps {
  source: SourceWithGate;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const SourceReaderGate: React.FC<SourceReaderGateProps> = ({
  source,
  isOpen,
  onClose,
  onComplete
}) => {
  const [timeLeft, setTimeLeft] = useState(10);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canProceed, setCanProceed] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(10);
      setScrollProgress(0);
      setCanProceed(false);
      setHasScrolledToBottom(false);
      return;
    }

    // Timer countdown
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setCanProceed(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const progress = Math.min(100, (scrollTop / (scrollHeight - clientHeight)) * 100);
    setScrollProgress(progress);
    
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
      setCanProceed(true);
    }
  };

  const openSource = () => {
    window.open(source.url, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  const isReady = canProceed || hasScrolledToBottom;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-background rounded-2xl w-[90vw] h-[84vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-lg text-foreground">
              Lettura Fonte
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={openSource}
              className="text-xs"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Apri Originale
            </Button>
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

        {/* Progress Bar */}
        <div className="p-4 bg-muted/50 border-b border-border">
          <div className="flex items-center justify-between text-sm mb-2">
            <div className="flex items-center gap-2">
              {isReady ? (
                <>
                  <Check className="h-4 w-4 text-trust-high" />
                  <span className="text-trust-high font-medium">Lettura Completata</span>
                </>
              ) : (
                <>
                  <span className="text-foreground">
                    Tempo: {timeLeft}s
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-foreground">
                    Scroll: {Math.round(scrollProgress)}%
                  </span>
                </>
              )}
            </div>
            {!isReady && (
              <span className="text-muted-foreground text-xs">
                Leggi per 10s o scorri tutto
              </span>
            )}
          </div>
          
          {/* Progress bars */}
          <div className="space-y-2">
            {/* Time progress */}
            <div className="w-full bg-muted rounded-full h-1.5">
              <div 
                className={cn(
                  "h-1.5 rounded-full transition-all duration-1000",
                  timeLeft === 0 ? "bg-trust-high" : "bg-primary"
                )}
                style={{ width: `${((10 - timeLeft) / 10) * 100}%` }}
              />
            </div>
            
            {/* Scroll progress */}
            <div className="w-full bg-muted rounded-full h-1.5">
              <div 
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  hasScrolledToBottom ? "bg-trust-high" : "bg-accent"
                )}
                style={{ width: `${scrollProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Source Info */}
        <div className="p-4 border-b border-border bg-card">
          <h3 className="font-semibold text-foreground mb-1">
            {source.title || 'Fonte'}
          </h3>
          <p className="text-sm text-muted-foreground break-all">
            {source.url}
          </p>
        </div>

        {/* Content Area */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 p-4 overflow-y-auto"
          onScroll={handleScroll}
        >
          <div className="space-y-4 text-sm leading-relaxed">
            {source.content || source.summary || source.excerpt ? (
              <>
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-foreground">
                    {source.content || source.summary || source.excerpt}
                  </div>
                </div>
                
                {/* Padding per scroll */}
                <div className="h-32"></div>
              </>
            ) : (
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <p className="text-accent text-xs uppercase tracking-wide mb-2">
                  Anteprima Non Disponibile
                </p>
                <p className="text-foreground mb-3">
                  Impossibile estrarre il contenuto da questa fonte. 
                  Usa il pulsante "Apri Originale" per leggere l'articolo completo.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openSource}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Apri Articolo Originale
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4 border-t border-border">
          <Button
            onClick={onComplete}
            disabled={!isReady}
            className={cn(
              "w-full transition-all duration-300",
              isReady 
                ? "bg-primary hover:bg-primary/90 text-primary-foreground" 
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isReady ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Procedi al Test
              </>
            ) : (
              `Attendi ${timeLeft}s o scorri fino alla fine`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
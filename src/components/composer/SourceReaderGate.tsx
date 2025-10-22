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
  const [twitterScriptLoaded, setTwitterScriptLoaded] = useState(false);
  const [isRenderingTwitter, setIsRenderingTwitter] = useState(false);

  // Load and render Twitter widgets
  useEffect(() => {
    if (!source.embedHtml || !isOpen) return;

    const win = window as any;
    setIsRenderingTwitter(true);

    const renderWidgets = () => {
      if (win.twttr?.widgets) {
        win.twttr.widgets.load()
          .then(() => {
            setIsRenderingTwitter(false);
            setTwitterScriptLoaded(true);
          })
          .catch(() => {
            setIsRenderingTwitter(false);
          });
      }
    };

    // If script is already loaded
    if (win.twttr) {
      renderWidgets();
      return;
    }

    // Load script
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    script.onload = () => {
      setTwitterScriptLoaded(true);
      renderWidgets();
    };
    script.onerror = () => {
      setIsRenderingTwitter(false);
      console.error('Failed to load Twitter widgets script');
    };
    
    document.body.appendChild(script);
  }, [source.embedHtml, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(10);
      setScrollProgress(0);
      setCanProceed(false);
      setHasScrolledToBottom(false);
      return;
    }

    // Block body scroll when modal is open
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    
    // Get scrollbar width to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

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

    return () => {
      clearInterval(timer);
      // Restore body scroll on unmount
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleBackdropTouch = (e: React.TouchEvent) => {
    if (e.target === e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]"
      onClick={handleBackdropClick}
      onTouchMove={handleBackdropTouch}
    >
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
            {source.embedHtml ? (
              <>
                {/* Twitter/X Embed */}
                <div className="max-w-2xl mx-auto">
                  {isRenderingTwitter && (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-pulse space-y-3 w-full">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-4 bg-muted rounded w-1/2"></div>
                        <div className="h-32 bg-muted rounded"></div>
                      </div>
                    </div>
                  )}
                  <div 
                    dangerouslySetInnerHTML={{ __html: source.embedHtml }}
                    className={cn(
                      "twitter-embed-container",
                      isRenderingTwitter && "hidden"
                    )}
                    style={{ minHeight: '200px' }}
                  />
                </div>
                
                {/* Padding per scroll */}
                <div className="h-32"></div>
              </>
            ) : source.type === 'video' && source.embedUrl ? (
              <>
                {/* Video Player */}
                <div className="mb-4">
                  <div className="aspect-video w-full bg-muted rounded-lg overflow-hidden">
                    <iframe
                      src={source.embedUrl}
                      title={source.title || 'Video'}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
                
                {/* Video metadata */}
                {source.platform && (
                  <div className="bg-muted/50 p-3 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Video {source.platform === 'youtube' ? 'YouTube' : 
                             source.platform === 'vimeo' ? 'Vimeo' : ''}
                    </p>
                    {source.duration && (
                      <p className="text-xs text-muted-foreground">
                        Durata: {Math.floor(parseInt(source.duration) / 60)}:{String(parseInt(source.duration) % 60).padStart(2, '0')}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Video description */}
                {(source.summary || source.content || source.excerpt) && (
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-foreground">
                      {source.summary || source.content || source.excerpt}
                    </div>
                  </div>
                )}
                
                {/* Padding per scroll */}
                <div className="h-32"></div>
              </>
            ) : source.content || source.summary || source.excerpt ? (
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
              <div className="max-w-2xl mx-auto text-center py-12">
                <div className="bg-muted/50 rounded-lg p-8 space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      Contenuto non visualizzabile nell'app
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Questo sito blocca la visualizzazione incorporata per motivi di sicurezza.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <Button
                      onClick={openSource}
                      className="inline-flex items-center gap-2"
                      size="lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Leggi su {source.hostname || new URL(source.url).hostname}
                    </Button>
                    
                    <p className="text-xs text-muted-foreground">
                      Torna qui dopo aver letto per completare il test
                    </p>
                  </div>

                  {timeLeft > 0 && (
                    <div className="pt-4 text-sm text-muted-foreground">
                      Tempo minimo di lettura: {timeLeft}s
                    </div>
                  )}
                </div>
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
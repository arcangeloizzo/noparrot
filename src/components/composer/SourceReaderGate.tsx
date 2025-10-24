// SourceReaderGate - Reading view with countdown and scroll tracking
// ==================================================================
// ✅ Displays source content with 10s countdown or scroll to bottom
// ✅ Unlocks test when reading requirements are met
// ✅ Shows progress bar and reading status

import React, { useState, useEffect, useRef } from 'react';
import { X, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TypingIndicator } from '@/components/ui/typing-indicator';
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
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);

  // Load and render Twitter widgets with MutationObserver
  useEffect(() => {
    if (!source.embedHtml || !isOpen) return;

    console.log('[SourceReaderGate] Loading Twitter embed for:', source.url);
    const win = window as any;
    setIsRenderingTwitter(true);
    let renderTimeout: number;
    let observer: MutationObserver;

    const renderWidgets = () => {
      console.log('[SourceReaderGate] Attempting to render Twitter widgets...');
      
      // Wait for embed HTML to be in DOM
      const embedContainer = document.querySelector('.twitter-embed-container');
      if (!embedContainer) {
        console.warn('[SourceReaderGate] Embed container not found in DOM');
        setIsRenderingTwitter(false);
        return;
      }

      const blockquote = embedContainer.querySelector('blockquote.twitter-tweet');
      if (!blockquote) {
        console.warn('[SourceReaderGate] Blockquote not found in embed container');
        setIsRenderingTwitter(false);
        return;
      }

      console.log('[SourceReaderGate] Embed HTML found in DOM, calling twttr.widgets.load()');
      
      if (win.twttr?.widgets) {
        win.twttr.widgets.load(embedContainer)
          .then(() => {
            console.log('[SourceReaderGate] Twitter widgets rendered successfully');
            setIsRenderingTwitter(false);
            setTwitterScriptLoaded(true);
            if (renderTimeout) clearTimeout(renderTimeout);
          })
          .catch((err: any) => {
            console.error('[SourceReaderGate] Twitter widgets render error:', err);
            setIsRenderingTwitter(false);
          });
      } else {
        console.warn('[SourceReaderGate] twttr.widgets not available');
        setIsRenderingTwitter(false);
      }
    };

    const initTwitterWidget = () => {
      // Set timeout fallback (5s)
      renderTimeout = window.setTimeout(() => {
        console.warn('[SourceReaderGate] Twitter render timeout, showing fallback');
        setIsRenderingTwitter(false);
      }, 5000);

      // Use MutationObserver to detect when embed HTML is in DOM
      const embedContainer = document.querySelector('.twitter-embed-container');
      if (embedContainer) {
        observer = new MutationObserver((mutations) => {
          const blockquote = embedContainer.querySelector('blockquote.twitter-tweet');
          if (blockquote) {
            console.log('[SourceReaderGate] Blockquote detected in DOM via MutationObserver');
            observer.disconnect();
            // Small delay to ensure DOM is fully ready
            setTimeout(renderWidgets, 100);
          }
        });

        observer.observe(embedContainer, { 
          childList: true, 
          subtree: true 
        });

        // Also try immediately in case already in DOM
        const blockquote = embedContainer.querySelector('blockquote.twitter-tweet');
        if (blockquote) {
          console.log('[SourceReaderGate] Blockquote already in DOM');
          setTimeout(renderWidgets, 100);
        }
      }
    };

    // Check if script already loaded
    if (win.twttr) {
      console.log('[SourceReaderGate] Twitter script already loaded');
      initTwitterWidget();
      return () => {
        if (renderTimeout) clearTimeout(renderTimeout);
        if (observer) observer.disconnect();
      };
    }

    // Load script
    console.log('[SourceReaderGate] Loading Twitter script...');
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    script.onload = () => {
      console.log('[SourceReaderGate] Twitter script loaded');
      setTwitterScriptLoaded(true);
      // Give time for twttr object to initialize
      setTimeout(initTwitterWidget, 200);
    };
    script.onerror = (err) => {
      console.error('[SourceReaderGate] Failed to load Twitter widgets script:', err);
      setIsRenderingTwitter(false);
    };
    
    document.body.appendChild(script);

    return () => {
      if (renderTimeout) clearTimeout(renderTimeout);
      if (observer) observer.disconnect();
    };
  }, [source.embedHtml, source.url, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(10);
      setScrollProgress(0);
      setCanProceed(false);
      setHasScrolledToBottom(false);
      setShowTypingIndicator(false);
      return;
    }
    
    // Show typing indicator briefly at start
    setShowTypingIndicator(true);
    const indicatorTimer = setTimeout(() => setShowTypingIndicator(false), 2000);
    
    const cleanup = () => clearTimeout(indicatorTimer);

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
      cleanup();
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
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fade-in"
      onClick={handleBackdropClick}
      onTouchMove={handleBackdropTouch}
    >
      <div className="bg-background rounded-2xl w-[90vw] h-[84vh] flex flex-col border border-border animate-slide-up-blur">
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
              {showTypingIndicator ? (
                <>
                  <TypingIndicator className="mr-2" />
                  <span className="text-muted-foreground font-medium">Preparazione Comprehension Gate...</span>
                </>
              ) : isReady ? (
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
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className={cn(
                  "h-2 rounded-full transition-all ease-linear",
                  timeLeft === 0 ? "bg-trust-high" : "bg-primary"
                )}
                style={{ 
                  width: `${((10 - timeLeft) / 10) * 100}%`,
                  transitionDuration: '1000ms'
                }}
              />
            </div>
            
            {/* Scroll progress */}
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
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
            {source.embedHtml && source.platform === 'youtube' ? (
              <>
                {/* YouTube Embed */}
                <div className="w-full">
                  <div className="aspect-video w-full bg-muted rounded-lg overflow-hidden">
                    <div 
                      dangerouslySetInnerHTML={{ __html: source.embedHtml }}
                      className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full"
                    />
                  </div>
                </div>
                
                {/* Transcript Badge */}
                {source.transcriptSource === 'youtube_captions' && (
                  <div className="bg-trust-high/10 border border-trust-high/20 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-trust-high" />
                      <span className="text-sm font-medium text-trust-high">
                        Trascrizione disponibile
                      </span>
                    </div>
                  </div>
                )}
                
                {source.transcriptSource === 'none' && (
                  <div className="bg-muted/50 border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        ⚠️ Sottotitoli non disponibili per questo video
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Transcript Text */}
                {source.transcript && (
                  <div className="prose prose-sm max-w-none">
                    <h4 className="text-base font-semibold text-foreground mb-3">
                      Trascrizione del Video
                    </h4>
                    <div className="whitespace-pre-wrap text-foreground leading-relaxed bg-muted/30 rounded-lg p-4 border border-border">
                      {source.transcript}
                    </div>
                  </div>
                )}
                
                {/* Padding per scroll */}
                <div className="h-32"></div>
              </>
            ) : source.embedHtml ? (
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
                {/* Show full content with line breaks preserved */}
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-foreground leading-relaxed">
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
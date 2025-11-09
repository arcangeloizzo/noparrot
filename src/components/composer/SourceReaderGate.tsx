// SourceReaderGate - Reading view with Guardrail Mode
// ====================================================
// ✅ Segmenta contenuto in blocchi con tracking intelligente
// ✅ Coverage + Dwell Time + Scroll Velocity per blocco
// ✅ Unlock test quando ≥80% blocchi letti (con grace)
// ✅ Attrito non punitivo su scroll veloce
// ✅ Supporta modalità: soft, guardrail (default), strict

import React, { useState, useEffect, useRef } from 'react';
import { X, Check, ExternalLink, AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TypingIndicator } from '@/components/ui/typing-indicator';
import { cn } from '@/lib/utils';
import { SourceWithGate } from '@/lib/comprehension-gate-extended';
import { useBlockTracking } from '@/hooks/useBlockTracking';
import { READER_GATE_CONFIG } from '@/config/brand';
import { sendReaderTelemetry } from '@/lib/telemetry';

// Safe iframe extraction utilities
const extractIframeSrc = (html: string): string | null => {
  const match = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
};

const validateEmbedDomain = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const allowedDomains = [
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'youtube-nocookie.com',
      'platform.twitter.com',
      'twitter.com',
      'x.com',
      'www.tiktok.com',
      'tiktok.com'
    ];
    return allowedDomains.includes(parsed.hostname);
  } catch {
    return false;
  }
};

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
  const [mode] = useState(READER_GATE_CONFIG.mode);
  const [attritionActive, setAttritionActive] = useState(false);
  const [showVelocityWarning, setShowVelocityWarning] = useState(false);
  const [twitterScriptLoaded, setTwitterScriptLoaded] = useState(false);
  const [isRenderingTwitter, setIsRenderingTwitter] = useState(false);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const [showScrollLockWarning, setShowScrollLockWarning] = useState(false);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Determina contenuto per Guardrail Mode
  const contentForTracking = source.content || source.transcript || source.summary || source.excerpt || '';
  const hasTrackableContent = contentForTracking.length > 100;

  // Hook per block tracking (solo se mode = guardrail e c'è contenuto)
  const {
    blocks,
    progress,
    containerRef,
    blockRefs,
    handleScroll: handleBlockScroll,
    firstIncompleteIndex,
    visibleUpToIndex
  } = useBlockTracking({
    contentHtml: hasTrackableContent ? contentForTracking : '',
    articleId: source.url,
    config: READER_GATE_CONFIG
  });

  // Fallback timer per contenuti non segmentabili - 10s friction
  const [timeLeft, setTimeLeft] = useState(10);
  const [frictionDuration] = useState(10000); // 10s di friction aggressiva
  const [scrollThreshold] = useState(50); // Rallenta scroll >50px/s (più sensibile)
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  // Applica attrito quando velocity troppo alta (Guardrail Mode)
  useEffect(() => {
    if (mode !== 'guardrail' || !hasTrackableContent) return;
    
    // Don't apply attrition if reading is already complete
    const canProceedGuardrail = progress.canUnlock;
    const canProceedFallback = timeLeft === 0 || hasScrolledToBottom;
    const isReadyNow = canProceedGuardrail || canProceedFallback;
    
    if (isReadyNow) {
      setAttritionActive(false);
      setShowVelocityWarning(false);
      return;
    }
    
    if (progress.isScrollingTooFast && !prefersReducedMotion) {
      setAttritionActive(true);
      setShowVelocityWarning(true);

      // Applica scroll-snap temporaneo
      if (containerRef.current) {
        containerRef.current.style.scrollSnapType = 'y mandatory';
      }

      // NON disattiviamo più l'attrito automaticamente
      // Rimane attivo fino al completamento del gate
      console.log('[SourceReaderGate] 🔒 Attrition persisting until gate completion');
    }
  }, [progress.isScrollingTooFast, progress.canUnlock, prefersReducedMotion, mode, hasTrackableContent, timeLeft, hasScrolledToBottom]);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(10); // 10 secondi di timer // 30 secondi iniziali
      setScrollProgress(0);
      setHasScrolledToBottom(false);
      setShowTypingIndicator(false);
      setAttritionActive(false);
      setShowVelocityWarning(false);
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

    // Timer countdown (fallback per contenuti non segmentabili)
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // NON disattivare friction - rimane attivo fino al gate completion
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

  // Scroll handler unificato con hard scroll lock
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Se Guardrail Mode e contenuto trackabile, usa block tracking
    if (mode === 'guardrail' && hasTrackableContent) {
      handleBlockScroll(e);
      
      // Hard scroll lock: impedisci scroll oltre visibleUpToIndex
      if (READER_GATE_CONFIG.hardScrollLock && visibleUpToIndex < blocks.length - 1 && !progress.canUnlock) {
        const container = e.currentTarget;
        const lastVisibleBlock = blockRefs.current.get(`block-${visibleUpToIndex}`);
        
        if (lastVisibleBlock) {
          const maxScrollTop = lastVisibleBlock.offsetTop + lastVisibleBlock.offsetHeight - container.clientHeight + 100;
          
          if (container.scrollTop > maxScrollTop) {
            // Forza scroll indietro
            container.scrollTop = maxScrollTop;
            
            // Mostra toast/warning
            setShowScrollLockWarning(true);
            setTimeout(() => setShowScrollLockWarning(false), 2000);
          }
        }
      }
    }

    // Fallback scroll tracking (per contenuti non segmentabili o altre modalità)
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const progressValue = Math.min(100, (scrollTop / (scrollHeight - clientHeight)) * 100);
    setScrollProgress(progressValue);

    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;

    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const openSource = () => {
    window.open(source.url, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  // Determina se può procedere
  const canProceedGuardrail = mode === 'guardrail' && hasTrackableContent ? progress.canUnlock : false;
  const canProceedFallback = timeLeft === 0 || hasScrolledToBottom;
  const isReady = mode === 'soft' || canProceedGuardrail || canProceedFallback;

  const handleComplete = () => {
    // Telemetria avvio test
    sendReaderTelemetry({
      type: 'gate_test_started',
      articleId: source.url,
      finalReadRatio: mode === 'guardrail' && hasTrackableContent ? progress.readRatio : 1
    });
    onComplete();
  };

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

        {/* Progress Bar - Adattato per Guardrail Mode */}
        <div className="p-4 bg-muted/50 border-b border-border sticky top-0 z-10">
          <div className="flex items-center justify-between text-sm mb-2">
            <div className="flex items-center gap-2">
              {showTypingIndicator ? (
                <>
                  <TypingIndicator className="mr-2" />
                  <span className="text-muted-foreground font-medium">Preparazione Comprehension Gate...</span>
                </>
              ) : isReady ? (
                // PRIORITÀ 1: Lettura completata - mostra solo questo
                <>
                  <Check className="h-4 w-4 text-trust-high" />
                  <span className="text-trust-high font-medium">Lettura Completata</span>
                </>
              ) : showVelocityWarning && mode === 'guardrail' && hasTrackableContent ? (
                // PRIORITÀ 2: Scroll troppo veloce - mostra warning
                <>
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <span className="text-warning font-medium">Rallenta lo scroll...</span>
                </>
              ) : mode === 'guardrail' && hasTrackableContent ? (
                // PRIORITÀ 3: Progresso normale
                <>
                  <span className="text-foreground font-medium">
                    Progresso: {progress.readBlocks} / {progress.totalBlocks} sezioni
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-foreground">
                    {Math.round(progress.readRatio * 100)}%
                  </span>
                </>
              ) : (
                // Fallback: Timer + Scroll
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
            {!isReady && mode === 'guardrail' && hasTrackableContent && (
              <span className="text-muted-foreground text-xs">
                Leggi attentamente le sezioni
              </span>
            )}
            {!isReady && mode !== 'guardrail' && (
              <span className="text-muted-foreground text-xs">
                Leggi per 10s o scorri tutto
              </span>
            )}
          </div>

            {/* Velocity Warning - nascosto se lettura completata */}
            {showVelocityWarning && mode === 'guardrail' && hasTrackableContent && !isReady && (
              <div className="flex items-center gap-2 text-warning text-xs mb-2 animate-pulse">
                <AlertCircle className="h-3 w-3" />
                <span>Rallenta lo scroll per completare la lettura...</span>
              </div>
            )}

          {/* Progress bars */}
          <div className="space-y-2">
            {mode === 'guardrail' && hasTrackableContent ? (
              /* Guardrail Mode: Single progress bar per blocchi letti */
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    progress.canUnlock ? "bg-trust-high" : "bg-primary"
                  )}
                  style={{ width: `${progress.readRatio * 100}%` }}
                />
              </div>
            ) : (
              /* Fallback Mode: Time + Scroll bars */
              <>
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

                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      hasScrolledToBottom ? "bg-trust-high" : "bg-accent"
                    )}
                    style={{ width: `${scrollProgress}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Source Info with Quality Badge */}
        <div className="p-4 border-b border-border bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">
                {source.title || 'Fonte'}
              </h3>
              <p className="text-sm text-muted-foreground break-all">
                {source.url}
              </p>
            </div>
            {/* Content Quality Badge */}
            {(source as any).contentQuality && (
              <div className={cn(
                "px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                (source as any).contentQuality === 'complete' 
                  ? "bg-trust-high/20 text-trust-high border border-trust-high/30"
                  : "bg-warning/20 text-warning border border-warning/30"
              )}>
                {(source as any).contentQuality === 'complete' ? '✓ Completo' : '⚠ Parziale'}
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div
          ref={mode === 'guardrail' && hasTrackableContent ? containerRef : scrollContainerRef}
          className="flex-1 p-4 overflow-y-auto"
          onScroll={handleScroll}
          style={{
            scrollSnapType: attritionActive && !prefersReducedMotion ? 'y mandatory' : 'none'
          }}
        >
          <div className="space-y-4 text-sm leading-relaxed">
            {source.embedHtml && source.platform === 'youtube' ? (
              <>
                {/* YouTube Embed */}
                <div className="w-full">
                  <div className="aspect-video w-full bg-muted rounded-lg overflow-hidden">
                    {(() => {
                      const iframeSrc = extractIframeSrc(source.embedHtml);
                      const isValidSrc = iframeSrc && validateEmbedDomain(iframeSrc);
                      
                      return isValidSrc ? (
                        <iframe
                          src={iframeSrc}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          sandbox="allow-scripts allow-same-origin allow-presentation"
                          title="Embedded YouTube video"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full p-4 text-destructive">
                          Invalid embed source
                        </div>
                      );
                    })()}
                  </div>
                </div>
                
                {/* Transcript Status Badges - Enhanced */}
                {(source as any).transcriptAvailable === true && source.transcript && (
                  <div className="bg-trust-high/10 border border-trust-high/20 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-trust-high" />
                      <span className="text-sm font-medium text-trust-high">
                        Trascrizione Completa Disponibile
                      </span>
                    </div>
                    <p className="text-xs text-trust-high/70 mt-1">
                      Lunghezza: {source.transcript.length} caratteri
                    </p>
                  </div>
                )}
                
                {(source as any).transcriptAvailable === false && (source as any).transcriptError && (
                  <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-warning block">
                          Trascrizione Non Disponibile
                        </span>
                        <p className="text-xs text-warning/70 mt-1">
                          {(source as any).transcriptError}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {source.transcriptSource === 'none' && !(source as any).transcriptError && (
                  <div className="bg-muted/50 border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        ℹ️ Questo video non ha sottotitoli disponibili
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
                    
                    {/* Guardrail Mode: Render transcript in blocchi con progressive reveal */}
                    {mode === 'guardrail' && blocks.length > 0 ? (
                      <div className="space-y-6 bg-muted/30 rounded-lg p-4 border border-border">
                        {blocks.map((block, idx) => {
                          const isLocked = idx > visibleUpToIndex && !progress.canUnlock;
                          const showOverlay = isLocked && READER_GATE_CONFIG.showBlockOverlay;
                          
                          return (
                            <section
                              key={block.id}
                              data-block-id={block.id}
                              ref={(el) => {
                                if (el) blockRefs.current.set(block.id, el);
                              }}
                              className={cn(
                                "content-block p-3 rounded-lg transition-all duration-300 scroll-mt-4 relative",
                                block.isRead && "border-l-4 border-trust-high bg-trust-high/10",
                                attritionActive && "scroll-snap-align-start",
                                isLocked && READER_GATE_CONFIG.blockStyle === 'blur' && "blur-md opacity-30 pointer-events-none",
                                isLocked && READER_GATE_CONFIG.blockStyle === 'hidden' && "hidden"
                              )}
                              style={{
                                filter: isLocked && READER_GATE_CONFIG.blockStyle === 'blur' ? 'blur(8px)' : 'none',
                                opacity: isLocked ? 0.3 : 1
                              }}
                              tabIndex={isLocked ? -1 : 0}
                              aria-label={`Sezione trascrizione ${block.index + 1} di ${blocks.length}`}
                            >
                              <div
                                dangerouslySetInnerHTML={{ __html: block.html }}
                                className="text-foreground leading-relaxed"
                              />

                              {block.isRead && (
                                <div className="flex items-center gap-2 mt-2 text-trust-high text-xs animate-in fade-in duration-300">
                                  <Check className="h-3 w-3" />
                                  <span>Sezione completata</span>
                                </div>
                              )}

                              {block.isVisible && !block.isRead && !isLocked && (
                                <div className="text-xs text-muted-foreground mt-2">
                                  {showVelocityWarning ? (
                                    <div className="flex items-center gap-1 text-warning">
                                      <AlertCircle className="h-3 w-3" />
                                      <span>Rallenta...</span>
                                    </div>
                                  ) : (
                                    <span>~{Math.ceil((block.requiredDwellMs - block.dwellMs) / 1000)}s</span>
                                  )}
                                </div>
                              )}

                              {block.isRead && (
                                <span className="sr-only">
                                  Sezione trascrizione {block.index + 1} completata
                                </span>
                              )}
                              
                              {/* Overlay per blocco locked */}
                              {showOverlay && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                                  <div className="text-center p-4">
                                    <Lock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                                    <p className="text-sm font-medium text-foreground">
                                      Completa le sezioni precedenti
                                    </p>
                                    {firstIncompleteIndex !== -1 && blocks[firstIncompleteIndex] && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Mancano {Math.ceil((blocks[firstIncompleteIndex].requiredDwellMs - blocks[firstIncompleteIndex].dwellMs) / 1000)}s
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </section>
                          );
                        })}
                      </div>
                    ) : (
                      /* Fallback: Transcript non segmentato */
                      <div className="whitespace-pre-wrap text-foreground leading-relaxed bg-muted/30 rounded-lg p-4 border border-border">
                        {source.transcript}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Padding per scroll */}
                <div className="h-32"></div>
              </>
            ) : source.platform === 'tiktok' ? (
              <>
                {/* TikTok Content */}
                <div className="max-w-2xl mx-auto space-y-4">
                  {/* Platform Header */}
                  <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
                      <span className="text-lg">🎵</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">TikTok</p>
                      {source.author && (
                        <p className="text-sm text-muted-foreground">{source.author}</p>
                      )}
                    </div>
                  </div>

                  {/* TikTok Embed */}
                  {source.embedHtml ? (
                    <div className="w-full flex justify-center bg-muted/50 rounded-lg p-4">
                      {(() => {
                        const iframeSrc = extractIframeSrc(source.embedHtml);
                        const isValidSrc = iframeSrc && validateEmbedDomain(iframeSrc);
                        
                        return isValidSrc ? (
                          <iframe
                            src={iframeSrc}
                            className="w-full max-w-[325px]"
                            style={{ height: '738px' }}
                            allow="encrypted-media"
                            sandbox="allow-scripts allow-same-origin allow-presentation"
                            title="Embedded TikTok video"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-64 p-4 text-destructive">
                            <div className="text-center">
                              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                              <p>Embed TikTok non valido</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="bg-muted/50 border border-border rounded-lg p-6 text-center">
                      <p className="text-muted-foreground">
                        Embed TikTok non disponibile. 
                        <button 
                          onClick={() => window.open(source.url, '_blank')}
                          className="text-primary underline ml-1 hover:text-primary/80"
                        >
                          Apri l'originale
                        </button>
                      </p>
                    </div>
                  )}

                  {/* Caption/Content if available */}
                  {source.content && (
                    <div className="prose prose-sm max-w-none">
                      <div className="whitespace-pre-wrap text-foreground leading-relaxed bg-card rounded-lg p-4 border border-border">
                        {source.content}
                      </div>
                    </div>
                  )}

                  <div className="h-32"></div>
                </div>
              </>
            ) : source.platform === 'twitter' || source.platform === 'linkedin' || 
                source.platform === 'instagram' || source.platform === 'threads' ? (
              <>
                {/* Social Media Content */}
                <div className="max-w-2xl mx-auto space-y-4">
                  {/* Platform Header */}
                  <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
                    {source.platform === 'twitter' && (
                      <>
                        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
                          <span className="text-lg font-bold text-white">𝕏</span>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">Twitter/X</p>
                          {source.author_username && (
                            <p className="text-sm text-muted-foreground">@{source.author_username}</p>
                          )}
                        </div>
                      </>
                    )}
                    {source.platform === 'linkedin' && (
                      <>
                        <div className="w-10 h-10 rounded-full bg-[#0A66C2] flex items-center justify-center">
                          <span className="text-lg font-bold text-white">in</span>
                        </div>
                        <div>
                          <p className="font-semibold text-[#0A66C2]">LinkedIn</p>
                          {source.author && (
                            <p className="text-sm text-muted-foreground">{source.author}</p>
                          )}
                        </div>
                      </>
                    )}
                    {source.platform === 'instagram' && (
                      <>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FCAF45] via-[#E1306C] to-[#833AB4] flex items-center justify-center">
                          <span className="text-lg">📷</span>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">Instagram</p>
                        </div>
                      </>
                    )}
                    {source.platform === 'threads' && (
                      <>
                        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
                          <span className="text-lg">🧵</span>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">Threads</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Content - Cleaned */}
                  {source.content && (
                    <div className="prose prose-sm max-w-none">
                      <div className="whitespace-pre-wrap text-foreground leading-relaxed bg-card rounded-lg p-4 border border-border">
                        {source.content}
                      </div>
                      {/* Content quality indicator for social */}
                      {(source as any).contentQuality === 'partial' && (
                        <div className="mt-2 text-xs text-warning flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>Contenuto estratto parzialmente - apri l'originale per vedere tutto</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Image if available */}
                  {source.image && (
                    <div className="rounded-lg overflow-hidden border border-border">
                      <img 
                        src={source.image} 
                        alt="Social media content" 
                        className="w-full object-cover"
                      />
                    </div>
                  )}

                  {/* Try Twitter embed if available */}
                  {source.embedHtml && source.platform === 'twitter' && (() => {
                    const iframeSrc = extractIframeSrc(source.embedHtml);
                    const isValidSrc = iframeSrc && validateEmbedDomain(iframeSrc);
                    
                    return isValidSrc ? (
                      <div className="mt-4">
                        <iframe
                          src={iframeSrc}
                          className="w-full"
                          style={{ minHeight: '200px' }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media"
                          sandbox="allow-scripts allow-same-origin allow-presentation"
                          title="Embedded Twitter/X post"
                        />
                      </div>
                    ) : null;
                  })()}

                  {/* Link to original */}
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openSource}
                      className="gap-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Vedi Post Originale
                    </Button>
                  </div>
                </div>
                
                {/* Padding per scroll */}
                <div className="h-32"></div>
              </>
            ) : source.embedHtml ? (
              <>
                {/* Generic Embed (safe iframe extraction) */}
                <div className="max-w-2xl mx-auto">
                  {(() => {
                    const iframeSrc = extractIframeSrc(source.embedHtml);
                    const isValidSrc = iframeSrc && validateEmbedDomain(iframeSrc);
                    
                    return isValidSrc ? (
                      <iframe
                        src={iframeSrc}
                        className="w-full"
                        style={{ minHeight: '200px' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media"
                        sandbox="allow-scripts allow-same-origin allow-presentation"
                        title="Embedded content"
                      />
                    ) : (
                      <div className="flex items-center justify-center py-12 text-destructive">
                        Invalid embed source
                      </div>
                    );
                  })()}
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
                {/* Guardrail Mode: Render blocchi segmentati con progressive reveal */}
                {mode === 'guardrail' && hasTrackableContent && blocks.length > 0 ? (
                  <div className="space-y-6">
                    {blocks.map((block, idx) => {
                      const isLocked = idx > visibleUpToIndex && !progress.canUnlock;
                      const showOverlay = isLocked && READER_GATE_CONFIG.showBlockOverlay;
                      
                      return (
                        <section
                          key={block.id}
                          data-block-id={block.id}
                          ref={(el) => {
                            if (el) blockRefs.current.set(block.id, el);
                          }}
                          className={cn(
                            "content-block p-4 rounded-lg transition-all duration-300 scroll-mt-4 relative",
                            block.isRead && "border-l-4 border-trust-high bg-trust-high/5",
                            attritionActive && "scroll-snap-align-start",
                            isLocked && READER_GATE_CONFIG.blockStyle === 'blur' && "blur-md opacity-30 pointer-events-none",
                            isLocked && READER_GATE_CONFIG.blockStyle === 'hidden' && "hidden"
                          )}
                          style={{
                            filter: isLocked && READER_GATE_CONFIG.blockStyle === 'blur' ? 'blur(8px)' : 'none',
                            opacity: isLocked ? 0.3 : 1
                          }}
                          tabIndex={isLocked ? -1 : 0}
                          aria-label={`Sezione ${block.index + 1} di ${blocks.length}`}
                        >
                          {/* Contenuto HTML del blocco */}
                          <div
                            dangerouslySetInnerHTML={{ __html: block.html }}
                            className="prose prose-sm max-w-none text-foreground"
                          />

                          {/* Feedback visivo: blocco completato */}
                          {block.isRead && (
                            <div className="flex items-center gap-2 mt-3 text-trust-high text-sm animate-in fade-in duration-300">
                              <Check className="h-4 w-4" />
                              <span>Sezione completata</span>
                            </div>
                          )}

                          {/* Warning/Info: blocco visibile ma non completato */}
                          {block.isVisible && !block.isRead && !isLocked && (
                            <div className="text-xs text-muted-foreground mt-3">
                              {showVelocityWarning ? (
                                <div className="flex items-center gap-1 text-warning">
                                  <AlertCircle className="h-3 w-3" />
                                  <span>Rallenta per completare questa sezione...</span>
                                </div>
                              ) : (
                                <span>
                                  Ancora ~{Math.ceil((block.requiredDwellMs - block.dwellMs) / 1000)}s per completare
                                </span>
                              )}
                            </div>
                          )}

                          {/* Accessibility: Screen reader announcement */}
                          {block.isRead && (
                            <span className="sr-only">
                              Sezione {block.index + 1} di {blocks.length} completata
                            </span>
                          )}
                          
                          {/* Overlay per blocco locked */}
                          {showOverlay && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                              <div className="text-center p-4">
                                <Lock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm font-medium text-foreground">
                                  Completa le sezioni precedenti
                                </p>
                                {firstIncompleteIndex !== -1 && blocks[firstIncompleteIndex] && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Mancano {Math.ceil((blocks[firstIncompleteIndex].requiredDwellMs - blocks[firstIncompleteIndex].dwellMs) / 1000)}s
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  /* Fallback: Contenuto non segmentato */
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                      {source.content || source.summary || source.excerpt}
                    </div>
                  </div>
                )}

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
        <div className="p-4 border-t border-border bg-background">
          {/* ARIA live region per screen readers */}
          {mode === 'guardrail' && hasTrackableContent && (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {isReady
                ? 'Lettura completata. Puoi ora avviare il test.'
                : `Hai letto ${progress.readBlocks} su ${progress.totalBlocks} sezioni. Continua la lettura.`}
            </div>
          )}

          <Button
            onClick={handleComplete}
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
                Avvia Test di Comprensione
              </>
            ) : mode === 'guardrail' && hasTrackableContent ? (
              `Completa la lettura (${Math.round(progress.readRatio * 100)}%)`
            ) : (
              `Attendi ${timeLeft}s o scorri fino alla fine`
            )}
          </Button>
        </div>
      </div>
      
      {/* Scroll Lock Warning Toast */}
      {showScrollLockWarning && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[10000] animate-in slide-in-from-bottom-2 duration-300">
          <div className="bg-warning/90 text-warning-foreground px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span className="text-sm font-medium">
                Completa la lettura prima di continuare
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
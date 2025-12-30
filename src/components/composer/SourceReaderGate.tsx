// SourceReaderGate - Simplified Reading view
// ============================================
// ✅ Semplificato: solo timer 10s OPPURE scroll 100%
// ✅ Rimosso block tracking complesso
// ✅ Rimosso velocity detection e attrition
// ✅ Async YouTube transcript loading
// ✅ iOS Safe Mode: no iframes/embeds on iOS Safari

import React, { useState, useEffect, useRef } from 'react';
import { X, Check, ExternalLink, Music, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TypingIndicator } from '@/components/ui/typing-indicator';
import { cn } from '@/lib/utils';
import { SourceWithGate } from '@/lib/comprehension-gate-extended';
import { sendReaderTelemetry } from '@/lib/telemetry';
import { fetchYouTubeTranscript } from '@/lib/ai-helpers';
import { lockBodyScroll, unlockBodyScroll, transferLock } from '@/lib/bodyScrollLock';

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
      'tiktok.com',
      'open.spotify.com',
      'spotify.com'
    ];
    return allowedDomains.includes(parsed.hostname);
  } catch {
    return false;
  }
};

interface SourceReaderGateProps {
  source: SourceWithGate;
  isOpen: boolean;
  isClosing?: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const SourceReaderGate: React.FC<SourceReaderGateProps> = ({
  source,
  isOpen,
  isClosing = false,
  isLoading = false,
  onClose,
  onComplete
}) => {
  const [twitterScriptLoaded, setTwitterScriptLoaded] = useState(false);
  const [isRenderingTwitter, setIsRenderingTwitter] = useState(false);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Protezione unmount per evitare setState su componenti smontati
  const isMountedRef = useRef(true);
  const timeoutRefs = useRef<number[]>([]);

  const safeSetTimeout = React.useCallback((callback: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      if (isMountedRef.current) {
        callback();
      }
    }, ms);
    timeoutRefs.current.push(id);
    return id;
  }, []);

  // Cleanup al unmount
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      timeoutRefs.current.forEach(id => clearTimeout(id));
      timeoutRefs.current = [];
    };
  }, []);

  // Ref per cleanup sicuro iframe (iOS Safari)
  const rootRef = useRef<HTMLDivElement>(null);
  const spotifyIframeRef = useRef<HTMLIFrameElement>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement>(null);

  // SEMPLIFICATO: Solo timer 10s + scroll 100%
  const [timeLeft, setTimeLeft] = useState(10);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Async YouTube transcript state
  const [asyncTranscript, setAsyncTranscript] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const transcriptFetchedRef = useRef(false);

  // Load and render Twitter widgets ONLY for Twitter embeds
  // CRITICAL: Disabled on iOS to prevent Safari crashes
  useEffect(() => {
    // iOS GUARD: Never load Twitter widgets on iOS Safari (causes crashes)
    if (isIOS) {
      console.log('[SourceReaderGate] iOS detected - skipping Twitter widget loading');
      return;
    }
    
    if (source.platform !== 'twitter') return;
    if (!source.embedHtml || !isOpen) return;

    console.log('[SourceReaderGate] Loading Twitter embed for:', source.url);
    const win = window as any;
    setIsRenderingTwitter(true);
    let renderTimeout: number;
    let observer: MutationObserver;

    const renderWidgets = () => {
      console.log('[SourceReaderGate] Attempting to render Twitter widgets...');
      
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
      renderTimeout = window.setTimeout(() => {
        if (!isMountedRef.current) return;
        console.warn('[SourceReaderGate] Twitter render timeout, showing fallback');
        setIsRenderingTwitter(false);
      }, 5000);

      const embedContainer = document.querySelector('.twitter-embed-container');
      if (embedContainer) {
        observer = new MutationObserver((mutations) => {
          const blockquote = embedContainer.querySelector('blockquote.twitter-tweet');
          if (blockquote) {
            console.log('[SourceReaderGate] Blockquote detected in DOM via MutationObserver');
            observer.disconnect();
            safeSetTimeout(renderWidgets, 100);
          }
        });

        observer.observe(embedContainer, { 
          childList: true, 
          subtree: true 
        });

        const blockquote = embedContainer.querySelector('blockquote.twitter-tweet');
        if (blockquote) {
          console.log('[SourceReaderGate] Blockquote already in DOM');
          safeSetTimeout(renderWidgets, 100);
        }
      }
    };

    if (win.twttr) {
      console.log('[SourceReaderGate] Twitter script already loaded');
      initTwitterWidget();
      return () => {
        if (renderTimeout) clearTimeout(renderTimeout);
        if (observer) observer.disconnect();
      };
    }

    console.log('[SourceReaderGate] Loading Twitter script...');
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    script.onload = () => {
      console.log('[SourceReaderGate] Twitter script loaded');
      setTwitterScriptLoaded(true);
      safeSetTimeout(initTwitterWidget, 200);
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
  }, [source.embedHtml, source.url, isOpen, isIOS, safeSetTimeout]);

  // Pre-cleanup esplicito iframe PRIMA dello smontaggio (iOS Safari)
  useEffect(() => {
    if (!isClosing) return;

    const safeBlank = (iframe: HTMLIFrameElement) => {
      try {
        iframe.src = 'about:blank';
      } catch (e) {
        console.warn('[SourceReaderGate] Error pre-cleaning iframe:', e);
      }
    };

    if (spotifyIframeRef.current) safeBlank(spotifyIframeRef.current);
    if (youtubeIframeRef.current) safeBlank(youtubeIframeRef.current);

    try {
      const root = rootRef.current;
      if (root) {
        const iframes = Array.from(root.querySelectorAll('iframe')) as HTMLIFrameElement[];
        iframes.forEach(safeBlank);
      }
    } catch (e) {
      console.warn('[SourceReaderGate] Error pre-cleaning generic iframes:', e);
    }
  }, [isClosing]);

  // Cleanup sicuro iframe Spotify e YouTube su unmount
  useEffect(() => {
    return () => {
      if (spotifyIframeRef.current) {
        try {
          spotifyIframeRef.current.src = 'about:blank';
        } catch (e) {
          console.warn('[SourceReaderGate] Error cleaning up Spotify iframe:', e);
        }
      }
      if (youtubeIframeRef.current) {
        try {
          youtubeIframeRef.current.src = 'about:blank';
        } catch (e) {
          console.warn('[SourceReaderGate] Error cleaning up YouTube iframe:', e);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(10);
      setScrollProgress(0);
      setHasScrolledToBottom(false);
      setShowTypingIndicator(false);
      setAsyncTranscript(null);
      setTranscriptLoading(false);
      setTranscriptError(null);
      transcriptFetchedRef.current = false;

      // Use centralized scroll lock
      unlockBodyScroll('reader');
      return;
    }

    // Use centralized scroll lock
    lockBodyScroll('reader');

    // Show typing indicator briefly at start
    setShowTypingIndicator(true);
    const indicatorTimer = safeSetTimeout(() => setShowTypingIndicator(false), 2000);

    // Timer countdown (10s)
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(indicatorTimer);
      clearInterval(timer);
      // Use centralized scroll lock
      unlockBodyScroll('reader');
    };
  }, [isOpen, safeSetTimeout]);

  // Async YouTube transcript fetch
  useEffect(() => {
    if (!isOpen || source.platform !== 'youtube') return;
    if (transcriptFetchedRef.current) return;
    
    // Check if transcript is already available from cache
    const existingTranscript = source.transcript;
    const transcriptStatus = (source as any).transcriptStatus;
    
    if (existingTranscript && existingTranscript.length > 50) {
      console.log('[SourceReaderGate] Transcript already cached:', existingTranscript.length, 'chars');
      setAsyncTranscript(existingTranscript);
      return;
    }
    
    // If transcriptStatus is 'pending', fetch async
    if (transcriptStatus === 'pending' || !existingTranscript) {
      transcriptFetchedRef.current = true;
      setTranscriptLoading(true);
      setTranscriptError(null);
      
      console.log('[SourceReaderGate] Starting async transcript fetch for:', source.url);
      
      fetchYouTubeTranscript(source.url)
        .then((result) => {
          if (!isMountedRef.current) return;
          
          if (result.transcript && result.transcript.length > 50) {
            console.log('[SourceReaderGate] Async transcript received:', result.transcript.length, 'chars');
            setAsyncTranscript(result.transcript);
            setTranscriptError(null);
          } else if (result.error) {
            console.warn('[SourceReaderGate] Transcript error:', result.error);
            setTranscriptError(result.error);
          } else if (result.source === 'none') {
            setTranscriptError('Questo video non ha sottotitoli disponibili');
          }
        })
        .catch((err) => {
          if (!isMountedRef.current) return;
          console.error('[SourceReaderGate] Transcript fetch failed:', err);
          setTranscriptError('Errore nel caricamento della trascrizione');
        })
        .finally(() => {
          if (isMountedRef.current) {
            setTranscriptLoading(false);
          }
        });
    }
  }, [isOpen, source.platform, source.url, source.transcript]);

  // Scroll handler semplificato
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
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

  // Check if content is blocked (anti-bot protection)
  const isBlocked = (source as any).contentQuality === 'blocked';

  // SEMPLIFICATO: isReady = timer 0 OPPURE scroll 100% OPPURE contenuto bloccato (bypass gate)
  const isReady = isBlocked || timeLeft === 0 || hasScrolledToBottom;

  const handleComplete = () => {
    sendReaderTelemetry({
      type: 'gate_test_started',
      articleId: source.url,
      finalReadRatio: 1
    });
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__np_last_gate_event = { event: 'reader_complete_clicked', at: Date.now(), url: source.url };
    } catch {
      // ignore
    }
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
      ref={rootRef}
      data-reader-gate-root="true"
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fade-in"
      onClick={handleBackdropClick}
      onTouchMove={handleBackdropTouch}
    >
      <div className="bg-background rounded-2xl w-[90vw] h-[84vh] flex flex-col border border-border animate-slide-up-blur">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center justify-center w-full">
            <h2 className="font-semibold text-lg text-foreground text-center">
              Prima comprendiamo.
            </h2>
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

        {/* Progress Bar - Semplificato (nascosto se contenuto bloccato) */}
        {!isBlocked && (
          <div className="p-4 bg-muted/50 border-b border-border sticky top-0 z-10">
            <div className="flex items-center justify-between text-sm mb-2">
              <div className="flex items-center gap-2">
                {showTypingIndicator ? (
                  <>
                    <TypingIndicator className="mr-2" />
                    <span className="text-muted-foreground font-medium">Sto preparando ciò che ti serve per orientarti…</span>
                  </>
                ) : isReady ? (
                  <>
                    <Check className="h-4 w-4 text-[hsl(var(--cognitive-correct))]" />
                    <span className="text-[hsl(var(--cognitive-correct))] font-medium">Hai visto abbastanza per capire. Procediamo.</span>
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
            </div>
          </div>
        )}

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
          ref={scrollContainerRef}
          className="flex-1 p-4 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
          onScroll={handleScroll}
        >
          <div className="space-y-4 text-sm leading-relaxed">
            {source.embedHtml && source.platform === 'youtube' && !isClosing ? (
              <>
                {/* YouTube Embed */}
                {!isIOS ? (
                  <div className="w-full">
                    <div className="aspect-video w-full bg-muted rounded-lg overflow-hidden">
                      {(() => {
                        const iframeSrc = extractIframeSrc(source.embedHtml);
                        const isValidSrc = iframeSrc && validateEmbedDomain(iframeSrc);

                        return isValidSrc ? (
                          <iframe
                            ref={youtubeIframeRef}
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
                ) : (
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-lg border border-border bg-card p-2">
                        <ExternalLink className="h-4 w-4 text-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Player YouTube disattivato su iOS</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Per evitare schermate bianche/crash su Safari iOS, apriamo il video fuori dall'app.
                        </p>
                        <div className="mt-3">
                          <Button variant="outline" size="sm" onClick={openSource} className="gap-2">
                            <ExternalLink className="h-3 w-3" />
                            Apri su YouTube
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Transcript Status Badges - Async aware */}
                {(() => {
                  const displayTranscript = asyncTranscript || source.transcript;
                  const hasTranscript = displayTranscript && displayTranscript.length > 50;
                  
                  if (transcriptLoading) {
                    return (
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 text-primary animate-spin" />
                          <span className="text-sm font-medium text-primary">
                            Trascrizione in caricamento...
                          </span>
                        </div>
                        <p className="text-xs text-primary/70 mt-1">
                          Potrebbe richiedere fino a 60 secondi per video lunghi
                        </p>
                      </div>
                    );
                  }
                  
                  if (hasTranscript) {
                    return (
                      <div className="bg-trust-high/10 border border-trust-high/20 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-trust-high" />
                          <span className="text-sm font-medium text-trust-high">
                            Trascrizione Completa Disponibile
                          </span>
                        </div>
                        <p className="text-xs text-trust-high/70 mt-1">
                          Lunghezza: {displayTranscript.length} caratteri
                        </p>
                      </div>
                    );
                  }
                  
                  if (transcriptError) {
                    return (
                      <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <span className="text-sm font-medium text-warning block">
                              ⚠️ Trascrizione Non Disponibile
                            </span>
                            <p className="text-xs text-warning/70 mt-1">
                              {transcriptError}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  return null;
                })()}
                
                {/* Transcript Text - Simple render (async aware) */}
                {(() => {
                  const displayTranscript = asyncTranscript || source.transcript;
                  if (!displayTranscript || displayTranscript.length < 50) return null;
                  
                  return (
                    <div className="prose prose-sm max-w-none">
                      <h4 className="text-base font-semibold text-foreground mb-3">
                        Trascrizione del Video
                      </h4>
                      <div className="whitespace-pre-wrap text-foreground leading-relaxed bg-muted/30 rounded-lg p-4 border border-border">
                        {displayTranscript}
                      </div>
                    </div>
                  );
                })()}
                
                <div className="h-32"></div>
              </>
            ) : isClosing ? (
              <div className="flex items-center justify-center py-12">
                <span className="text-sm text-muted-foreground">Chiusura…</span>
              </div>
            ) : source.platform === 'tiktok' && !isClosing ? (
              <>
                {/* TikTok Content */}
                <div className="max-w-2xl mx-auto space-y-4">
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

                  {source.embedHtml ? (
                    <div className="w-full flex justify-center bg-muted/50 rounded-lg p-4">
                      {isIOS ? (
                        <div className="w-full text-center">
                          <p className="text-sm text-muted-foreground">
                            Per evitare schermate bianche/crash su Safari iOS, il player TikTok è disattivato.
                          </p>
                          <div className="mt-3 flex justify-center">
                            <Button variant="outline" size="sm" onClick={openSource} className="gap-2">
                              <ExternalLink className="h-3 w-3" />
                              Apri su TikTok
                            </Button>
                          </div>
                        </div>
                      ) : (
                        (() => {
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
                                <p className="text-sm">Invalid embed source</p>
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  ) : (
                    <div className="text-center p-6 bg-muted/30 rounded-lg border border-border">
                      <p className="text-sm text-muted-foreground mb-4">
                        Contenuto TikTok non visualizzabile
                      </p>
                      <Button variant="outline" size="sm" onClick={openSource} className="gap-2">
                        <ExternalLink className="h-3 w-3" />
                        Apri su TikTok
                      </Button>
                    </div>
                  )}

                  {source.content && (
                    <div className="p-4 bg-muted/30 rounded-lg border border-border">
                      <p className="text-foreground">{source.content}</p>
                    </div>
                  )}
                </div>
                <div className="h-32"></div>
              </>
            ) : source.platform === 'spotify' && !isClosing ? (
              <>
                {/* Spotify Content */}
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-[#1DB954]/10 border border-[#1DB954]/20 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-[#1DB954] flex items-center justify-center">
                      <Music className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Spotify</p>
                      {source.author && (
                        <p className="text-sm text-muted-foreground">{source.author}</p>
                      )}
                    </div>
                  </div>

                  {source.embedHtml && !isIOS ? (
                    <div className="w-full flex justify-center bg-muted/50 rounded-lg p-4">
                      {(() => {
                        const iframeSrc = extractIframeSrc(source.embedHtml);
                        const isValidSrc = iframeSrc && validateEmbedDomain(iframeSrc);

                        return isValidSrc ? (
                          <iframe
                            ref={spotifyIframeRef}
                            src={iframeSrc}
                            className="w-full rounded-xl"
                            style={{ height: '352px' }}
                            allow="encrypted-media"
                            sandbox="allow-scripts allow-same-origin allow-presentation"
                            title="Embedded Spotify content"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-64 p-4 text-destructive">
                            <div className="text-center">
                              <p className="text-sm">Invalid embed source</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : isIOS ? (
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-lg border border-border bg-card p-2">
                          <ExternalLink className="h-4 w-4 text-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Player Spotify disattivato su iOS</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Per evitare schermate bianche/crash su Safari iOS.
                          </p>
                          <div className="mt-3">
                            <Button variant="outline" size="sm" onClick={openSource} className="gap-2">
                              <ExternalLink className="h-3 w-3" />
                              Apri su Spotify
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Lyrics/Transcript */}
                  {source.transcript && (
                    <div className="prose prose-sm max-w-none">
                      <h4 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Music className="h-4 w-4" />
                        {(source as any).geniusUrl ? 'Testo da Genius' : 'Contenuto'}
                      </h4>
                      <div className="whitespace-pre-wrap text-foreground leading-relaxed bg-muted/30 rounded-lg p-4 border border-border font-mono text-sm">
                        {source.transcript}
                      </div>
                    </div>
                  )}

                  {(source as any).geniusUrl && (
                    <a 
                      href={(source as any).geniusUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Vedi su Genius
                    </a>
                  )}
                </div>
                <div className="h-32"></div>
              </>
            ) : source.platform === 'twitter' && !isClosing ? (
              <>
                {/* Twitter Content - iOS Safe Mode: no embed widget */}
                <div className="max-w-2xl mx-auto space-y-4">
                  {isIOS ? (
                    // iOS Safe Mode: static card instead of embed
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-lg border border-border bg-card p-2">
                          <ExternalLink className="h-4 w-4 text-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Widget Twitter disattivato su iOS</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Per evitare schermate bianche/crash su Safari iOS.
                          </p>
                          {source.content && (
                            <div className="mt-3 p-3 bg-card rounded-lg border border-border">
                              <p className="text-sm text-foreground whitespace-pre-wrap">{source.content}</p>
                            </div>
                          )}
                          <div className="mt-3">
                            <Button variant="outline" size="sm" onClick={openSource} className="gap-2">
                              <ExternalLink className="h-3 w-3" />
                              Apri su X/Twitter
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : source.embedHtml ? (
                    // Desktop: show embed widget
                    <div className="twitter-embed-container">
                      {isRenderingTwitter && (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                          <span className="text-sm text-muted-foreground">Caricamento tweet...</span>
                        </div>
                      )}
                      <div 
                        dangerouslySetInnerHTML={{ __html: source.embedHtml }}
                        className="overflow-hidden"
                      />
                    </div>
                  ) : (
                    // No embed available: show content text
                    <div className="p-4 bg-muted/30 rounded-lg border border-border">
                      <p className="text-foreground">{source.content || 'Contenuto Twitter non disponibile'}</p>
                      <div className="mt-3">
                        <Button variant="outline" size="sm" onClick={openSource} className="gap-2">
                          <ExternalLink className="h-3 w-3" />
                          Apri su X/Twitter
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="h-32"></div>
              </>
            ) : isBlocked ? (
              <>
                {/* Blocked Content - Anti-bot protection detected */}
                <div className="max-w-2xl mx-auto space-y-4">
                  {/* Blocked notice card */}
                  <div className="p-6 bg-warning/10 border border-warning/30 rounded-xl">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">🛡️</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-2">
                          Sito protetto
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Questo sito utilizza protezioni anti-bot che impediscono la lettura automatica del contenuto.
                          Per leggere l'articolo, aprilo direttamente nel browser.
                        </p>
                        <Button 
                          onClick={openSource}
                          className="gap-2 bg-warning text-warning-foreground hover:bg-warning/90"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Apri l'originale
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Source preview card */}
                  <div className="p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      {source.image && (
                        <img 
                          src={source.image} 
                          alt="" 
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground truncate">
                          {source.title || 'Articolo'}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {new URL(source.url).hostname}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      Puoi comunque procedere al test basandoti sulla lettura nell'originale
                    </p>
                  </div>
                </div>
                <div className="h-32"></div>
              </>
            ) : (
              <>
                {/* Generic Article/Content */}
                <div className="max-w-2xl mx-auto space-y-4">
                  {source.image && (
                    <div className="rounded-lg overflow-hidden">
                      <img 
                        src={source.image} 
                        alt={source.title || 'Preview'} 
                        className="w-full h-auto object-cover"
                      />
                    </div>
                  )}

                  {source.content ? (
                    <div className="prose prose-sm max-w-none">
                      <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                        {source.content}
                      </div>
                    </div>
                  ) : source.summary ? (
                    <div className="p-4 bg-muted/30 rounded-lg border border-border">
                      <p className="text-foreground">{source.summary}</p>
                    </div>
                  ) : (
                    <div className="text-center p-6 bg-muted/30 rounded-lg border border-border">
                      <p className="text-sm text-muted-foreground mb-4">
                        Contenuto non disponibile per l'anteprima
                      </p>
                      <Button variant="outline" size="sm" onClick={openSource} className="gap-2">
                        <ExternalLink className="h-3 w-3" />
                        Apri l'originale
                      </Button>
                    </div>
                  )}
                </div>
                <div className="h-32"></div>
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-card">
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={openSource}
              className="flex-1 gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Apri originale
            </Button>
            <Button 
              onClick={handleComplete}
              disabled={!isReady || isLoading}
              className={cn(
                "flex-1 gap-2 transition-all",
                isReady 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Caricamento...
                </>
              ) : isReady ? (
                <>
                  <Check className="h-4 w-4" />
                  Procedi al test
                </>
              ) : (
                <>
                  Attendi...
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

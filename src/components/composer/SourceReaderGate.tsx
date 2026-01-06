// SourceReaderGate - Source-first Bridge screen
// =============================================
// ✅ SOURCE-FIRST: Uses iframe/embed ONLY, no full text rendering
// ✅ No content/transcript/lyrics displayed (copyright compliance)
// ✅ Simple bridge screen - user can view source and proceed when ready
// ✅ iOS Safe Mode: no iframes/embeds on iOS Safari

import React, { useState, useEffect, useRef } from 'react';
import { X, Check, ExternalLink, Music, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SourceWithGate } from '@/lib/comprehension-gate-extended';
import { sendReaderTelemetry } from '@/lib/telemetry';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/bodyScrollLock';
import { addBreadcrumb } from '@/lib/crashBreadcrumbs';

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
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Protection for unmount
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

  // Cleanup on unmount
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      timeoutRefs.current.forEach(id => clearTimeout(id));
      timeoutRefs.current = [];
    };
  }, []);

  // Iframe refs for cleanup
  const rootRef = useRef<HTMLDivElement>(null);
  const spotifyIframeRef = useRef<HTMLIFrameElement>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Iframe loading state for generic articles
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);
  const articleIframeRef = useRef<HTMLIFrameElement>(null);

  // Load Twitter widgets (desktop only)
  useEffect(() => {
    if (isIOS) return;
    if (source.platform !== 'twitter') return;
    if (!source.embedHtml || !isOpen) return;

    const win = window as any;
    setIsRenderingTwitter(true);
    let renderTimeout: number;
    let observer: MutationObserver;

    const renderWidgets = () => {
      const embedContainer = document.querySelector('.twitter-embed-container');
      if (!embedContainer) {
        setIsRenderingTwitter(false);
        return;
      }

      const blockquote = embedContainer.querySelector('blockquote.twitter-tweet');
      if (!blockquote) {
        setIsRenderingTwitter(false);
        return;
      }

      if (win.twttr?.widgets) {
        win.twttr.widgets.load(embedContainer)
          .then(() => {
            setIsRenderingTwitter(false);
            setTwitterScriptLoaded(true);
            if (renderTimeout) clearTimeout(renderTimeout);
          })
          .catch(() => setIsRenderingTwitter(false));
      } else {
        setIsRenderingTwitter(false);
      }
    };

    const initTwitterWidget = () => {
      renderTimeout = window.setTimeout(() => {
        if (!isMountedRef.current) return;
        setIsRenderingTwitter(false);
      }, 5000);

      const embedContainer = document.querySelector('.twitter-embed-container');
      if (embedContainer) {
        observer = new MutationObserver(() => {
          const blockquote = embedContainer.querySelector('blockquote.twitter-tweet');
          if (blockquote) {
            observer.disconnect();
            safeSetTimeout(renderWidgets, 100);
          }
        });

        observer.observe(embedContainer, { childList: true, subtree: true });

        const blockquote = embedContainer.querySelector('blockquote.twitter-tweet');
        if (blockquote) {
          safeSetTimeout(renderWidgets, 100);
        }
      }
    };

    if (win.twttr) {
      initTwitterWidget();
      return () => {
        if (renderTimeout) clearTimeout(renderTimeout);
        if (observer) observer.disconnect();
      };
    }

    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    script.onload = () => {
      setTwitterScriptLoaded(true);
      safeSetTimeout(initTwitterWidget, 200);
    };
    script.onerror = () => setIsRenderingTwitter(false);
    
    document.body.appendChild(script);

    return () => {
      if (renderTimeout) clearTimeout(renderTimeout);
      if (observer) observer.disconnect();
    };
  }, [source.embedHtml, source.url, isOpen, isIOS, safeSetTimeout, source.platform]);

  // Pre-cleanup iframes before unmount (iOS Safari)
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

  // Cleanup iframes on unmount
  useEffect(() => {
    return () => {
      if (spotifyIframeRef.current) {
        try {
          spotifyIframeRef.current.src = 'about:blank';
        } catch (e) {}
      }
      if (youtubeIframeRef.current) {
        try {
          youtubeIframeRef.current.src = 'about:blank';
        } catch (e) {}
      }
    };
  }, []);

  // Reset iframe state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIframeLoaded(false);
      setIframeFailed(false);
    }
  }, [isOpen]);

  // Iframe timeout for generic articles (5 seconds)
  useEffect(() => {
    if (!isOpen) return;
    if (source.platform === 'youtube' || source.platform === 'spotify' || 
        source.platform === 'twitter' || source.platform === 'tiktok') return;
    if (source.contentQuality === 'blocked') return;
    if (iframeLoaded || iframeFailed) return;
    
    const timeout = safeSetTimeout(() => {
      if (!iframeLoaded) {
        console.log('[SourceReaderGate] Iframe timeout - falling back to preview card');
        setIframeFailed(true);
      }
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [isOpen, iframeLoaded, iframeFailed, source.platform, source.contentQuality, safeSetTimeout]);

  useEffect(() => {
    if (!isOpen) {
      unlockBodyScroll('reader');
      return;
    }

    lockBodyScroll('reader');

    return () => {
      unlockBodyScroll('reader');
    };
  }, [isOpen]);

  const openSource = () => {
    window.open(source.url, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  // Check if content is blocked
  const isBlocked = source.contentQuality === 'blocked';

  // Bridge screen: always ready to proceed (no timer/scroll gate)
  const isReady = true;

  const handleComplete = () => {
    addBreadcrumb('reader_proceed_clicked', {
      platform: source.platform,
      isBlocked: source.contentQuality === 'blocked'
    });

    sendReaderTelemetry({
      type: 'gate_test_started',
      articleId: source.url,
      finalReadRatio: 1
    });
    
    try {
      (window as any).__np_last_gate_event = { event: 'reader_complete_clicked', at: Date.now(), url: source.url };
    } catch {}
    
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

  // Render platform-specific content
  const renderContent = () => {
    // YouTube - iOS enabled with tap-to-load
    if (source.platform === 'youtube' && source.embedHtml && !isClosing) {
      const iframeSrc = extractIframeSrc(source.embedHtml);
      const isValidSrc = iframeSrc && validateEmbedDomain(iframeSrc);
      
      return (
        <div className="max-w-2xl mx-auto space-y-4">
          {/* YouTube Embed - Works on all platforms including iOS */}
          <div className="w-full">
            <div className="aspect-video w-full bg-muted rounded-lg overflow-hidden">
              {isValidSrc ? (
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
                <div className="flex flex-col items-center justify-center h-full p-4 gap-4 bg-muted/50">
                  <div className="text-muted-foreground text-sm text-center">
                    Impossibile caricare il player
                  </div>
                  <Button variant="outline" size="sm" onClick={openSource} className="gap-2">
                    <ExternalLink className="h-3 w-3" />
                    Apri su YouTube
                  </Button>
                </div>
              )}
            </div>
          </div>
          
        </div>
      );
    }

    // TikTok
    if (source.platform === 'tiktok' && !isClosing) {
      return (
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

          {source.embedHtml && !isIOS ? (
            <div className="w-full flex justify-center bg-muted/50 rounded-lg p-4">
              {(() => {
                const iframeSrc = extractIframeSrc(source.embedHtml!);
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
                    Invalid embed source
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-center p-6 bg-muted/30 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground mb-4">
                {isIOS ? 'Player TikTok disattivato su iOS' : 'Contenuto TikTok non visualizzabile'}
              </p>
              <Button variant="outline" size="sm" onClick={openSource} className="gap-2">
                <ExternalLink className="h-3 w-3" />
                Apri su TikTok
              </Button>
            </div>
          )}
        </div>
      );
    }

    // Spotify
    if (source.platform === 'spotify' && !isClosing) {
      return (
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
                const iframeSrc = extractIframeSrc(source.embedHtml!);
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
                    Invalid embed source
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg border border-border bg-card p-2">
                  <ExternalLink className="h-4 w-4 text-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Player Spotify disattivato su iOS</p>
                  <div className="mt-3">
                    <Button variant="outline" size="sm" onClick={openSource} className="gap-2">
                      <ExternalLink className="h-3 w-3" />
                      Apri su Spotify
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lyrics status badge (no full lyrics shown) */}
          {source.lyricsAvailable && (
            <div className="bg-trust-high/10 border border-trust-high/20 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-trust-high" />
                <span className="text-sm font-medium text-trust-high">
                  Testo disponibile per il test
                </span>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Twitter/X
    if (source.platform === 'twitter' && !isClosing) {
      return (
        <div className="max-w-2xl mx-auto space-y-4">
          {isIOS ? (
            // iOS: Enhanced X-styled card
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#15202B] to-[#0d1117] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full border border-white/20 overflow-hidden bg-[#15202B]">
                  {(source as any).author_avatar ? (
                    <img 
                      src={(source as any).author_avatar}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50 text-lg font-bold">
                      {((source as any).author_name || source.author || 'X').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-white font-semibold">
                      {(source as any).author_name || source.author || 'X User'}
                    </p>
                    {(source as any).is_verified && (
                      <svg className="w-4 h-4 text-[#1DA1F2] flex-shrink-0" viewBox="0 0 22 22" fill="currentColor">
                        <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/>
                      </svg>
                    )}
                  </div>
                  {source.author_username && (
                    <p className="text-gray-400 text-sm">@{source.author_username}</p>
                  )}
                </div>
                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
                  <span className="text-black font-bold text-xs">𝕏</span>
                </div>
              </div>
              
              {/* Short summary only, no full tweet text */}
              {source.summary && (
                <p className="text-white text-base leading-relaxed mb-4">
                  {source.summary}
                </p>
              )}
              
              {source.image && (
                <div className="rounded-xl overflow-hidden mb-4">
                  <img src={source.image} alt="" className="w-full h-48 object-cover" />
                </div>
              )}
              
              <Button 
                variant="outline" 
                onClick={openSource} 
                className="w-full gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <ExternalLink className="h-4 w-4" />
                Apri su X
              </Button>
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
            // No embed: show CTA
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <p className="text-foreground mb-3">{source.summary || 'Tweet'}</p>
              <Button variant="outline" size="sm" onClick={openSource} className="gap-2">
                <ExternalLink className="h-3 w-3" />
                Apri su X/Twitter
              </Button>
            </div>
          )}
        </div>
      );
    }

    // Blocked content
    if (isBlocked) {
      return (
        <div className="max-w-2xl mx-auto space-y-4">
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
                  {source.hostname || new URL(source.url).hostname}
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
      );
    }

    // Generic article - SOURCE-FIRST: Attempt iframe with fallback
    // If iframeAllowed and not failed, try to show iframe
    const showIframe = source.iframeAllowed !== false && !iframeFailed;
    
    if (showIframe) {
      return (
        <div className="flex flex-col h-full space-y-3">
          {/* Compact article header */}
          <div className="p-3 bg-card border border-border rounded-lg flex-shrink-0">
            <div className="flex items-center gap-3">
              {source.image && (
                <img 
                  src={source.image} 
                  alt="" 
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm truncate">
                  {source.title || 'Articolo'}
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  {source.hostname || new URL(source.url).hostname}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={openSource} className="flex-shrink-0 h-8 px-2">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Iframe container */}
          <div className="relative flex-1 rounded-xl border border-border overflow-hidden bg-muted/30">
            {!iframeLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 z-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                <span className="text-sm text-muted-foreground">Caricamento sito...</span>
              </div>
            )}
            <iframe
              ref={articleIframeRef}
              src={source.url}
              className={cn(
                "w-full h-full border-0 transition-opacity duration-300",
                iframeLoaded ? "opacity-100" : "opacity-0"
              )}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              onLoad={() => {
                console.log('[SourceReaderGate] Iframe loaded successfully');
                setIframeLoaded(true);
              }}
              onError={() => {
                console.log('[SourceReaderGate] Iframe error - falling back');
                setIframeFailed(true);
              }}
              title="Article content"
            />
          </div>
        </div>
      );
    }
    
    // Fallback: Preview card when iframe fails or not allowed
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Article preview card */}
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-start gap-4">
            {source.image && (
              <img 
                src={source.image} 
                alt="" 
                className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground">
                {source.title || 'Articolo'}
              </h3>
              {source.author && (
                <p className="text-sm text-muted-foreground mt-1">{source.author}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {source.hostname || new URL(source.url).hostname}
              </p>
            </div>
          </div>
        </div>

        {/* Short summary only */}
        {source.summary && (
          <div className="p-4 bg-muted/20 rounded-xl border border-border/50">
            <p className="text-foreground text-base leading-7">{source.summary}</p>
          </div>
        )}

        {/* Iframe blocked notice */}
        {iframeFailed && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-700 dark:text-amber-400">
                Il sito non permette la visualizzazione incorporata
              </span>
            </div>
          </div>
        )}

        {/* Content quality badge */}
        {source.contentQuality === 'complete' && !iframeFailed && (
          <div className="bg-trust-high/10 border border-trust-high/20 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-trust-high" />
              <span className="text-sm font-medium text-trust-high">
                Contenuto completo disponibile per il test
              </span>
            </div>
          </div>
        )}

        {/* CTA to open original */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Leggi l'articolo completo nell'originale
          </p>
          <Button variant="outline" onClick={openSource} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Apri l'originale
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div 
      ref={rootRef}
      data-reader-gate-root="true"
      className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-[9999] animate-fade-in"
      onClick={handleBackdropClick}
      onTouchMove={handleBackdropTouch}
    >
      <div className="bg-card rounded-3xl w-[92vw] h-[86vh] flex flex-col border border-border/50 shadow-2xl animate-slide-up-blur overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-muted/30">
          <div className="flex-1">
            <h2 className="font-semibold text-lg text-foreground">
              Contenuto pronto
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ora puoi entrare nella fase di comprensione.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Source Badge */}
        <div className="px-5 py-3 border-b border-border/30 bg-card">
          <div className="flex items-center gap-3">
            {source.contentQuality && (
              <div className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium",
                source.contentQuality === 'complete' 
                  ? "bg-trust-high/15 text-trust-high"
                  : source.contentQuality === 'blocked'
                    ? "bg-warning/15 text-warning"
                    : "bg-muted text-muted-foreground"
              )}>
                {source.contentQuality === 'complete' ? '✓ Completo' : 
                 source.contentQuality === 'blocked' ? '🛡️ Protetto' : 
                 '⚠ Parziale'}
              </div>
            )}
            <span className="text-xs text-muted-foreground truncate flex-1">
              {source.url}
            </span>
          </div>
        </div>

        {/* Content Area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
        >
          <div className="px-5 py-6 space-y-5 max-w-full overflow-hidden">
            {isClosing ? (
              <div className="flex items-center justify-center py-12">
                <span className="text-sm text-muted-foreground">Chiusura…</span>
              </div>
            ) : (
              renderContent()
            )}
            <div className="h-32"></div>
          </div>
        </div>

        {/* Footer Actions */}
        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-border/50 bg-card space-y-3">
          <p className="text-xs text-center text-muted-foreground">
            Puoi rivedere la fonte in qualsiasi momento.
          </p>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={openSource}
              className="flex-1 gap-2 h-12 rounded-2xl"
            >
              <ExternalLink className="h-4 w-4" />
              Apri la fonte
            </Button>
            <Button 
              onClick={handleComplete}
              disabled={isLoading}
              className="flex-1 gap-2 h-12 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Caricamento...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Continua
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

import { useState, useEffect, useRef, useMemo } from 'react';
import { READER_GATE_CONFIG } from '@/config/brand';
import { ContentBlock, ReadingProgress } from '@/lib/comprehension-gate-extended';
import { sendReaderTelemetry } from '@/lib/telemetry';

interface UseBlockTrackingOptions {
  contentHtml: string;
  articleId: string;
  config: typeof READER_GATE_CONFIG;
}

export function useBlockTracking({
  contentHtml,
  articleId,
  config
}: UseBlockTrackingOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [progress, setProgress] = useState<ReadingProgress>({
    totalBlocks: 0,
    readBlocks: 0,
    readRatio: 0,
    canUnlock: false,
    currentScrollVelocity: 0,
    isScrollingTooFast: false,
    scrollAttritionActive: false
  });

  const lastScrollRef = useRef({ y: 0, time: Date.now() });
  const unlockReachedRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const velocityViolationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Protezione unmount per evitare setState su componenti smontati
  const isMountedRef = useRef(true);

  // Segmenta contenuto HTML in blocchi (supporta anche testo puro come lyrics)
  const segmentedBlocks = useMemo(() => {
    if (!contentHtml.trim()) return [];
    
    let processedHtml = contentHtml;
    
    // Se il contenuto non ha tag HTML (es. lyrics Spotify), wrappalo in paragrafi
    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(contentHtml);
    if (!hasHtmlTags) {
      // Dividi per doppi newline (paragrafi) o singoli newline (versi)
      const paragraphs = contentHtml
        .split(/\n\s*\n/)
        .filter(p => p.trim())
        .map(p => `<p>${p.trim().replace(/\n/g, '<br/>')}</p>`);
      
      // Se non ci sono doppi newline, dividi per singoli
      if (paragraphs.length <= 1) {
        const lines = contentHtml.split('\n').filter(l => l.trim());
        // Raggruppa linee in blocchi di ~4-6 versi per lyrics
        const chunks: string[] = [];
        for (let i = 0; i < lines.length; i += 5) {
          const chunk = lines.slice(i, i + 5).join('<br/>');
          if (chunk.trim()) {
            chunks.push(`<p>${chunk}</p>`);
          }
        }
        processedHtml = chunks.join('');
      } else {
        processedHtml = paragraphs.join('');
      }
    }

    // Use DOMParser instead of innerHTML to prevent XSS attacks
    const parser = new DOMParser();
    const doc = parser.parseFromString(processedHtml, 'text/html');
    const elements = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, pre, ul, ol');
    const newBlocks: ContentBlock[] = [];

    elements.forEach((el, index) => {
      const html = el.outerHTML;
      const text = el.textContent || '';
      const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;

      // Calcola dwell time richiesto
      const baseDwell = config.minDwellBaseMs;
      const wordDwell = (words / 100) * config.dwellPer100wMs;
      const requiredDwellMs = Math.min(
        Math.max(baseDwell, wordDwell),
        config.maxDwellMs
      );

      newBlocks.push({
        id: `block-${index}`,
        index,
        html,
        text,
        words,
        isRead: false,
        coverage: 0,
        dwellMs: 0,
        requiredDwellMs,
        isVisible: false
      });
    });

    return newBlocks;
  }, [contentHtml, config]);

  // Inizializza blocchi e gestione mount/unmount
  useEffect(() => {
    isMountedRef.current = true;
    setBlocks(segmentedBlocks);
    unlockReachedRef.current = false;
    startTimeRef.current = Date.now();

    // Telemetria apertura reader
    sendReaderTelemetry({
      type: 'reader_view_opened',
      articleId,
      totalBlocks: segmentedBlocks.length,
      totalWords: segmentedBlocks.reduce((sum, b) => sum + b.words, 0)
    });

    return () => {
      isMountedRef.current = false;
      // Cleanup velocity violation timeout
      if (velocityViolationTimeoutRef.current) {
        clearTimeout(velocityViolationTimeoutRef.current);
      }
    };
  }, [segmentedBlocks, articleId]);

  // IntersectionObserver per coverage tracking
  useEffect(() => {
    if (blocks.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const blockId = entry.target.getAttribute('data-block-id');
          if (!blockId) return;

          setBlocks((prev) =>
            prev.map((block) =>
              block.id === blockId
                ? {
                    ...block,
                    isVisible: entry.isIntersecting,
                    coverage: entry.intersectionRatio,
                    firstSeenAt: block.firstSeenAt || (entry.isIntersecting ? Date.now() : undefined),
                    lastSeenAt: entry.isIntersecting ? Date.now() : block.lastSeenAt
                  }
                : block
            )
          );
        });
      },
      {
        root: containerRef.current,
        threshold: [0, 0.25, 0.5, 0.75, 0.85, 1.0]
      }
    );

    // Osserva tutti i blocchi esistenti
    blockRefs.current.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [blocks.length]);

  // Dwell time tracking (throttled a 100ms)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      
      setBlocks((prev) =>
        prev.map((block) => {
          if (!block.isVisible || block.isRead) return block;

          // Accumula dwell solo se coverage >= threshold
          const canAccumulateDwell = block.coverage >= config.coverageThreshold;
          const newDwellMs = canAccumulateDwell ? block.dwellMs + 100 : block.dwellMs;

          // Controlla se ora è "letto"
          const nowRead =
            newDwellMs >= block.requiredDwellMs &&
            block.coverage >= config.coverageThreshold;

          // Telemetria quando blocco completato
          if (nowRead && !block.isRead) {
            sendReaderTelemetry({
              type: 'reader_block_completed',
              articleId,
              blockId: block.id,
              blockIndex: block.index,
              dwellMs: newDwellMs,
              coverage: block.coverage,
              words: block.words
            });
          }

          return { ...block, dwellMs: newDwellMs, isRead: nowRead };
        })
      );
    }, 100);

    return () => clearInterval(interval);
  }, [articleId, config]);

  // Calcola progress e unlock logic con grace
  useEffect(() => {
    const readCount = blocks.filter((b) => b.isRead).length;
    const totalCount = blocks.length;
    const readRatio = totalCount > 0 ? readCount / totalCount : 0;

    // Applica grace: threshold effettivo ridotto
    const effectiveThreshold = config.unlockThreshold - config.graceRatio;
    const canUnlock = readRatio >= effectiveThreshold;

    setProgress((prev) => ({
      ...prev,
      totalBlocks: totalCount,
      readBlocks: readCount,
      readRatio,
      canUnlock
    }));

    // Telemetria unlock raggiunto (solo una volta)
    if (canUnlock && !unlockReachedRef.current) {
      unlockReachedRef.current = true;
      sendReaderTelemetry({
        type: 'reader_unlock_reached',
        articleId,
        readRatio,
        readBlocks: readCount,
        totalBlocks: totalCount,
        timeMs: Date.now() - startTimeRef.current
      });
    }
  }, [blocks, config, articleId]);

  // Scroll velocity detection
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const now = Date.now();
    const currentY = e.currentTarget.scrollTop;

    const deltaY = Math.abs(currentY - lastScrollRef.current.y);
    const deltaTime = (now - lastScrollRef.current.time) / 1000; // secondi

    const velocity = deltaTime > 0 ? deltaY / deltaTime : 0; // px/s
    const isScrollingTooFast = velocity > config.maxScrollVelocityPxPerSec;

    setProgress((prev) => ({
      ...prev,
      currentScrollVelocity: velocity,
      isScrollingTooFast,
      scrollAttritionActive: isScrollingTooFast
    }));

    // Telemetria violazione velocità (throttled)
    if (isScrollingTooFast) {
      if (velocityViolationTimeoutRef.current) {
        clearTimeout(velocityViolationTimeoutRef.current);
      }

      velocityViolationTimeoutRef.current = setTimeout(() => {
        sendReaderTelemetry({
          type: 'reader_velocity_violation',
          articleId,
          velocity,
          threshold: config.maxScrollVelocityPxPerSec
        });
      }, 500);
    }

    lastScrollRef.current = { y: currentY, time: now };
  };

  const reset = () => {
    setBlocks(segmentedBlocks);
    setProgress({
      totalBlocks: 0,
      readBlocks: 0,
      readRatio: 0,
      canUnlock: false,
      currentScrollVelocity: 0,
      isScrollingTooFast: false,
      scrollAttritionActive: false
    });
    unlockReachedRef.current = false;
    startTimeRef.current = Date.now();
  };

  // Calcola primo blocco incompleto e finestra visibile
  const firstIncompleteIndex = blocks.findIndex(b => !b.isRead);
  const visibleUpToIndex = firstIncompleteIndex === -1 
    ? blocks.length - 1  // Tutti completati
    : Math.min(firstIncompleteIndex + config.visibleAheadBlocks, blocks.length - 1);

  return {
    blocks,
    progress,
    containerRef,
    blockRefs,
    handleScroll,
    reset,
    firstIncompleteIndex,
    visibleUpToIndex
  };
}

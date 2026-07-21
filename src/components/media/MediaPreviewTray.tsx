import { useState, useEffect, useRef, DragEvent } from 'react';
import { X, Loader2, FileText, Mic, AlertCircle, Sparkles, Play, CheckCircle2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MediaPreview {
  id: string;
  type: 'image' | 'video';
  url: string;
  file?: File;
  duration_sec?: number;
  extracted_status?: 'idle' | 'pending' | 'done' | 'failed';
  extracted_text?: string | null;
  extracted_kind?: 'ocr' | 'transcript' | null;
}

interface MediaPreviewTrayProps {
  media: MediaPreview[];
  onRemove: (id: string) => void;
  onRequestTranscription?: (id: string) => void;
  onRequestOCR?: (id: string) => void;
  onRequestBatchExtraction?: () => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  isTranscribing?: boolean;
  isBatchExtracting?: boolean;
  onMediaClick?: (url: string, type: 'image' | 'video') => void;
}

// Hook to generate poster thumbnail from video - uses local file to avoid CORS
const useVideoThumbnail = (videoUrl: string, type: 'image' | 'video', file?: File) => {
  const [poster, setPoster] = useState<string | null>(null);

  useEffect(() => {
    if (type !== 'video') return;

    // Prefer local file to avoid CORS issues with canvas
    const isLocalFile = !!file;
    const videoSrc = file ? URL.createObjectURL(file) : videoUrl;

    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    let hasSeekCompleted = false;
    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      video.pause();
      video.src = '';
      if (isLocalFile) URL.revokeObjectURL(videoSrc);
    };

    const timeout = setTimeout(() => {
      if (!hasSeekCompleted) {
        console.warn('[VideoThumbnail] Timeout - could not generate thumbnail');
        cleanup();
      }
    }, 5000);

    video.onloadeddata = () => {
      if (!hasSeekCompleted && !cleanedUp) {
        video.currentTime = Math.min(0.5, video.duration || 0.5);
      }
    };

    video.onseeked = () => {
      if (hasSeekCompleted || cleanedUp) return;
      hasSeekCompleted = true;
      clearTimeout(timeout);

      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          if (dataUrl.length > 1000) {
            setPoster(dataUrl);
          }
        }
      } catch (err) {
        console.warn('[VideoThumbnail] Failed to generate poster:', err);
      } finally {
        cleanup();
      }
    };

    video.onerror = () => {
      console.warn('[VideoThumbnail] Failed to load video for thumbnail');
      clearTimeout(timeout);
      cleanup();
    };

    video.src = videoSrc;
    video.load();

    return () => {
      clearTimeout(timeout);
      cleanup();
    };
  }, [videoUrl, type, file]);

  return poster;
};

const MediaItem = ({
  item,
  index,
  onRemove,
  onRequestTranscription,
  onRequestOCR,
  isTranscribing,
  aspect,
  isBatchExtracting,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onClick
}: {
  item: MediaPreview;
  index: number;
  onRemove: (id: string) => void;
  onRequestTranscription?: (id: string) => void;
  onRequestOCR?: (id: string) => void;
  isTranscribing?: boolean;
  aspect: '16 / 10' | '4 / 3';
  isBatchExtracting?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onDrop?: (e: DragEvent<HTMLDivElement>) => void;
  onClick?: () => void;
}) => {
  const isVideo = item.type === 'video';
  const isImage = item.type === 'image';

  // Video transcription conditions
  const canTranscribe = isVideo &&
    (item.extracted_status === 'idle' || item.extracted_status === 'failed') &&
    onRequestTranscription &&
    (!item.duration_sec || item.duration_sec <= 180) &&
    !isTranscribing &&
    !isBatchExtracting;
  const isTooLong = isVideo && item.duration_sec && item.duration_sec > 180;

  // Image OCR conditions
  const canOCR = isImage &&
    (item.extracted_status === 'idle' || item.extracted_status === 'failed') &&
    onRequestOCR &&
    !isBatchExtracting;

  const isPending = item.extracted_status === 'pending' || (isTranscribing && item.extracted_kind === 'transcript');
  const isDone = item.extracted_status === 'done';
  const isFailed = item.extracted_status === 'failed';

  const videoPoster = useVideoThumbnail(item.url, item.type, item.file);

  const chipStyle: React.CSSProperties = {
    position: 'absolute',
    left: 8,
    bottom: 8,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '9.5px',
    letterSpacing: '0.08em',
    fontWeight: 600,
    color: '#ffffff',
    background: 'rgba(10,14,22,0.65)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    padding: '5px 9px',
    borderRadius: '999px',
    zIndex: 10,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    border: '1px solid rgba(255,255,255,0.14)'
  };

  return (
    <div
      className={cn(
        "relative w-full",
        isDragging && "opacity-50 scale-95",
        isDragOver && "ring-2 ring-primary",
        "cursor-pointer"
      )}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: aspect,
        background: '#0a0f18',
        overflow: 'hidden'
      }}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      onClick={onClick}
    >
      {/* Media content */}
      {item.type === 'image' ? (
        <img
          src={item.url}
          alt=""
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full relative">
          <video
            src={item.url}
            className="w-full h-full object-cover pointer-events-none"
            poster={videoPoster || undefined}
            preload="metadata"
            playsInline
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '999px',
                background: 'rgba(10,14,22,0.55)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Play className="w-5 h-5 text-white" fill="#ffffff" />
            </div>
          </div>
        </div>
      )}

      {/* Remove button */}
      <button
        type="button"
        aria-label="Rimuovi"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 28,
          height: 28,
          borderRadius: '999px',
          background: 'rgba(10,14,22,0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.2)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRemove(item.id);
        }}
      >
        <X className="w-3.5 h-3.5" color="#ffffff" />
      </button>

      {/* Video: Discrete Transcribe button */}
      {canTranscribe && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRequestTranscription(item.id); }}
          disabled={isTranscribing}
          style={chipStyle}
        >
          <span>🎙 TRASCRIVI</span>
        </button>
      )}

      {/* Image: Discrete OCR button */}
      {canOCR && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRequestOCR(item.id); }}
          style={chipStyle}
        >
          <span>📄 ESTRAI TESTO</span>
        </button>
      )}

      {/* Video: Too long badge */}
      {isVideo && item.extracted_status === 'idle' && isTooLong && (
        <div style={{ ...chipStyle, color: '#FFD464' }}>
          <AlertCircle className="w-3 h-3" />
          <span>MAX 3 MIN</span>
        </div>
      )}

      {/* Processing overlay with spinner */}
      {isPending && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10 gap-1">
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '999px',
            background: 'rgba(10,14,22,0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Loader2 className="w-5 h-5 animate-spin" color="#6db1ff" />
          </div>
        </div>
      )}

      {/* Success badge */}
      {isDone && (
        <div style={{ ...chipStyle, color: '#6EE7B7' }}>
          <CheckCircle2 className="w-3 h-3" />
          <span>{item.extracted_kind === 'ocr' ? 'TESTO ESTRATTO' : 'TRASCRITTO'}</span>
        </div>
      )}

      {/* Failed badge */}
      {isFailed && (
        <div style={{ ...chipStyle, color: '#FFB4B4' }}>
          <AlertCircle className="w-3 h-3" />
          <span>ERRORE</span>
        </div>
      )}
    </div>
  );
};


export const MediaPreviewTray = ({
  media,
  onRemove,
  onRequestTranscription,
  onRequestOCR,
  onRequestBatchExtraction,
  onReorder,
  isTranscribing,
  isBatchExtracting = false,
  onMediaClick
}: MediaPreviewTrayProps) => {
  if (media.length === 0) return null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const isSingleMedia = media.length === 1;
  const hasPendingTranscription = media.some(m => m.extracted_status === 'pending' && m.extracted_kind === 'transcript');
  const hasPendingOCR = media.some(m => m.extracted_status === 'pending' && m.extracted_kind === 'ocr');
  const hasPendingAny = media.some(m => m.extracted_status === 'pending');

  // Count extractable media (images for OCR, videos ≤3min for transcription)
  const extractableImages = media.filter(m =>
    m.type === 'image' &&
    (m.extracted_status === 'idle' || m.extracted_status === 'failed')
  );
  const extractableVideos = media.filter(m =>
    m.type === 'video' &&
    (m.extracted_status === 'idle' || m.extracted_status === 'failed') &&
    (!m.duration_sec || m.duration_sec <= 180)
  );
  const canBatchExtract = (extractableImages.length + extractableVideos.length) > 0 &&
    onRequestBatchExtraction &&
    !isBatchExtracting &&
    !hasPendingAny;

  // Count completed extractions
  const completedCount = media.filter(m => m.extracted_status === 'done').length;
  const totalExtractable = extractableImages.length + extractableVideos.length + completedCount;
  const extractedMediaWithText = media.filter(m => m.extracted_status === 'done' && m.extracted_text);

  // Drag handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, toIndex: number) => {
    e.preventDefault();
    const fromIndex = draggedIndex;

    if (fromIndex !== null && fromIndex !== toIndex && onReorder) {
      onReorder(fromIndex, toIndex);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-3">
      <div
        ref={scrollRef}
        style={{
          borderRadius: '18px',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: isSingleMedia ? '1fr' : '1fr 1fr',
          gap: '8px',
          background: 'transparent'
        }}
      >
        {media.map((item, index) => (
          <MediaItem
            key={item.id}
            item={item}
            index={index}
            onRemove={onRemove}
            onRequestTranscription={onRequestTranscription}
            onRequestOCR={onRequestOCR}
            isTranscribing={isTranscribing}
            aspect={isSingleMedia ? '16 / 10' : '4 / 3'}
            isBatchExtracting={isBatchExtracting}
            isDragging={draggedIndex === index}
            isDragOver={dragOverIndex === index}
            onDragStart={!isSingleMedia ? (e) => handleDragStart(e, index) : undefined}
            onDragOver={!isSingleMedia ? (e) => handleDragOver(e, index) : undefined}
            onDragEnd={!isSingleMedia ? handleDragEnd : undefined}
            onDrop={!isSingleMedia ? (e) => handleDrop(e, index) : undefined}
            onClick={() => onMediaClick?.(item.url, item.type)}
          />
        ))}
      </div>

      {/* Batch extraction button for multi-media */}
      {media.length > 1 && canBatchExtract && (
        <button
          type="button"
          onClick={onRequestBatchExtraction}
          className="w-full active:opacity-80 transition-opacity"
          style={{
            height: '48px',
            borderRadius: '14px',
            border: '1px solid rgba(10,122,255,0.4)',
            background: 'rgba(10,122,255,0.1)',
            color: '#6db1ff',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: '11px',
            letterSpacing: '0.1em',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%'
          }}
        >
          <span>⚡ ANALIZZA TUTTO · {extractableImages.length + extractableVideos.length} {extractableVideos.length > 0 && extractableImages.length === 0 ? 'VIDEO' : 'IMMAGINI'}</span>
        </button>
      )}

      {/* Progress indicator during batch extraction */}
      {isBatchExtracting && hasPendingAny && (
        <div
          className="flex items-center gap-3"
          style={{
            padding: '10px 14px',
            borderRadius: '14px',
            border: '1px solid rgba(10,122,255,0.4)',
            background: 'rgba(10,122,255,0.1)'
          }}
        >
          <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" color="#6db1ff" />
          <div className="flex-1 min-w-0">
            <span
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: '11px',
                letterSpacing: '0.08em',
                color: '#6db1ff',
                fontWeight: 600
              }}
            >
              Analisi in corso... {completedCount}/{totalExtractable}
            </span>
          </div>
        </div>
      )}

      {/* Single media pending status */}
      {!isBatchExtracting && hasPendingAny && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2.5">
          <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-primary">
              {hasPendingTranscription
                ? 'Trascrizione video in corso...'
                : 'Estrazione testo in corso...'}
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Non chiudere questa schermata
            </p>
          </div>
        </div>
      )}

      {/* Success indicator showing total extracted text */}
      {!hasPendingAny && extractedMediaWithText.length > 0 && (
        <div className="flex items-center gap-2 text-emerald-400 text-xs">
          <FileText className="w-4 h-4" />
          <span>
            Testo estratto da {extractedMediaWithText.length} media ({extractedMediaWithText.reduce((acc, m) => acc + (m.extracted_text?.length || 0), 0)} caratteri)
          </span>
        </div>
      )}
    </div>
  );
};

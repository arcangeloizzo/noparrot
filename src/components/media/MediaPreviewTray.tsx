import { useState, useEffect, useRef } from 'react';
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
  isTranscribing?: boolean;
  isBatchExtracting?: boolean;
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
  onRemove,
  onRequestTranscription,
  onRequestOCR,
  isTranscribing,
  isCompact,
  isBatchExtracting
}: {
  item: MediaPreview;
  onRemove: (id: string) => void;
  onRequestTranscription?: (id: string) => void;
  onRequestOCR?: (id: string) => void;
  isTranscribing?: boolean;
  isCompact: boolean;
  isBatchExtracting?: boolean;
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

  // Layout classes based on compact mode
  const containerClasses = isCompact 
    ? "relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted"
    : "relative w-full aspect-video rounded-xl overflow-hidden bg-muted";

  return (
    <div className={containerClasses}>
      {/* Media content */}
      {item.type === 'image' ? (
        <img 
          src={item.url} 
          alt="" 
          className="w-full h-full object-cover" 
        />
      ) : (
        <div className="w-full h-full relative">
          <video 
            src={item.url} 
            className="w-full h-full object-cover"
            poster={videoPoster || undefined}
            preload="metadata"
            playsInline
            muted
          />
          {!videoPoster && (
            <div className="absolute inset-0 bg-muted/60 flex items-center justify-center pointer-events-none">
              <div className={cn(
                "rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center",
                isCompact ? "w-8 h-8" : "w-14 h-14"
              )}>
                <Play className={cn("text-white ml-0.5", isCompact ? "w-4 h-4" : "w-7 h-7")} />
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Remove button */}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className={cn(
          "absolute top-1 right-1 rounded-full z-20 shadow-lg",
          isCompact ? "h-5 w-5 p-0" : "h-7 w-7 p-0 top-2 right-2"
        )}
        onClick={() => onRemove(item.id)}
      >
        <X className={isCompact ? "w-3 h-3" : "w-3.5 h-3.5"} />
      </Button>

      {/* Video: Discrete Transcribe button (only in non-compact single mode) */}
      {!isCompact && canTranscribe && (
        <button
          type="button"
          onClick={() => onRequestTranscription(item.id)}
          disabled={isTranscribing}
          className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2.5 py-1.5 rounded-full flex items-center gap-1.5 z-10 hover:bg-black/80 transition-colors disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-white">Trascrivi</span>
        </button>
      )}

      {/* Image: Discrete OCR button (only in non-compact single mode) */}
      {!isCompact && canOCR && (
        <button
          type="button"
          onClick={() => onRequestOCR(item.id)}
          className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2.5 py-1.5 rounded-full flex items-center gap-1.5 z-10 hover:bg-black/80 transition-colors"
        >
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-white">Estrai testo</span>
        </button>
      )}

      {/* Video: Too long badge (non-compact only) */}
      {!isCompact && isVideo && item.extracted_status === 'idle' && isTooLong && (
        <div className="absolute bottom-2 left-2 bg-amber-500/90 backdrop-blur-sm px-2.5 py-1.5 rounded-full flex items-center gap-1.5 z-10">
          <AlertCircle className="w-4 h-4 text-white" />
          <span className="text-xs font-medium text-white">Max 3 min</span>
        </div>
      )}

      {/* Processing overlay with spinner */}
      {isPending && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10 gap-1">
          <div className={cn(
            "bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center",
            isCompact ? "p-2" : "p-4"
          )}>
            <Loader2 className={cn(
              "animate-spin text-primary",
              isCompact ? "w-4 h-4" : "w-8 h-8"
            )} />
          </div>
          {!isCompact && (
            <div className="text-center px-4">
              <p className="text-white text-sm font-medium">
                {item.extracted_kind === 'transcript' ? 'Trascrizione...' : 'Estrazione...'}
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Success badge - compact shows checkmark only */}
      {isDone && (
        <div className={cn(
          "absolute bg-emerald-500/90 backdrop-blur-sm text-white rounded-full flex items-center z-10",
          isCompact 
            ? "bottom-1 left-1 p-1" 
            : "bottom-2 left-2 text-xs px-2 py-1 gap-1.5"
        )}>
          {isCompact ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <>
              {item.extracted_kind === 'ocr' ? (
                <FileText className="w-3.5 h-3.5" />
              ) : (
                <Mic className="w-3.5 h-3.5" />
              )}
              <span className="font-medium">Pronto</span>
            </>
          )}
        </div>
      )}
      
      {/* Failed badge */}
      {isFailed && (
        <div className={cn(
          "absolute bg-red-500/90 backdrop-blur-sm text-white rounded-full flex items-center z-10",
          isCompact 
            ? "bottom-1 left-1 p-1" 
            : "bottom-2 left-2 text-xs px-2 py-1 gap-1.5"
        )}>
          {isCompact ? (
            <AlertCircle className="w-3 h-3" />
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="font-medium">Errore</span>
            </>
          )}
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
  isTranscribing,
  isBatchExtracting = false
}: MediaPreviewTrayProps) => {
  if (media.length === 0) return null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const isSingleMedia = media.length === 1;
  const isMultiMedia = media.length > 2;
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

  return (
    <div className="space-y-3">
      {/* Single media: large full-width preview */}
      {isSingleMedia ? (
        <MediaItem
          item={media[0]}
          onRemove={onRemove}
          onRequestTranscription={onRequestTranscription}
          onRequestOCR={onRequestOCR}
          isTranscribing={isTranscribing}
          isCompact={false}
          isBatchExtracting={isBatchExtracting}
        />
      ) : isMultiMedia ? (
        /* Multi-media (>2): Horizontal scroll layout */
        <div 
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-none"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {media.map((item) => (
            <MediaItem
              key={item.id}
              item={item}
              onRemove={onRemove}
              onRequestTranscription={onRequestTranscription}
              onRequestOCR={onRequestOCR}
              isTranscribing={isTranscribing}
              isCompact={true}
              isBatchExtracting={isBatchExtracting}
            />
          ))}
        </div>
      ) : (
        /* 2 media: 2-column grid */
        <div className="grid grid-cols-2 gap-2">
          {media.map((item) => (
            <MediaItem
              key={item.id}
              item={item}
              onRemove={onRemove}
              onRequestTranscription={onRequestTranscription}
              onRequestOCR={onRequestOCR}
              isTranscribing={isTranscribing}
              isCompact={false}
              isBatchExtracting={isBatchExtracting}
            />
          ))}
        </div>
      )}
      
      {/* Batch extraction button for multi-media */}
      {media.length > 1 && canBatchExtract && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRequestBatchExtraction}
          className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
        >
          <Zap className="w-4 h-4" />
          <span>
            Analizza tutto ({extractableImages.length > 0 && `${extractableImages.length} immagini`}
            {extractableImages.length > 0 && extractableVideos.length > 0 && ', '}
            {extractableVideos.length > 0 && `${extractableVideos.length} video`})
          </span>
        </Button>
      )}
      
      {/* Progress indicator during batch extraction */}
      {isBatchExtracting && hasPendingAny && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2.5">
          <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-primary">
              Analisi in corso... {completedCount}/{totalExtractable}
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Non chiudere questa schermata
            </p>
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

import { useState, useEffect } from 'react';
import { X, Loader2, FileText, Mic, AlertCircle, Sparkles, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  isTranscribing?: boolean;
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
    // DO NOT use crossOrigin - causes CORS blocking when drawing to canvas
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
    
    // Timeout fallback in case video never loads
    const timeout = setTimeout(() => {
      if (!hasSeekCompleted) {
        console.warn('[VideoThumbnail] Timeout - could not generate thumbnail');
        cleanup();
      }
    }, 5000);
    
    video.onloadeddata = () => {
      if (!hasSeekCompleted && !cleanedUp) {
        // Seek to 0.5 seconds to avoid black frame
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
          // Verify it's not an empty/black image (very short data URL)
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
  isSingleMedia
}: {
  item: MediaPreview;
  onRemove: (id: string) => void;
  onRequestTranscription?: (id: string) => void;
  onRequestOCR?: (id: string) => void;
  isTranscribing?: boolean;
  isSingleMedia: boolean;
}) => {
  const isVideo = item.type === 'video';
  const isImage = item.type === 'image';
  
  // Video transcription conditions
  const canTranscribe = isVideo && 
    item.extracted_status === 'idle' && 
    onRequestTranscription &&
    (!item.duration_sec || item.duration_sec <= 180);
  const isTooLong = isVideo && item.duration_sec && item.duration_sec > 180;
  
  // Image OCR conditions
  const canOCR = isImage && 
    item.extracted_status === 'idle' && 
    onRequestOCR;
  
  const isPending = item.extracted_status === 'pending';
  const isDone = item.extracted_status === 'done';
  const isFailed = item.extracted_status === 'failed';

  // Generate video thumbnail
  // Generate video thumbnail using local file to bypass CORS
  const videoPoster = useVideoThumbnail(item.url, item.type, item.file);

  // Layout classes based on single vs multiple media
  const containerClasses = isSingleMedia 
    ? "relative w-full aspect-video rounded-xl overflow-hidden bg-muted"
    : "relative aspect-square rounded-lg overflow-hidden bg-muted";

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
          {/* Fallback Play icon overlay when no poster available */}
          {!videoPoster && (
            <div className="absolute inset-0 bg-muted/60 flex items-center justify-center pointer-events-none">
              <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-7 h-7 text-white ml-1" />
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Remove button - always visible in top right */}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="absolute top-2 right-2 h-7 w-7 p-0 rounded-full z-20 shadow-lg"
        onClick={() => onRemove(item.id)}
      >
        <X className="w-3.5 h-3.5" />
      </Button>

      {/* Video: Discrete Transcribe button in bottom left (NOT full overlay) */}
      {canTranscribe && (
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

      {/* Image: Discrete OCR button in bottom left */}
      {canOCR && (
        <button
          type="button"
          onClick={() => onRequestOCR(item.id)}
          className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2.5 py-1.5 rounded-full flex items-center gap-1.5 z-10 hover:bg-black/80 transition-colors"
        >
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-white">Estrai testo</span>
        </button>
      )}

      {/* Video: Too long badge (discrete, not full overlay) */}
      {isVideo && item.extracted_status === 'idle' && isTooLong && (
        <div className="absolute bottom-2 left-2 bg-amber-500/90 backdrop-blur-sm px-2.5 py-1.5 rounded-full flex items-center gap-1.5 z-10">
          <AlertCircle className="w-4 h-4 text-white" />
          <span className="text-xs font-medium text-white">Max 3 min</span>
        </div>
      )}

      {/* Processing overlay - semi-transparent so content is still visible */}
      {isPending && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-3">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
        </div>
      )}
      
      {/* Success badge - discrete in corner */}
      {isDone && (
        <div className="absolute bottom-2 left-2 bg-emerald-500/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1.5 z-10">
          {item.extracted_kind === 'ocr' ? (
            <FileText className="w-3.5 h-3.5" />
          ) : (
            <Mic className="w-3.5 h-3.5" />
          )}
          <span className="font-medium">Pronto</span>
        </div>
      )}
      
      {/* Failed badge */}
      {isFailed && (
        <div className="absolute bottom-2 left-2 bg-red-500/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1.5 z-10">
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="font-medium">Errore</span>
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
  isTranscribing 
}: MediaPreviewTrayProps) => {
  if (media.length === 0) return null;

  const isSingleMedia = media.length === 1;

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
          isSingleMedia={true}
        />
      ) : (
        /* Multiple media: 2-column grid with larger thumbnails */
        <div className="grid grid-cols-2 gap-2">
          {media.map((item) => (
            <MediaItem
              key={item.id}
              item={item}
              onRemove={onRemove}
              onRequestTranscription={onRequestTranscription}
              onRequestOCR={onRequestOCR}
              isTranscribing={isTranscribing}
              isSingleMedia={false}
            />
          ))}
        </div>
      )}
      
      {/* Status feedback below preview */}
      {media.some(m => m.extracted_status === 'pending') && (
        <div className="flex items-center gap-2 text-amber-400 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Stiamo mettendo a fuoco il testo...</span>
        </div>
      )}
      
      {media.some(m => m.extracted_status === 'done' && m.extracted_text) && (
        <div className="flex items-center gap-2 text-emerald-400 text-xs">
          <FileText className="w-4 h-4" />
          <span>
            Testo estratto ({media.find(m => m.extracted_text)?.extracted_text?.length || 0} caratteri)
          </span>
        </div>
      )}
    </div>
  );
};

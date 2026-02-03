import { X, Loader2, FileText, Mic, AlertCircle, Sparkles } from 'lucide-react';
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
  isTranscribing?: boolean;
}

export const MediaPreviewTray = ({ 
  media, 
  onRemove, 
  onRequestTranscription,
  isTranscribing 
}: MediaPreviewTrayProps) => {
  if (media.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {media.map((item) => {
          const isVideo = item.type === 'video';
          const canTranscribe = isVideo && 
            item.extracted_status === 'idle' && 
            onRequestTranscription &&
            (!item.duration_sec || item.duration_sec <= 180);
          const isTooLong = isVideo && item.duration_sec && item.duration_sec > 180;
          const isPending = item.extracted_status === 'pending';
          const isDone = item.extracted_status === 'done';
          const isFailed = item.extracted_status === 'failed';

          return (
            <div key={item.id} className="relative flex-shrink-0">
              {/* Thumbnail */}
              <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted">
                {item.type === 'image' ? (
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <video src={item.url} className="w-full h-full object-cover" />
                )}
              </div>
              
              {/* Remove button */}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-1 right-1 h-6 w-6 p-0 rounded-full z-20"
                onClick={() => onRemove(item.id)}
              >
                <X className="w-3 h-3" />
              </Button>

              {/* Video: Transcription Overlay - Idle state */}
              {canTranscribe && (
                <button
                  type="button"
                  onClick={() => onRequestTranscription(item.id)}
                  disabled={isTranscribing}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg z-10 hover:bg-black/60 transition-colors disabled:opacity-50"
                >
                  <div className="flex flex-col items-center gap-1">
                    <Sparkles className="w-5 h-5 text-white" />
                    <span className="text-[10px] text-white font-medium">
                      Trascrivi
                    </span>
                  </div>
                </button>
              )}

              {/* Video: Too long overlay */}
              {isVideo && item.extracted_status === 'idle' && isTooLong && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg z-10">
                  <div className="flex flex-col items-center gap-1">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <span className="text-[10px] text-amber-400 font-medium">
                      Max 3 min
                    </span>
                  </div>
                </div>
              )}

              {/* Video: Processing overlay */}
              {isPending && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg z-10">
                  <div className="flex flex-col items-center gap-1">
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                    <span className="text-[10px] text-white font-medium">
                      {item.extracted_kind === 'ocr' ? 'OCR...' : 'Trascrivo...'}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Success badge */}
              {isDone && (
                <div className="absolute bottom-1 left-1 bg-emerald-500/90 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 z-10">
                  {item.extracted_kind === 'ocr' ? (
                    <FileText className="w-3 h-3" />
                  ) : (
                    <Mic className="w-3 h-3" />
                  )}
                  <span>✓</span>
                </div>
              )}
              
              {/* Failed badge */}
              {isFailed && (
                <div className="absolute bottom-1 left-1 bg-red-500/90 text-white text-xs px-1.5 py-0.5 rounded-full z-10">
                  <AlertCircle className="w-3 h-3" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Extraction status feedback */}
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

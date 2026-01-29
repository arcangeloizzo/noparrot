import { X, Loader2, FileText, Mic, AlertCircle } from 'lucide-react';
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
        {media.map((item) => (
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
              className="absolute top-1 right-1 h-6 w-6 p-0 rounded-full"
              onClick={() => onRemove(item.id)}
            >
              <X className="w-3 h-3" />
            </Button>
            
            {/* Extraction status badge */}
            {item.extracted_status === 'pending' && (
              <div className="absolute bottom-1 left-1 bg-amber-500/90 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{item.extracted_kind === 'ocr' ? 'OCR' : 'Audio'}</span>
              </div>
            )}
            
            {item.extracted_status === 'done' && (
              <div className="absolute bottom-1 left-1 bg-emerald-500/90 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
                {item.extracted_kind === 'ocr' ? (
                  <FileText className="w-3 h-3" />
                ) : (
                  <Mic className="w-3 h-3" />
                )}
                <span>✓</span>
              </div>
            )}
            
            {item.extracted_status === 'failed' && (
              <div className="absolute bottom-1 left-1 bg-red-500/90 text-white text-xs px-1.5 py-0.5 rounded-full">
                <AlertCircle className="w-3 h-3" />
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Video transcription trigger */}
      {media.some(m => m.type === 'video' && m.extracted_status === 'idle') && onRequestTranscription && (
        <div className="flex items-center gap-2">
          {media
            .filter(m => m.type === 'video' && m.extracted_status === 'idle')
            .map(video => (
              <Button
                key={video.id}
                variant="ghost"
                size="sm"
                onClick={() => onRequestTranscription(video.id)}
                disabled={isTranscribing || (video.duration_sec && video.duration_sec > 180)}
                className="text-xs text-muted-foreground"
              >
                <Mic className="w-4 h-4 mr-1" />
                {video.duration_sec && video.duration_sec > 180 
                  ? 'Video troppo lungo' 
                  : 'Genera trascrizione'}
              </Button>
            ))}
        </div>
      )}
      
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

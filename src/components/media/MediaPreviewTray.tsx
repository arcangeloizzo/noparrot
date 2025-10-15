import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MediaPreview {
  id: string;
  type: 'image' | 'video';
  url: string;
  file?: File;
}

interface MediaPreviewTrayProps {
  media: MediaPreview[];
  onRemove: (id: string) => void;
}

export const MediaPreviewTray = ({ media, onRemove }: MediaPreviewTrayProps) => {
  if (media.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {media.map((item) => (
        <div key={item.id} className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted">
          {item.type === 'image' ? (
            <img src={item.url} alt="" className="w-full h-full object-cover" />
          ) : (
            <video src={item.url} className="w-full h-full object-cover" />
          )}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-1 right-1 h-6 w-6 p-0 rounded-full"
            onClick={() => onRemove(item.id)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ))}
    </div>
  );
};

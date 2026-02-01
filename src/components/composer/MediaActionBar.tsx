import { useRef } from 'react';
import { Camera, ImageIcon, Plus, Bold, Italic, Underline } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';

interface MediaActionBarProps {
  onFilesSelected: (files: File[], type: 'image' | 'video') => void;
  disabled?: boolean;
  maxImages?: number;
  maxVideos?: number;
  characterCount?: number;
  maxCharacters?: number;
}

export const MediaActionBar = ({ 
  onFilesSelected, 
  disabled = false,
  maxImages = 4,
  maxVideos = 1,
  characterCount = 0,
  maxCharacters = 3000
}: MediaActionBarProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = (files: File[], type: 'image' | 'video', maxFiles: number) => {
    if (files.length === 0) return;

    const maxSize = type === 'image' ? 25 * 1024 * 1024 : 100 * 1024 * 1024;
    const invalidFiles = files.filter(f => f.size > maxSize);

    if (invalidFiles.length > 0) {
      toast.error(`File troppo grande (max ${type === 'image' ? '25MB' : '100MB'})`);
      return;
    }

    if (files.length > maxFiles) {
      toast.error(`Massimo ${maxFiles} ${type === 'image' ? 'immagini' : 'video'}`);
      return;
    }

    onFilesSelected(files, type);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    validateAndSelect(files, 'image', maxImages);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    validateAndSelect(files, 'video', maxVideos);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Camera can capture either photo or video
    const type = files[0]?.type.startsWith('video/') ? 'video' : 'image';
    validateAndSelect(files, type, 1);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const iconButtonClass = cn(
    "p-2 rounded-full transition-colors",
    "text-zinc-500 hover:text-primary hover:bg-zinc-800/50",
    "disabled:opacity-40 disabled:cursor-not-allowed"
  );

  return (
    <div className="sticky bottom-0 bg-zinc-950 border-t border-zinc-800 px-4 py-2.5 flex items-center justify-between">
      {/* Left: Rich Text placeholders (no logic) */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className={iconButtonClass}
          aria-label="Grassetto"
        >
          <Bold className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={iconButtonClass}
          aria-label="Corsivo"
        >
          <Italic className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={iconButtonClass}
          aria-label="Sottolineato"
        >
          <Underline className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Right: Media Group + Counter */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => {
            haptics.light();
            cameraInputRef.current?.click();
          }}
          disabled={disabled}
          className={iconButtonClass}
          aria-label="Scatta foto/video"
        >
          <Camera className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => {
            haptics.light();
            imageInputRef.current?.click();
          }}
          disabled={disabled}
          className={iconButtonClass}
          aria-label="Galleria immagini"
        >
          <ImageIcon className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => {
            haptics.light();
            videoInputRef.current?.click();
          }}
          disabled={disabled}
          className={iconButtonClass}
          aria-label="Allegati"
        >
          <Plus className="w-5 h-5" strokeWidth={1.5} />
        </button>

        {/* Character counter */}
        {characterCount > 0 && (
          <span className={cn(
            "text-xs tabular-nums ml-3",
            characterCount > 2500 ? "text-amber-500" : "text-zinc-600",
            characterCount >= maxCharacters && "text-destructive"
          )}>
            {characterCount}/{maxCharacters}
          </span>
        )}
      </div>

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        onChange={handleCameraChange}
        className="hidden"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageChange}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoChange}
        className="hidden"
      />
    </div>
  );
};

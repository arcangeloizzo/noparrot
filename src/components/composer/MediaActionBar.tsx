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
  onFormat?: (format: 'bold' | 'italic' | 'underline') => void;
}

export const MediaActionBar = ({ 
  onFilesSelected, 
  disabled = false,
  maxImages = 4,
  maxVideos = 1,
  characterCount = 0,
  maxCharacters = 3000,
  onFormat
}: MediaActionBarProps) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Camera: direct capture (photo/video)
  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const type = files[0]?.type.startsWith('video/') ? 'video' : 'image';
    validateAndSelect(files, type, 1);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Gallery: photo/video picker with multiple support
  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Separate images and videos
    const images = files.filter(f => f.type.startsWith('image/'));
    const videos = files.filter(f => f.type.startsWith('video/'));
    
    // Process images first
    if (images.length > 0) {
      validateAndSelect(images, 'image', maxImages);
    }
    // Then videos
    if (videos.length > 0) {
      validateAndSelect(videos, 'video', maxVideos);
    }
    
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  // Generic files: documents, PDFs, etc.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const file = files[0];
    
    // Determine type from MIME
    if (file.type.startsWith('video/')) {
      validateAndSelect(files, 'video', maxVideos);
    } else if (file.type.startsWith('image/')) {
      validateAndSelect(files, 'image', maxImages);
    } else {
      // Non-media files - treat as image for now (useMediaUpload will handle)
      toast.info('File allegato come documento.');
      validateAndSelect(files, 'image', 1);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Format handler with haptics
  const handleFormat = (format: 'bold' | 'italic' | 'underline') => {
    haptics.light();
    onFormat?.(format);
  };

  const iconButtonClass = cn(
    "p-2 rounded-full transition-colors",
    "text-zinc-500 hover:text-primary hover:bg-zinc-800/50",
    "disabled:opacity-40 disabled:cursor-not-allowed"
  );

  return (
    <div className="sticky bottom-0 bg-zinc-950 border-t border-zinc-800 px-4 py-2.5 flex items-center justify-between">
      {/* Left: Rich Text formatting */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => handleFormat('bold')}
          className={iconButtonClass}
          aria-label="Grassetto"
        >
          <Bold className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => handleFormat('italic')}
          className={iconButtonClass}
          aria-label="Corsivo"
        >
          <Italic className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => handleFormat('underline')}
          className={iconButtonClass}
          aria-label="Sottolineato"
        >
          <Underline className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Right: Media Group + Counter */}
      <div className="flex items-center gap-0.5">
        {/* Camera: direct capture */}
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
        
        {/* Gallery: photo/video picker */}
        <button
          type="button"
          onClick={() => {
            haptics.light();
            galleryInputRef.current?.click();
          }}
          disabled={disabled}
          className={iconButtonClass}
          aria-label="Galleria foto/video"
        >
          <ImageIcon className="w-5 h-5" strokeWidth={1.5} />
        </button>
        
        {/* Files: generic file picker */}
        <button
          type="button"
          onClick={() => {
            haptics.light();
            fileInputRef.current?.click();
          }}
          disabled={disabled}
          className={iconButtonClass}
          aria-label="Scegli file"
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

      {/* Hidden inputs - 3 separate for direct actions */}
      
      {/* Camera: direct capture with environment camera */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        onChange={handleCameraChange}
        className="hidden"
      />
      
      {/* Gallery: photo/video picker with multiple support */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleGalleryChange}
        className="hidden"
      />
      
      {/* Files: generic file picker for documents */}
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};

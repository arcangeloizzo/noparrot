import { useRef } from 'react';
import { Camera, Plus, Bold, Italic, Underline } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';

interface MediaActionBarProps {
  onFilesSelected: (files: File[], type: 'image' | 'video') => void;
  disabled?: boolean;
  /** Maximum total media items (images + videos combined) */
  maxTotalMedia?: number;
  /** Current number of uploaded media items */
  currentMediaCount?: number;
  characterCount?: number;
  maxCharacters?: number;
  onFormat?: (format: 'bold' | 'italic' | 'underline') => void;
  /** Keyboard offset in pixels (for iOS positioning) */
  keyboardOffset?: number;
}

export const MediaActionBar = ({ 
  onFilesSelected, 
  disabled = false,
  maxTotalMedia = 10,
  currentMediaCount = 0,
  characterCount = 0,
  maxCharacters = 3000,
  onFormat,
  keyboardOffset = 0
}: MediaActionBarProps) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = (files: File[]) => {
    if (files.length === 0) return;

    // Check total limit
    const remainingSlots = maxTotalMedia - currentMediaCount;
    if (remainingSlots <= 0) {
      toast.error(`Hai raggiunto il limite di ${maxTotalMedia} media`);
      return;
    }

    // Limit files to remaining slots
    const filesToUpload = files.slice(0, remainingSlots);
    if (filesToUpload.length < files.length) {
      toast.info(`Caricati solo ${filesToUpload.length} file (limite ${maxTotalMedia} media)`);
    }

    // Validate file sizes
    const validFiles: File[] = [];
    for (const file of filesToUpload) {
      const isVideo = file.type.startsWith('video/');
      const maxSize = isVideo ? 100 * 1024 * 1024 : 25 * 1024 * 1024;
      
      if (file.size > maxSize) {
        toast.error(`${file.name}: troppo grande (max ${isVideo ? '100MB' : '25MB'})`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Separate images and videos for callback
    const images = validFiles.filter(f => f.type.startsWith('image/'));
    const videos = validFiles.filter(f => f.type.startsWith('video/'));
    
    if (images.length > 0) onFilesSelected(images, 'image');
    if (videos.length > 0) onFilesSelected(videos, 'video');
  };

  // Camera: direct capture (photo/video)
  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    validateAndSelect(files);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Media picker: shows native iOS action sheet (Libreria foto, Scatta foto, Scegli file)
  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    validateAndSelect(files);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
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
    <div 
      className="bg-zinc-950 border-t border-zinc-800 px-4 py-2.5 flex items-center justify-between relative"
      style={{ 
        paddingBottom: 'max(env(safe-area-inset-bottom, 10px), 10px)',
        // Apply keyboard offset transform for iOS
        transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
        transition: 'transform 0.15s ease-out'
      }}
    >
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
        {/* Camera: direct capture - opens camera directly */}
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
        
        {/* Plus: opens native iOS action sheet */}
        <button
          type="button"
          onClick={() => {
            haptics.light();
            mediaInputRef.current?.click();
          }}
          disabled={disabled}
          className={iconButtonClass}
          aria-label="Aggiungi media"
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
      
      {/* Camera: direct capture with environment camera */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        onChange={handleCameraChange}
        className="hidden"
      />
      
      {/* Media picker: shows native iOS action sheet (Libreria foto, Scatta foto, Scegli file) */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleMediaChange}
        className="hidden"
      />
    </div>
  );
};

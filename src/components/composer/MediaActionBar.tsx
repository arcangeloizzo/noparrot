import { useRef, useState, useEffect } from 'react';
import { Camera, Plus, ImageIcon, Video, FileText, Bold, Italic, Underline, X } from 'lucide-react';
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
  /** Keyboard offset in pixels (for iOS positioning) */
  keyboardOffset?: number;
}

export const MediaActionBar = ({ 
  onFilesSelected, 
  disabled = false,
  maxImages = 4,
  maxVideos = 1,
  characterCount = 0,
  maxCharacters = 3000,
  onFormat,
  keyboardOffset = 0
}: MediaActionBarProps) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const [showMediaMenu, setShowMediaMenu] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMediaMenu) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMediaMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMediaMenu]);

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
    setShowMediaMenu(false);
  };

  // Camera: direct capture (photo/video)
  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const type = files[0]?.type.startsWith('video/') ? 'video' : 'image';
    validateAndSelect(files, type, 1);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Photo gallery: images only (avoids iOS action sheet)
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    validateAndSelect(files, 'image', maxImages);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // Video gallery: videos only (avoids iOS action sheet)
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    validateAndSelect(files, 'video', maxVideos);
    if (videoInputRef.current) videoInputRef.current.value = '';
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

  const menuItemClass = cn(
    "flex items-center gap-3 w-full px-4 py-3 text-left",
    "text-sm text-zinc-200 hover:bg-zinc-800/80 transition-colors",
    "first:rounded-t-xl last:rounded-b-xl"
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
        {/* Camera: direct capture - no menu */}
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
        
        {/* Plus: opens dropdown menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              haptics.light();
              setShowMediaMenu(!showMediaMenu);
            }}
            disabled={disabled}
            className={cn(iconButtonClass, showMediaMenu && "text-primary bg-zinc-800/50")}
            aria-label="Aggiungi media"
            aria-expanded={showMediaMenu}
          >
            {showMediaMenu ? (
              <X className="w-5 h-5" strokeWidth={1.5} />
            ) : (
              <Plus className="w-5 h-5" strokeWidth={1.5} />
            )}
          </button>
          
          {/* Dropdown Menu */}
          {showMediaMenu && (
            <div 
              className={cn(
                "absolute bottom-full right-0 mb-2 w-48",
                "bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl",
                "z-50 overflow-hidden",
                "animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
              )}
            >
              {/* Photo Gallery */}
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  photoInputRef.current?.click();
                }}
                className={menuItemClass}
              >
                <ImageIcon className="w-5 h-5 text-zinc-400" strokeWidth={1.5} />
                <span>Galleria Foto</span>
              </button>
              
              {/* Video Gallery */}
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  videoInputRef.current?.click();
                }}
                className={menuItemClass}
              >
                <Video className="w-5 h-5 text-zinc-400" strokeWidth={1.5} />
                <span>Galleria Video</span>
              </button>
              
              {/* Files/Documents */}
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  fileInputRef.current?.click();
                }}
                className={menuItemClass}
              >
                <FileText className="w-5 h-5 text-zinc-400" strokeWidth={1.5} />
                <span>File/Documenti</span>
              </button>
            </div>
          )}
        </div>

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

      {/* Hidden inputs - 4 separate for direct actions without iOS action sheet */}
      
      {/* Camera: direct capture with environment camera */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        onChange={handleCameraChange}
        className="hidden"
      />
      
      {/* Photo Gallery: images only - bypasses iOS action sheet */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoChange}
        className="hidden"
      />
      
      {/* Video Gallery: videos only - bypasses iOS action sheet */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoChange}
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

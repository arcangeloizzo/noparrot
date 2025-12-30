import { useRef } from 'react';
import { Camera, ImageIcon, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';

interface MediaActionBarProps {
  onFilesSelected: (files: File[], type: 'image' | 'video') => void;
  disabled?: boolean;
  maxImages?: number;
  maxVideos?: number;
}

interface MediaPillProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  gradient: string;
  iconColor: string;
  disabled?: boolean;
}

const MediaPill = ({ icon: Icon, label, onClick, gradient, iconColor, disabled }: MediaPillProps) => (
  <button
    type="button"
    onClick={() => {
      haptics.light();
      onClick();
    }}
    disabled={disabled}
    className={cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-full",
      "transition-all duration-200 ease-out",
      "bg-gradient-to-r backdrop-blur-sm",
      gradient,
      "hover:scale-105 hover:shadow-lg active:scale-95",
      "border border-white/10",
      "disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
    )}
  >
    <Icon className={cn("w-4 h-4", iconColor)} />
    <span className="text-sm font-medium text-foreground">{label}</span>
  </button>
);

export const MediaActionBar = ({ 
  onFilesSelected, 
  disabled = false,
  maxImages = 4,
  maxVideos = 1
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
    validateAndSelect(files, 'image', 1);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-muted/40 via-muted/20 to-muted/40 rounded-2xl backdrop-blur-sm border border-white/5">
      <MediaPill
        icon={Camera}
        label="Scatta"
        onClick={() => cameraInputRef.current?.click()}
        gradient="from-blue-500/20 to-cyan-400/20"
        iconColor="text-blue-400"
        disabled={disabled}
      />
      <MediaPill
        icon={ImageIcon}
        label="Foto"
        onClick={() => imageInputRef.current?.click()}
        gradient="from-purple-500/20 to-pink-400/20"
        iconColor="text-purple-400"
        disabled={disabled}
      />
      <MediaPill
        icon={Video}
        label="Video"
        onClick={() => videoInputRef.current?.click()}
        gradient="from-rose-500/20 to-orange-400/20"
        iconColor="text-rose-400"
        disabled={disabled}
      />

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
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

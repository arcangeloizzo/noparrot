import { useRef } from 'react';
import { ImageIcon, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface MediaUploadButtonProps {
  type: 'image' | 'video';
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export const MediaUploadButton = ({ 
  type, 
  onFilesSelected, 
  maxFiles = 4,
  disabled = false 
}: MediaUploadButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('MediaUploadButton clicked', inputRef.current);
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;
    
    // Validazione dimensione
    const maxSize = type === 'image' ? 25 * 1024 * 1024 : 100 * 1024 * 1024; // 25MB img, 100MB video
    const invalidFiles = files.filter(f => f.size > maxSize);
    
    if (invalidFiles.length > 0) {
      toast({
        title: 'File troppo grande',
        description: `Il file deve essere minore di ${type === 'image' ? '25MB' : '100MB'}`,
        variant: 'destructive'
      });
      return;
    }

    // Validazione numero
    if (files.length > maxFiles) {
      toast({
        title: 'Troppi file',
        description: `Puoi caricare massimo ${maxFiles} ${type === 'image' ? 'immagini' : 'video'}`,
        variant: 'destructive'
      });
      return;
    }

    onFilesSelected(files);
    
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={disabled}
        className="p-2 h-auto hover:bg-primary/10"
      >
        {type === 'image' ? (
          <ImageIcon className="w-5 h-5 text-primary" />
        ) : (
          <Video className="w-5 h-5 text-primary" />
        )}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={type === 'image' ? 'image/*' : 'video/*'}
        multiple={type === 'image'}
        onChange={handleChange}
        className="hidden"
      />
    </>
  );
};

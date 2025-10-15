import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface MediaFile {
  id: string;
  type: 'image' | 'video';
  url: string;
  file?: File;
  mime?: string;
  width?: number;
  height?: number;
  duration_sec?: number;
  thumbnail_url?: string;
}

export const useMediaUpload = () => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<MediaFile[]>([]);

  const uploadMedia = async (files: File[], type: 'image' | 'video'): Promise<MediaFile[]> => {
    if (!user) {
      toast({
        title: 'Accedi per caricare file',
        description: 'Devi essere autenticato',
        variant: 'destructive'
      });
      return [];
    }

    setIsUploading(true);
    const uploaded: MediaFile[] = [];

    try {
      for (const file of files) {
        // Upload file to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const bucketName = type === 'image' ? 'avatars' : 'avatars'; // Usa bucket esistente

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);

        // Get file metadata (width/height for images)
        let width: number | undefined;
        let height: number | undefined;
        let duration_sec: number | undefined;

        if (type === 'image') {
          const img = await createImageBitmap(file);
          width = img.width;
          height = img.height;
        } else if (type === 'video') {
          // Per video, idealmente si estrarrebbe duration, ma per semplicità lo omettiamo
          duration_sec = undefined;
        }

        // Insert into media table
        const { data: mediaData, error: mediaError } = await supabase
          .from('media')
          .insert({
            owner_id: user.id,
            type,
            mime: file.type,
            url: publicUrl,
            width,
            height,
            duration_sec
          })
          .select()
          .single();

        if (mediaError) throw mediaError;

        uploaded.push({
          id: mediaData.id,
          type,
          url: publicUrl,
          file,
          mime: file.type,
          width,
          height,
          duration_sec
        });
      }

      setUploadedMedia(prev => [...prev, ...uploaded]);
      
      toast({
        title: 'File caricati',
        description: `${uploaded.length} file caricati con successo`
      });

      return uploaded;
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Errore caricamento',
        description: 'Impossibile caricare i file',
        variant: 'destructive'
      });
      return [];
    } finally {
      setIsUploading(false);
    }
  };

  const removeMedia = (id: string) => {
    setUploadedMedia(prev => prev.filter(m => m.id !== id));
  };

  const clearMedia = () => {
    setUploadedMedia([]);
  };

  return {
    uploadMedia,
    uploadedMedia,
    removeMedia,
    clearMedia,
    isUploading
  };
};

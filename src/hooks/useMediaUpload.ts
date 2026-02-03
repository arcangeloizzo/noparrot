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
  // Extraction fields
  extracted_status?: 'idle' | 'pending' | 'done' | 'failed';
  extracted_text?: string | null;
  extracted_kind?: 'ocr' | 'transcript' | null;
}

// Estrae la durata di un video
async function getVideoDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(Math.round(video.duration));
    };
    video.onerror = () => {
      resolve(undefined);
    };
    video.src = URL.createObjectURL(file);
  });
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
        const bucketName = 'user-media'; // Bucket con supporto video 100MB

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

        // Get file metadata
        let width: number | undefined;
        let height: number | undefined;
        let duration_sec: number | undefined;

        if (type === 'image') {
          const img = await createImageBitmap(file);
          width = img.width;
          height = img.height;
          console.log(`[useMediaUpload] Image ${width}x${height}`);
        } else if (type === 'video') {
          duration_sec = await getVideoDuration(file);
          console.log(`[useMediaUpload] Video duration: ${duration_sec}s`);
        }

        // Insert into media table - always start with 'idle' status (on-demand extraction)
        const { data: mediaData, error: mediaError } = await supabase
          .from('media')
          .insert({
            owner_id: user.id,
            type,
            mime: file.type,
            url: publicUrl,
            width,
            height,
            duration_sec,
            extracted_status: 'idle',
            extracted_kind: null
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
          duration_sec,
          extracted_status: 'idle',
          extracted_kind: null
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

  // Trigger video transcription manually - returns detailed error info
  const requestTranscription = async (mediaId: string): Promise<{ 
    success: boolean; 
    error?: string; 
    errorCode?: string 
  }> => {
    const media = uploadedMedia.find(m => m.id === mediaId);
    if (!media || media.type !== 'video') {
      return { success: false, error: 'Media non valido', errorCode: 'invalid_media' };
    }
    
    // Already processing or done
    if (media.extracted_status === 'pending' || media.extracted_status === 'done') {
      return { success: false, error: 'Già in elaborazione', errorCode: 'already_processing' };
    }
    
    // Check durata
    if (media.duration_sec && media.duration_sec > 180) {
      toast({
        title: 'Video troppo lungo',
        description: 'La trascrizione è disponibile solo per video fino a 3 minuti',
        variant: 'destructive'
      });
      return { success: false, error: 'Video troppo lungo (max 3 minuti)', errorCode: 'video_too_long' };
    }
    
    // OPTIMISTIC: Update local state FIRST to block UI immediately
    setUploadedMedia(prev => prev.map(m => 
      m.id === mediaId 
        ? { ...m, extracted_status: 'pending' as const, extracted_kind: 'transcript' as const }
        : m
    ));
    
    // Update DB - if this fails the polling will catch the stale state
    const { error: dbError } = await supabase.from('media').update({
      extracted_status: 'pending',
      extracted_kind: 'transcript'
    }).eq('id', mediaId);
    
    if (dbError) {
      console.error('[useMediaUpload] DB update failed:', dbError);
      // Revert local state
      setUploadedMedia(prev => prev.map(m => 
        m.id === mediaId 
          ? { ...m, extracted_status: 'idle' as const, extracted_kind: null }
          : m
      ));
      return { success: false, error: 'Impossibile avviare la trascrizione', errorCode: 'db_error' };
    }
    
    // Trigger transcription - NOW we await to catch immediate errors
    try {
      const { data, error } = await supabase.functions.invoke('extract-media-text', {
        body: { 
          mediaId, 
          mediaUrl: media.url, 
          extractionType: 'transcript',
          durationSec: media.duration_sec
        }
      });
      
      if (error) {
        console.error('[useMediaUpload] Edge function error:', error);
        // Don't revert - edge function might still be processing
        // Let polling handle the final state
        return { success: true }; // Consider it started
      }
      
      if (data?.error) {
        console.error('[useMediaUpload] Edge function returned error:', data.error);
        // Update local state to failed
        setUploadedMedia(prev => prev.map(m => 
          m.id === mediaId 
            ? { ...m, extracted_status: 'failed' as const }
            : m
        ));
        return { 
          success: false, 
          error: data.error, 
          errorCode: data.errorCode || 'transcription_failed' 
        };
      }
      
      return { success: true };
    } catch (err) {
      console.error('[useMediaUpload] Transcription trigger error:', err);
      // Don't immediately mark as failed - edge function might still run
      return { success: true }; // Optimistic - let polling determine final state
    }
  };

  // Trigger image OCR manually (on-demand)
  const requestOCR = async (mediaId: string) => {
    const media = uploadedMedia.find(m => m.id === mediaId);
    if (!media || media.type !== 'image') return false;
    
    // Update state to pending
    setUploadedMedia(prev => prev.map(m => 
      m.id === mediaId 
        ? { ...m, extracted_status: 'pending' as const, extracted_kind: 'ocr' as const }
        : m
    ));
    
    // Update DB
    await supabase.from('media').update({
      extracted_status: 'pending',
      extracted_kind: 'ocr'
    }).eq('id', mediaId);
    
    // Trigger OCR
    try {
      console.log(`[useMediaUpload] Triggering OCR for media ${mediaId}`);
      await supabase.functions.invoke('extract-media-text', {
        body: { 
          mediaId, 
          mediaUrl: media.url, 
          extractionType: 'ocr' 
        }
      });
      return true;
    } catch (err) {
      console.error('[useMediaUpload] OCR trigger error:', err);
      setUploadedMedia(prev => prev.map(m => 
        m.id === mediaId 
          ? { ...m, extracted_status: 'failed' as const }
          : m
      ));
      return false;
    }
  };
  
  // Poll extraction status - only update if DB has progressed beyond local state
  const refreshMediaStatus = async (mediaId: string) => {
    const { data, error } = await supabase
      .from('media')
      .select('extracted_status, extracted_text, extracted_kind, extracted_meta')
      .eq('id', mediaId)
      .single();
    
    if (!error && data) {
      setUploadedMedia(prev => prev.map(m => {
        if (m.id !== mediaId) return m;
        
        // Don't regress from 'pending' to 'idle' (race condition with DB update)
        // Only update if DB shows done/failed OR if we're not pending locally
        const dbStatus = data.extracted_status as MediaFile['extracted_status'];
        const shouldUpdate = 
          dbStatus === 'done' || 
          dbStatus === 'failed' || 
          m.extracted_status !== 'pending';
        
        if (!shouldUpdate) {
          return m; // Keep local pending state
        }
        
        return { 
          ...m, 
          extracted_status: dbStatus,
          extracted_text: data.extracted_text,
          extracted_kind: data.extracted_kind as MediaFile['extracted_kind']
        };
      }));
      return data;
    }
    return null;
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
    isUploading,
    requestTranscription,
    requestOCR,
    refreshMediaStatus
  };
};

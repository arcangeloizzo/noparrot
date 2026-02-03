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

// Heuristica per determinare se un'immagine è probabilmente uno screenshot
function shouldPerformOCR(file: File, width: number, height: number): boolean {
  // 1. Aspect ratio check - screenshot tipici
  const ratio = width / height;
  const screenshotRatios = [
    { min: 0.55, max: 0.65 },   // 9:16 (mobile vertical)
    { min: 1.5, max: 1.9 },     // 3:2, 16:9 (desktop)
    { min: 2.0, max: 2.5 },     // 19.5:9 (mobile moderno)
    { min: 0.7, max: 0.8 },     // 3:4 (tablet)
  ];
  
  const hasScreenshotRatio = screenshotRatios.some(
    r => ratio >= r.min && ratio <= r.max
  );
  
  // 2. Resolution check - screenshot hanno risoluzioni tipiche (aggiornato con dispositivi moderni)
  const typicalWidths = [1080, 1170, 1284, 1290, 1179, 1242, 1440, 1920, 2048, 2436, 2560, 2732, 3024];
  const hasTypicalWidth = typicalWidths.some(w => Math.abs(width - w) < 50);
  
  // 3. File size heuristic - screenshot sono tipicamente > 200KB (supporta JPEG e PNG)
  const isLargeImage = file.size > 200_000;
  
  // 4. PDF sempre OCR
  const isPDF = file.type === 'application/pdf';
  
  if (isPDF) return true;
  
  // Decision: basta 1 indicatore per tentare OCR (fail-open, il costo di falsi positivi è basso)
  const score = [hasScreenshotRatio, hasTypicalWidth, isLargeImage].filter(Boolean).length;
  return score >= 1;
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
        let performOCR = false;

        if (type === 'image') {
          const img = await createImageBitmap(file);
          width = img.width;
          height = img.height;
          // Heuristica OCR
          performOCR = shouldPerformOCR(file, width, height);
          console.log(`[useMediaUpload] Image ${width}x${height}, shouldOCR: ${performOCR}`);
        } else if (type === 'video') {
          duration_sec = await getVideoDuration(file);
          console.log(`[useMediaUpload] Video duration: ${duration_sec}s`);
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
            duration_sec,
            // Se immagine screenshot-like, setta pending per OCR
            extracted_status: performOCR ? 'pending' : 'idle',
            extracted_kind: performOCR ? 'ocr' : null
          })
          .select()
          .single();

        if (mediaError) throw mediaError;

        // Trigger OCR in background (fire and forget) se necessario
        if (performOCR) {
          console.log(`[useMediaUpload] Triggering OCR for media ${mediaData.id}`);
          supabase.functions.invoke('extract-media-text', {
            body: { 
              mediaId: mediaData.id, 
              mediaUrl: publicUrl, 
              extractionType: 'ocr' 
            }
          }).catch(err => {
            console.error('[useMediaUpload] OCR trigger error:', err);
          });
        }

        uploaded.push({
          id: mediaData.id,
          type,
          url: publicUrl,
          file,
          mime: file.type,
          width,
          height,
          duration_sec,
          extracted_status: performOCR ? 'pending' : 'idle',
          extracted_kind: performOCR ? 'ocr' : null
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

  // Trigger video transcription manually
  const requestTranscription = async (mediaId: string) => {
    const media = uploadedMedia.find(m => m.id === mediaId);
    if (!media || media.type !== 'video') return false;
    
    // Check durata
    if (media.duration_sec && media.duration_sec > 180) {
      toast({
        title: 'Video troppo lungo',
        description: 'La trascrizione è disponibile solo per video fino a 3 minuti',
        variant: 'destructive'
      });
      return false;
    }
    
    // Update state to pending
    setUploadedMedia(prev => prev.map(m => 
      m.id === mediaId 
        ? { ...m, extracted_status: 'pending' as const, extracted_kind: 'transcript' as const }
        : m
    ));
    
    // Update DB
    await supabase.from('media').update({
      extracted_status: 'pending',
      extracted_kind: 'transcript'
    }).eq('id', mediaId);
    
    // Trigger transcription
    try {
      await supabase.functions.invoke('extract-media-text', {
        body: { 
          mediaId, 
          mediaUrl: media.url, 
          extractionType: 'transcript',
          durationSec: media.duration_sec
        }
      });
      return true;
    } catch (err) {
      console.error('[useMediaUpload] Transcription trigger error:', err);
      setUploadedMedia(prev => prev.map(m => 
        m.id === mediaId 
          ? { ...m, extracted_status: 'failed' as const }
          : m
      ));
      return false;
    }
  };
  
  // Poll extraction status
  const refreshMediaStatus = async (mediaId: string) => {
    const { data, error } = await supabase
      .from('media')
      .select('extracted_status, extracted_text, extracted_kind, extracted_meta')
      .eq('id', mediaId)
      .single();
    
    if (!error && data) {
      setUploadedMedia(prev => prev.map(m => 
        m.id === mediaId 
          ? { 
              ...m, 
              extracted_status: data.extracted_status as MediaFile['extracted_status'],
              extracted_text: data.extracted_text,
              extracted_kind: data.extracted_kind as MediaFile['extracted_kind']
            }
          : m
      ));
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
    refreshMediaStatus
  };
};

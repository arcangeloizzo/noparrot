
# Implementazione OCR Smart & Whisper Transcription

## Panoramica

Questo piano implementa l'estrazione intelligente di testo da contenuti multimediali caricati dagli utenti:
- **Immagini/PDF**: OCR automatico tramite Gemini Vision (se "screenshot-like")
- **Video**: Trascrizione on-demand tramite OpenAI Whisper (modifica critica al piano originale)

Il sistema è non-blocking: il post si pubblica subito e l'estrazione avviene in background.

---

## Fase 1: Database Migration

### Aggiunta Colonne alla Tabella `media`

```sql
-- Aggiunge colonne per text extraction alla tabella media esistente
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS extracted_text TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS extracted_status TEXT DEFAULT 'idle' 
  CHECK (extracted_status IN ('idle', 'pending', 'done', 'failed'));
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS extracted_kind TEXT 
  CHECK (extracted_kind IN ('ocr', 'transcript'));
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS extracted_meta JSONB;

-- Commento sulla struttura di extracted_meta:
-- { "language": "it", "confidence": 0.95, "chars": 1234, "provider": "gemini-vision" | "whisper-1", "duration_sec": 90 }

-- Indice per query su media con estrazione completata
CREATE INDEX IF NOT EXISTS idx_media_extraction_status 
  ON public.media(extracted_status) WHERE extracted_status = 'done';
```

---

## Fase 2: Edge Function `extract-media-text`

### File: `supabase/functions/extract-media-text/index.ts`

Nuova edge function ibrida che gestisce:
- **OCR (Immagini/PDF)**: Gemini Vision via `LOVABLE_API_KEY` (già disponibile)
- **Trascrizione Video**: OpenAI Whisper via `OPENAI_API_KEY` (da aggiungere)

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_VIDEO_DURATION_SEC = 180; // 3 minuti

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { mediaId, mediaUrl, extractionType, durationSec } = await req.json();
    
    if (!mediaId || !mediaUrl || !extractionType) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    console.log(`[extract-media-text] Starting ${extractionType} for media ${mediaId}`);
    
    // =====================================================
    // OCR VIA GEMINI VISION
    // =====================================================
    if (extractionType === 'ocr') {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: 'Extract ALL text visible in this image. Return ONLY the text content, preserving line breaks and structure. Do not add descriptions or explanations. If no text is found, respond with exactly: NO_TEXT_FOUND' 
              },
              { 
                type: 'image_url', 
                image_url: { url: mediaUrl } 
              }
            ]
          }],
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        console.error(`[extract-media-text] Gemini API error: ${response.status}`);
        await supabase.from('media').update({
          extracted_status: 'failed',
          extracted_meta: { error: `API error ${response.status}`, provider: 'gemini-vision' }
        }).eq('id', mediaId);
        
        return new Response(
          JSON.stringify({ success: false, error: 'OCR failed' }),
          { headers: corsHeaders }
        );
      }

      const data = await response.json();
      const extractedText = data.choices?.[0]?.message?.content || '';
      const isValidText = extractedText && 
                          extractedText.length > 50 && 
                          !extractedText.includes('NO_TEXT_FOUND');

      await supabase.from('media').update({
        extracted_text: isValidText ? extractedText : null,
        extracted_status: isValidText ? 'done' : 'failed',
        extracted_kind: 'ocr',
        extracted_meta: {
          provider: 'gemini-vision',
          chars: extractedText.length,
          language: 'auto'
        }
      }).eq('id', mediaId);

      return new Response(
        JSON.stringify({ 
          success: isValidText, 
          chars: extractedText.length,
          status: isValidText ? 'done' : 'failed'
        }),
        { headers: corsHeaders }
      );
    }
    
    // =====================================================
    // TRASCRIZIONE VIDEO VIA OPENAI WHISPER
    // =====================================================
    if (extractionType === 'transcript') {
      // Check per API key
      if (!openaiApiKey) {
        console.error('[extract-media-text] OPENAI_API_KEY not configured');
        await supabase.from('media').update({
          extracted_status: 'failed',
          extracted_meta: { error: 'Transcription service not configured' }
        }).eq('id', mediaId);
        
        return new Response(
          JSON.stringify({ success: false, error: 'Transcription service not available' }),
          { headers: corsHeaders }
        );
      }
      
      // Check durata video
      if (durationSec && durationSec > MAX_VIDEO_DURATION_SEC) {
        console.log(`[extract-media-text] Video too long: ${durationSec}s > ${MAX_VIDEO_DURATION_SEC}s`);
        await supabase.from('media').update({
          extracted_status: 'failed',
          extracted_meta: { 
            error: 'video_too_long',
            duration_sec: durationSec,
            max_duration_sec: MAX_VIDEO_DURATION_SEC
          }
        }).eq('id', mediaId);
        
        return new Response(
          JSON.stringify({ success: false, error: 'video_too_long' }),
          { headers: corsHeaders }
        );
      }
      
      // Download video file
      console.log('[extract-media-text] Downloading video...');
      const videoResponse = await fetch(mediaUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status}`);
      }
      
      const videoBlob = await videoResponse.blob();
      console.log(`[extract-media-text] Video downloaded: ${videoBlob.size} bytes`);
      
      // Crea FormData per Whisper API
      const formData = new FormData();
      formData.append('file', videoBlob, 'video.mp4');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      
      // Call OpenAI Whisper API
      console.log('[extract-media-text] Calling Whisper API...');
      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: formData,
      });
      
      if (!whisperResponse.ok) {
        const errorText = await whisperResponse.text();
        console.error(`[extract-media-text] Whisper API error: ${whisperResponse.status}`, errorText);
        await supabase.from('media').update({
          extracted_status: 'failed',
          extracted_meta: { error: `Whisper API error ${whisperResponse.status}`, provider: 'whisper-1' }
        }).eq('id', mediaId);
        
        return new Response(
          JSON.stringify({ success: false, error: 'Transcription failed' }),
          { headers: corsHeaders }
        );
      }
      
      const whisperData = await whisperResponse.json();
      const transcript = whisperData.text || '';
      const detectedLanguage = whisperData.language || 'unknown';
      const isValidTranscript = transcript.length > 50;
      
      console.log(`[extract-media-text] Transcript received: ${transcript.length} chars, language: ${detectedLanguage}`);
      
      await supabase.from('media').update({
        extracted_text: isValidTranscript ? transcript : null,
        extracted_status: isValidTranscript ? 'done' : 'failed',
        extracted_kind: 'transcript',
        extracted_meta: {
          provider: 'whisper-1',
          chars: transcript.length,
          language: detectedLanguage,
          duration_sec: durationSec || null
        }
      }).eq('id', mediaId);
      
      return new Response(
        JSON.stringify({ 
          success: isValidTranscript, 
          chars: transcript.length,
          language: detectedLanguage,
          status: isValidTranscript ? 'done' : 'failed'
        }),
        { headers: corsHeaders }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Invalid extraction type' }),
      { status: 400, headers: corsHeaders }
    );
    
  } catch (error) {
    console.error('[extract-media-text] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
```

### Configurazione in `supabase/config.toml`

```toml
[functions.extract-media-text]
verify_jwt = false
```

---

## Fase 3: Modifica `useMediaUpload.ts`

### Aggiunta Heuristica Screenshot e Trigger OCR

```typescript
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
  // Nuovi campi extraction
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
  
  // 2. Resolution check - screenshot hanno risoluzioni tipiche
  const typicalWidths = [1080, 1170, 1284, 1290, 1179, 1242, 1440, 1920, 2560];
  const hasTypicalWidth = typicalWidths.some(w => Math.abs(width - w) < 50);
  
  // 3. File format heuristic - screenshot PNG sono spesso grandi
  const isLikelyPNG = file.type === 'image/png' && file.size > 200_000;
  
  // 4. PDF sempre OCR
  const isPDF = file.type === 'application/pdf';
  
  if (isPDF) return true;
  
  // Decision: almeno 2 su 3 indicatori
  const score = [hasScreenshotRatio, hasTypicalWidth, isLikelyPNG].filter(Boolean).length;
  return score >= 2;
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
        const bucketName = 'avatars'; // Usa bucket esistente

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
        ? { ...m, extracted_status: 'pending', extracted_kind: 'transcript' }
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
          ? { ...m, extracted_status: 'failed' }
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
              extracted_status: data.extracted_status,
              extracted_text: data.extracted_text,
              extracted_kind: data.extracted_kind
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
```

---

## Fase 4: Modifica `MediaPreviewTray.tsx`

### Aggiunta Feedback Visivo Estrazione

```typescript
import { X, Loader2, FileText, Mic, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MediaPreview {
  id: string;
  type: 'image' | 'video';
  url: string;
  file?: File;
  duration_sec?: number;
  extracted_status?: 'idle' | 'pending' | 'done' | 'failed';
  extracted_text?: string | null;
  extracted_kind?: 'ocr' | 'transcript' | null;
}

interface MediaPreviewTrayProps {
  media: MediaPreview[];
  onRemove: (id: string) => void;
  onRequestTranscription?: (id: string) => void;
  isTranscribing?: boolean;
}

export const MediaPreviewTray = ({ 
  media, 
  onRemove, 
  onRequestTranscription,
  isTranscribing 
}: MediaPreviewTrayProps) => {
  if (media.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {media.map((item) => (
          <div key={item.id} className="relative flex-shrink-0">
            {/* Thumbnail */}
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted">
              {item.type === 'image' ? (
                <img src={item.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <video src={item.url} className="w-full h-full object-cover" />
              )}
            </div>
            
            {/* Remove button */}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-1 right-1 h-6 w-6 p-0 rounded-full"
              onClick={() => onRemove(item.id)}
            >
              <X className="w-3 h-3" />
            </Button>
            
            {/* Extraction status badge */}
            {item.extracted_status === 'pending' && (
              <div className="absolute bottom-1 left-1 bg-amber-500/90 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{item.extracted_kind === 'ocr' ? 'OCR' : 'Audio'}</span>
              </div>
            )}
            
            {item.extracted_status === 'done' && (
              <div className="absolute bottom-1 left-1 bg-emerald-500/90 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
                {item.extracted_kind === 'ocr' ? (
                  <FileText className="w-3 h-3" />
                ) : (
                  <Mic className="w-3 h-3" />
                )}
                <span>✓</span>
              </div>
            )}
            
            {item.extracted_status === 'failed' && (
              <div className="absolute bottom-1 left-1 bg-red-500/90 text-white text-xs px-1.5 py-0.5 rounded-full">
                <AlertCircle className="w-3 h-3" />
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Video transcription trigger */}
      {media.some(m => m.type === 'video' && m.extracted_status === 'idle') && onRequestTranscription && (
        <div className="flex items-center gap-2">
          {media
            .filter(m => m.type === 'video' && m.extracted_status === 'idle')
            .map(video => (
              <Button
                key={video.id}
                variant="ghost"
                size="sm"
                onClick={() => onRequestTranscription(video.id)}
                disabled={isTranscribing || (video.duration_sec && video.duration_sec > 180)}
                className="text-xs text-muted-foreground"
              >
                <Mic className="w-4 h-4 mr-1" />
                {video.duration_sec && video.duration_sec > 180 
                  ? 'Video troppo lungo' 
                  : 'Genera trascrizione'}
              </Button>
            ))}
        </div>
      )}
      
      {/* Extraction status feedback */}
      {media.some(m => m.extracted_status === 'pending') && (
        <div className="flex items-center gap-2 text-amber-400 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Stiamo mettendo a fuoco il testo...</span>
        </div>
      )}
      
      {media.some(m => m.extracted_status === 'done' && m.extracted_text) && (
        <div className="flex items-center gap-2 text-emerald-400 text-xs">
          <FileText className="w-4 h-4" />
          <span>
            Testo estratto ({media.find(m => m.extracted_text)?.extracted_text?.length || 0} caratteri)
          </span>
        </div>
      )}
    </div>
  );
};
```

---

## Fase 5: Modifica `ComposerModal.tsx`

### Integrazione con Gate e Polling Status

Modifiche chiave da apportare:
1. **Import nuove funzioni** da `useMediaUpload`
2. **Polling status** per media in estrazione
3. **Integrazione con Gate** usando `extracted_text`

```typescript
// Aggiunte all'inizio del file
import { useEffect } from "react";

// Nel componente ComposerModal, modificare l'uso di useMediaUpload:
const { 
  uploadMedia, 
  uploadedMedia, 
  removeMedia, 
  clearMedia, 
  isUploading,
  requestTranscription,
  refreshMediaStatus 
} = useMediaUpload();

const [isTranscribing, setIsTranscribing] = useState(false);

// Polling per media in pending status
useEffect(() => {
  const pendingMedia = uploadedMedia.filter(m => m.extracted_status === 'pending');
  if (pendingMedia.length === 0) return;
  
  const interval = setInterval(() => {
    pendingMedia.forEach(m => refreshMediaStatus(m.id));
  }, 2000); // Poll ogni 2 secondi
  
  return () => clearInterval(interval);
}, [uploadedMedia]);

// Handler per trascrizione video
const handleRequestTranscription = async (mediaId: string) => {
  setIsTranscribing(true);
  try {
    await requestTranscription(mediaId);
    toast.info('Trascrizione in corso...');
  } finally {
    setIsTranscribing(false);
  }
};

// Modifica canPublish per gestire media pending
const hasPendingExtraction = uploadedMedia.some(m => m.extracted_status === 'pending');
const canPublish = !hasPendingExtraction && (
  content.trim().length > 0 || 
  uploadedMedia.length > 0 || 
  !!detectedUrl || 
  !!quotedPost
) && intentWordsMet;

// In MediaPreviewTray, passare nuovi props:
<MediaPreviewTray 
  media={uploadedMedia} 
  onRemove={removeMedia}
  onRequestTranscription={handleRequestTranscription}
  isTranscribing={isTranscribing}
/>
```

---

## Fase 6: Integrazione Gate in `generate-qa/index.ts`

### Nuovo Case per `mediaId`

Aggiungere gestione `mediaId` nel switch per `qaSourceRef`:

```typescript
case 'mediaId': {
  // Fetch extracted text from media table
  const { data: media } = await supabase
    .from('media')
    .select('extracted_text, extracted_status, extracted_kind, extracted_meta')
    .eq('id', qaSourceRef.id)
    .maybeSingle();
  
  if (media?.extracted_status === 'done' && media.extracted_text?.length > 120) {
    serverSideContent = media.extracted_text;
    contentSource = `media_${media.extracted_kind}`;
    console.log(`[generate-qa] ✅ Media text: ${serverSideContent.length} chars via ${media.extracted_kind}`);
  } else if (media?.extracted_status === 'pending') {
    // Estrazione ancora in corso - client deve riprovare
    console.log('[generate-qa] ⏳ Media extraction still pending');
    return new Response(
      JSON.stringify({ pending: true, retryAfterMs: 3000 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } else {
    // Fallback a Intent Gate
    console.log('[generate-qa] ❌ Media extraction failed/insufficient, using intent gate');
    return new Response(
      JSON.stringify({ insufficient_context: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  break;
}
```

### Aggiornare `QASourceRef` Type

In `src/lib/ai-helpers.ts`:

```typescript
export interface QASourceRef {
  kind: 'url' | 'youtubeId' | 'spotifyId' | 'tweetId' | 'mediaId';
  id: string;
  url?: string;
}
```

---

## Fase 7: Configurazione Secret `OPENAI_API_KEY`

Sarà necessario aggiungere la chiave API OpenAI per abilitare Whisper:
- Il sistema richiederà all'utente di configurare `OPENAI_API_KEY` nei secrets
- La trascrizione video sarà disabilitata se la chiave non è presente

---

## Riepilogo Files da Modificare/Creare

| File | Azione | Scopo |
|------|--------|-------|
| Migration SQL | CREARE | Aggiunge colonne a `media` table |
| `supabase/functions/extract-media-text/index.ts` | CREARE | Edge function ibrida OCR + Whisper |
| `supabase/config.toml` | MODIFICARE | Registrare nuova function |
| `src/hooks/useMediaUpload.ts` | MODIFICARE | Heuristica + trigger OCR + transcription |
| `src/components/media/MediaPreviewTray.tsx` | MODIFICARE | UI feedback estrazione |
| `src/components/composer/ComposerModal.tsx` | MODIFICARE | Polling + integrazione gate |
| `supabase/functions/generate-qa/index.ts` | MODIFICARE | Nuovo case `mediaId` |
| `src/lib/ai-helpers.ts` | MODIFICARE | Aggiungere `mediaId` a QASourceRef |

---

## Impatto Atteso

| Scenario | Comportamento |
|----------|---------------|
| Screenshot di articolo | OCR automatico → Gate basato su testo estratto |
| Foto normale (selfie, paesaggio) | Nessun OCR → Intent Gate se vuole condividere |
| Video <3 min | Pulsante "Genera trascrizione" → Gate basato su transcript |
| Video >3 min | Pulsante disabilitato → Intent Gate (30 parole) |
| PDF caricato | OCR automatico → Gate basato su testo |
| Errore estrazione | Nessun blocco UI → Fallback Intent Gate |

---

## Note Tecniche

### Perché Gemini Vision per OCR
- Già disponibile via `LOVABLE_API_KEY`
- Accuracy superiore su screenshot moderni
- Supporta multiple lingue senza configurazione

### Perché OpenAI Whisper per Video
- Più economico di ElevenLabs Scribe
- Accuracy comparabile (~95%)
- Supporta upload diretto video (estrae audio internamente)
- Modello `whisper-1` è veloce e affidabile

### Limiti Cost Control
- OCR: Solo su immagini "screenshot-like" (heuristica)
- Trascrizione: Solo su richiesta esplicita + max 3 minuti
- Rate limit consigliato: Max 10 trascrizioni/utente/giorno (implementabile in futuro)

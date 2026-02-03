
# Piano: Fix Video Preview e OCR On-Demand

## Problemi Identificati

### 1. Video Schermo Nero
Il tag `<video>` in `MediaPreviewTray.tsx` non mostra il primo frame perché:
- `preload="metadata"` carica solo i metadati, non i frame
- Non c'è attributo `poster` né logica per catturare un frame
- I browser mostrano schermo nero finché l'utente non interagisce

### 2. Trascrizione Non Funziona
Dai log dell'edge function `extract-media-text`:
```
ERROR [extract-media-text] Whisper API error: 429
"message": "You exceeded your current quota..."
"code": "insufficient_quota"
```

**Causa**: L'API key OpenAI ha esaurito il credito. Questo è un problema di billing, non di codice.

**Soluzione**: Aggiungere un messaggio utente chiaro quando la trascrizione fallisce per quota esaurita.

### 3. OCR Automatico
In `useMediaUpload.ts`, l'OCR parte automaticamente per le immagini che sembrano screenshot (linee 119-159). L'utente vuole che sia on-demand come per i video.

---

## Modifiche Proposte

### File 1: `src/components/media/MediaPreviewTray.tsx`

**A. Generazione Thumbnail Video (poster)**

Aggiungere logica per catturare il primo frame del video e usarlo come poster:

```typescript
// Nuovo hook per generare poster da video
const useVideoThumbnail = (videoUrl: string, type: 'image' | 'video') => {
  const [poster, setPoster] = useState<string | null>(null);
  
  useEffect(() => {
    if (type !== 'video') return;
    
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    
    video.onloadeddata = () => {
      // Seek a 0.5 secondi per evitare frame nero
      video.currentTime = 0.5;
    };
    
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        setPoster(canvas.toDataURL('image/jpeg', 0.8));
      }
      URL.revokeObjectURL(video.src);
    };
    
    video.onerror = () => {
      console.warn('[VideoThumbnail] Failed to generate poster');
    };
    
    video.src = videoUrl;
    
    return () => {
      URL.revokeObjectURL(video.src);
    };
  }, [videoUrl, type]);
  
  return poster;
};
```

**B. Aggiungere pulsante "Estrai Testo" per immagini**

Mostrare un badge "Estrai testo" per le immagini quando `extracted_status === 'idle'`, simile a "Trascrivi" per i video:

```typescript
// Per immagini: pulsante OCR on-demand
{item.type === 'image' && item.extracted_status === 'idle' && onRequestOCR && (
  <button
    onClick={() => onRequestOCR(item.id)}
    className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2.5 py-1.5 rounded-full flex items-center gap-1.5"
  >
    <FileText className="w-4 h-4 text-primary" />
    <span className="text-xs font-medium text-white">Estrai testo</span>
  </button>
)}
```

### File 2: `src/hooks/useMediaUpload.ts`

**A. Rimuovere OCR automatico**

Cambiare la logica per non triggerare OCR automaticamente:

```typescript
// BEFORE (linee 138-141):
extracted_status: performOCR ? 'pending' : 'idle',
extracted_kind: performOCR ? 'ocr' : null

// AFTER:
extracted_status: 'idle',
extracted_kind: null
```

**B. Rimuovere invocazione automatica edge function (linee 147-159)**

Eliminare il blocco che triggera OCR in background automaticamente.

**C. Aggiungere funzione `requestOCR(mediaId)`**

Nuova funzione simile a `requestTranscription` per triggerare OCR on-demand:

```typescript
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
    await supabase.functions.invoke('extract-media-text', {
      body: { mediaId, mediaUrl: media.url, extractionType: 'ocr' }
    });
    return true;
  } catch (err) {
    console.error('[useMediaUpload] OCR trigger error:', err);
    setUploadedMedia(prev => prev.map(m => 
      m.id === mediaId ? { ...m, extracted_status: 'failed' as const } : m
    ));
    return false;
  }
};
```

### File 3: `src/components/composer/ComposerModal.tsx`

**A. Aggiungere handler per OCR on-demand**

```typescript
// Handler per OCR immagini (simile a handleRequestTranscription)
const handleRequestOCR = async (mediaId: string) => {
  try {
    const success = await requestOCR(mediaId);
    if (success) {
      toast.info('Estrazione testo in corso...');
    }
  } catch (error) {
    toast.error('Errore durante l\'estrazione del testo');
  }
};
```

**B. Passare il nuovo handler a MediaPreviewTray**

```typescript
<MediaPreviewTray
  media={uploadedMedia}
  onRemove={removeMedia}
  onRequestTranscription={handleRequestTranscription}
  onRequestOCR={handleRequestOCR}  // NUOVO
  isTranscribing={isTranscribing}
/>
```

### File 4: `supabase/functions/extract-media-text/index.ts`

**Migliorare messaggi di errore per quota esaurita**

```typescript
// Linee 169-180: aggiungere gestione specifica per 429
if (!whisperResponse.ok) {
  const errorText = await whisperResponse.text();
  let errorData;
  try { errorData = JSON.parse(errorText); } catch {}
  
  const isQuotaError = whisperResponse.status === 429 || 
                       errorData?.error?.code === 'insufficient_quota';
  
  const errorMessage = isQuotaError 
    ? 'Servizio temporaneamente non disponibile'
    : `Transcription failed: ${whisperResponse.status}`;
  
  // ... update DB con errore specifico
}
```

---

## Flusso Aggiornato

### Video
```
1. Upload video → bucket user-media
2. Anteprima con thumbnail generato (primo frame)
3. Badge "Trascrivi" visibile in basso a sinistra
4. Utente clicca → handleRequestTranscription → extract-media-text
5. Spinner overlay durante processing
6. Risultato: badge verde "Pronto" o errore
```

### Immagine
```
1. Upload immagine → bucket user-media
2. Anteprima grande (aspect-video se singola)
3. Badge "Estrai testo" visibile in basso a sinistra
4. Utente clicca → handleRequestOCR → extract-media-text (OCR Gemini)
5. Spinner overlay durante processing
6. Risultato: badge verde "Pronto" o errore
```

---

## File da Modificare

| File | Modifica |
|------|----------|
| `src/components/media/MediaPreviewTray.tsx` | Generazione poster video + pulsante OCR |
| `src/hooks/useMediaUpload.ts` | Rimuovi OCR automatico + aggiungi `requestOCR()` |
| `src/components/composer/ComposerModal.tsx` | Handler `handleRequestOCR` + prop passata |
| `supabase/functions/extract-media-text/index.ts` | Messaggio errore quota migliore |

---

## Note Importanti

- **Whisper Quota**: Il problema attuale della trascrizione e' causato da quota OpenAI esaurita. Il codice funziona, serve ricaricare l'account OpenAI.
- **Flussi Invariati**: YouTube continua a usare sottotitoli nativi, `generate-qa` continua a funzionare con `qaSourceRef: mediaId`.
- **Backward Compatibility**: I media gia' caricati con `extracted_status: 'idle'` funzioneranno normalmente.


# Fix Anteprima Video nel Composer

## Problema
L'hook `useVideoThumbnail` attuale usa `crossOrigin = 'anonymous'` che causa errori CORS quando il browser tenta di disegnare il video su canvas per generare la thumbnail. Il risultato e' uno schermo nero.

## Soluzione

### Modifiche a `src/components/media/MediaPreviewTray.tsx`

**1. Usare il file locale invece dell'URL remoto**

```typescript
// BEFORE (linea 32):
video.crossOrigin = 'anonymous';
video.preload = 'metadata';
...
video.src = videoUrl;

// AFTER:
// Prefer local file to avoid CORS issues with canvas
const isLocalFile = !!file;
const videoSrc = file ? URL.createObjectURL(file) : videoUrl;
// DO NOT use crossOrigin - causes CORS blocking
video.preload = 'auto';
...
video.src = videoSrc;
```

**2. Aggiornare la firma dell'hook per accettare il file**

```typescript
// BEFORE:
const useVideoThumbnail = (videoUrl: string, type: 'image' | 'video')

// AFTER:
const useVideoThumbnail = (videoUrl: string, type: 'image' | 'video', file?: File)
```

**3. Aggiungere cleanup robusto e timeout**

```typescript
let cleanedUp = false;
const cleanup = () => {
  if (cleanedUp) return;
  cleanedUp = true;
  video.pause();
  video.src = '';
  if (isLocalFile) URL.revokeObjectURL(videoSrc);
};

// Timeout fallback
const timeout = setTimeout(() => {
  if (!hasSeekCompleted) cleanup();
}, 5000);
```

**4. Aggiungere fallback con icona Play**

Quando la thumbnail non puo' essere generata, mostrare un overlay con icona Play per indicare che e' un video:

```typescript
{!videoPoster && (
  <div className="absolute inset-0 bg-muted/60 flex items-center justify-center pointer-events-none">
    <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <Play className="w-7 h-7 text-white ml-1" />
    </div>
  </div>
)}
```

**5. Passare il file all'hook nel MediaItem**

```typescript
// BEFORE (linea 107):
const videoPoster = useVideoThumbnail(item.url, item.type);

// AFTER:
const videoPoster = useVideoThumbnail(item.url, item.type, item.file);
```

## Risultato Atteso

- **Con file locale disponibile**: Thumbnail generata correttamente dal primo frame del video
- **Senza file locale o in caso di errore**: Overlay con icona Play visibile, l'utente capisce che e' un video caricato

## File da Modificare

| File | Modifica |
|------|----------|
| `src/components/media/MediaPreviewTray.tsx` | Hook thumbnail con file locale + fallback Play icon |

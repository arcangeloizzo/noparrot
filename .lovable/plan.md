

# Piano: Miglioramento Anteprima Media nel Composer

## Problema Attuale

Dallo screenshot condiviso emergono due problemi principali:

1. **Thumbnail troppo piccole**: 96x96px sono insufficienti per capire cosa si e' caricato
2. **Overlay "Trascrivi" copre tutto il video**: L'utente non vede il contenuto e non capisce se il video e' stato caricato
3. **Video mostra schermo nero**: Il tag `<video>` senza `poster` o frame iniziale appare nero

---

## Soluzione Proposta

### Modifiche UI in `MediaPreviewTray.tsx`

**1. Thumbnail piu' grandi e layout migliorato**
- Singolo media: anteprima grande (aspect-ratio 16:9, larghezza piena)
- Multipli media: griglia 2 colonne con thumbnail piu' grandi (120x120 o piu')

**2. Overlay trascrizione discreto (non copre tutto)**
- Per i video: badge/pulsante in basso a sinistra o angolo, NON full-overlay
- Icona Sparkles + testo "Trascrivi" visibile ma non invasivo
- Il video rimane visibile per confermare l'upload

**3. Generazione thumbnail per video**
- Cattura un frame dal video per mostrare un'anteprima reale
- Fallback: usa il video element con `poster` se disponibile

**4. OCR per immagini**
- Badge discreto per indicare stato OCR (pending/done/failed)
- Non overlay full-screen, solo indicatore compatto

---

## Dettagli Implementativi

### `src/components/media/MediaPreviewTray.tsx`

```text
BEFORE: w-24 h-24 (96px, troppo piccolo)
AFTER:  
  - Singolo: aspect-video w-full (grande, chiaro)
  - Multiplo: grid con thumbnail piu' grandi (min 120px)

BEFORE: overlay inset-0 (copre tutto)
AFTER:  badge/bottone posizionato nell'angolo
```

**Struttura proposta:**

```typescript
// Layout responsivo basato sul numero di media
const isSingleMedia = media.length === 1;

// Per singolo media: anteprima grande
{isSingleMedia && (
  <div className="relative w-full aspect-video rounded-xl overflow-hidden">
    {/* Video/Image a grandezza piena */}
    {/* Pulsante "Trascrivi" come badge in basso */}
  </div>
)}

// Per multipli: griglia compatta ma piu' grande di prima
{!isSingleMedia && (
  <div className="grid grid-cols-2 gap-2">
    {media.map(item => (
      <div className="relative aspect-square rounded-lg overflow-hidden">
        {/* Thumbnail */}
        {/* Badge stato in overlay angolare */}
      </div>
    ))}
  </div>
)}
```

**Pulsante "Trascrivi" discreto:**

```typescript
// Invece di coprire tutto, posizionato in basso
{canTranscribe && (
  <button
    className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm 
               px-2.5 py-1.5 rounded-full flex items-center gap-1.5
               hover:bg-black/80 transition-colors"
  >
    <Sparkles className="w-4 h-4 text-primary" />
    <span className="text-xs font-medium text-white">Trascrivi</span>
  </button>
)}
```

**Stato processing (spinner):**

```typescript
// Overlay leggero che lascia intravedere il contenuto
{isPending && (
  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
    <div className="bg-black/60 rounded-full p-2">
      <Loader2 className="w-5 h-5 animate-spin text-white" />
    </div>
  </div>
)}
```

---

## Flussi Non Impattati

| Flusso | Stato |
|--------|-------|
| Upload video su bucket `user-media` | Invariato |
| Chiamata `extract-media-text` per OCR | Invariato |
| Chiamata `extract-media-text` per Whisper | Invariato |
| `generate-qa` con `qaSourceRef: mediaId` | Invariato |
| Polling status trascrizione | Invariato |
| YouTube link (flusso separato) | Invariato |

---

## File da Modificare

| File | Modifica |
|------|----------|
| `src/components/media/MediaPreviewTray.tsx` | Layout e overlay UI |

---

## Preview Visiva Attesa

**Singolo video caricato:**
```text
+----------------------------------+
|                                  |
|     [Video frame visibile]       |
|                                  |
|  [X]            [✨ Trascrivi]   |
+----------------------------------+
```

**Singolo video in trascrizione:**
```text
+----------------------------------+
|                                  |
|     [Video frame + overlay]      |
|           [🔄 spinner]           |
|                                  |
+----------------------------------+
```

**Multipli media:**
```text
+----------------+  +----------------+
|                |  |                |
|   [Immagine]   |  |   [Video]      |
|          [X]   |  |  [✨] [X]      |
+----------------+  +----------------+
```


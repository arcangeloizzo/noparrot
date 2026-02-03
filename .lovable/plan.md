

# Piano: Carousel Multi-Media per Post

## Panoramica

Implementare un sistema di caricamento e visualizzazione multi-media (max 10 file) con:
- Upload misto immagini/video nel Composer
- Estrazione collettiva OCR/Trascrizione con indicatori individuali per ogni file
- Visualizzazione carousel nel Feed con snap-scroll e indicatori
- Sincronizzazione MediaViewer ↔ Feed

---

## Contesto Attuale

### Database
- Tabella `post_media` con colonne: `id`, `post_id`, `media_id`, `order_idx`, `created_at`
- Tabella `media` con campi `extracted_text`, `extracted_status`, `extracted_kind`

### Componenti Esistenti
- **MediaActionBar**: limiti attuali di max 4 immagini + 1 video
- **MediaPreviewTray**: griglia 2 colonne, bottoni OCR/Trascrivi singoli per ogni media
- **MediaGallery**: griglia statica (NO carousel)
- **MediaViewer**: supporta navigazione multi-media con frecce e swipe
- **useMediaUpload**: upload singolo o batch, estrazione singola

---

## Modifiche Tecniche

### 1. MediaActionBar - Aumentare Limiti

**File**: `src/components/composer/MediaActionBar.tsx`

Modifiche:
- `maxImages: 4 → 10`
- `maxVideos: 1 → 10`
- Aggiungere validazione combinata: totale media ≤ 10
- Messaggio toast aggiornato per limite combinato

### 2. MediaPreviewTray - Layout Orizzontale + Batch Extraction con Indicatori Individuali

**File**: `src/components/media/MediaPreviewTray.tsx`

Modifiche strutturali:
- Layout orizzontale scrollabile per >2 media (mantiene griglia per ≤2)
- Miniature compatte (80x80px) con scroll-x
- Bottone "Analizza tutto" centrato sotto le miniature
- **Nuovo**: Ogni miniatura mostra spinner/progresso individuale durante l'estrazione batch

Nuova prop interface:
```typescript
interface MediaPreviewTrayProps {
  media: MediaPreview[];
  onRemove: (id: string) => void;
  onRequestTranscription?: (id: string) => void;
  onRequestOCR?: (id: string) => void;
  onRequestBatchExtraction?: () => void;  // NUOVO
  isTranscribing?: boolean;
  batchExtractionStatus?: Map<string, 'pending' | 'done' | 'failed'>;  // NUOVO
}
```

Layout visivo per multi-media:
```text
┌────────────────────────────────────────────────────────────┐
│ ← [📷🔄][📹🔄][📷✓][📷⏳][📹⏳] →  scroll orizzontale    │
│      ✕     ✕     ✕     ✕     ✕                            │
└────────────────────────────────────────────────────────────┘
│        [⚡ Analizza tutto (3 immagini, 2 video)]          │
└────────────────────────────────────────────────────────────┘

Legenda icone overlay su ogni miniatura:
🔄 = spinner animato (in corso)
✓ = checkmark verde (completato)
⏳ = in attesa nella coda
```

Ogni `MediaItem` mostrerà:
- Spinner overlay al centro quando il suo `extracted_status === 'pending'`
- Badge "Pronto" verde quando `extracted_status === 'done'`
- Badge "Errore" rosso quando `extracted_status === 'failed'`

### 3. useMediaUpload - Estrazione Batch

**File**: `src/hooks/useMediaUpload.ts`

Nuovi metodi:
```typescript
// Avvia estrazione parallela per tutti i media
requestBatchExtraction: () => Promise<void>

// Ottieni testo aggregato da tutti i media estratti (in ordine)
getAggregatedExtractedText: () => string
```

Logica `requestBatchExtraction`:
1. Filtra media che necessitano estrazione (status !== 'done')
2. Per ogni media, imposta `extracted_status: 'pending'` localmente
3. Aggiorna DB per tutti in parallelo
4. Chiama Edge Function per ogni media in parallelo (`Promise.allSettled`)
5. Il polling esistente aggiornerà lo stato di ciascuno individualmente

Logica `getAggregatedExtractedText`:
```typescript
// Ordina per order_idx e concatena
const texts = uploadedMedia
  .filter(m => m.extracted_text)
  .sort((a, b) => (a.order_idx ?? 0) - (b.order_idx ?? 0))
  .map((m, i) => `[Media ${i + 1} - ${m.type === 'video' ? 'Video' : 'Immagine'}] ${m.extracted_text}`)
  .join('\n\n');
```

### 4. ComposerModal - Gate con Testo Aggregato

**File**: `src/components/composer/ComposerModal.tsx`

Modifiche in `handlePublish`:
1. Se `uploadedMedia.length > 0`:
   - Verifica se almeno un media ha `extracted_text`
   - Se sì: usa `getAggregatedExtractedText()` per il Gate SOURCE_ONLY (3 domande)
   - La logica rimane identica a quella esistente per singolo media

Modifiche in `gateStatus`:
- Conta media con estrazione completata
- Label dinamica: "Gate OCR (3 media)" o "Gate trascrizione (2 video)"

### 5. MediaGallery - Trasformazione in Carousel

**File**: `src/components/media/MediaGallery.tsx`

Refactor completo da griglia statica a carousel:

```typescript
interface MediaGalleryProps {
  media: Media[];
  onClick?: (media: Media, index: number) => void;
  initialIndex?: number;                    // NUOVO: per sync con Viewer
  onIndexChange?: (index: number) => void;  // NUOVO: callback cambio slide
}
```

Struttura CSS:
```css
/* Container carousel */
.carousel-container {
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

/* Ogni slide */
.carousel-slide {
  flex: 0 0 100%;
  scroll-snap-align: center;
}
```

Elementi UI:
- Contatore numerico in alto a destra (es. "1/5")
- Dots indicatori centrati in basso
- Touch swipe nativo iOS/Android
- Video: mostra poster, play button overlay

Layout visivo:
```text
┌────────────────────────────────────────┐
│                                 [1/5]  │
│                                        │
│        [    MEDIA SLIDE    ]           │
│                                        │
│              ● ○ ○ ○ ○                 │
└────────────────────────────────────────┘
```

### 6. MediaViewer - Sincronizzazione Bidirezionale

**File**: `src/components/media/MediaViewer.tsx`

Modifiche:
```typescript
interface MediaViewerProps {
  media: Media[];
  initialIndex?: number;
  onClose: (finalIndex?: number) => void;  // MODIFICATO: ritorna indice finale
  postActions?: PostActions;
}
```

- Quando l'utente chiude il Viewer, passa `currentIndex` al callback `onClose`
- Questo permette al Feed di sincronizzare il carousel alla stessa posizione

### 7. ImmersivePostCard - Integrazione Carousel + Sync

**File**: `src/components/feed/ImmersivePostCard.tsx`

Modifiche:
- Usare nuovo `MediaGallery` con props `initialIndex` e `onIndexChange`
- Gestire stato `carouselIndex` per sincronizzazione
- Callback `onMediaViewerClose` aggiorna `carouselIndex`

```typescript
const [carouselIndex, setCarouselIndex] = useState(0);

// Quando apre MediaViewer
const handleMediaClick = (media, index) => {
  setSelectedMediaIndex(index);
};

// Quando chiude MediaViewer
const handleMediaViewerClose = (finalIndex?: number) => {
  if (finalIndex !== undefined) {
    setCarouselIndex(finalIndex);
  }
  setSelectedMediaIndex(null);
};
```

---

## Flusso Utente Completo

### Composer (Upload & Analisi)
```text
1. Utente clicca + e seleziona 5 immagini + 2 video
2. MediaPreviewTray mostra 7 miniature orizzontali scrollabili
3. Utente clicca "Analizza tutto (5 immagini, 2 video)"
4. Ogni miniatura mostra immediatamente uno spinner individuale
5. Man mano che ogni estrazione completa:
   - Lo spinner diventa checkmark verde ✓
   - Toast breve: "3/7 completati..."
6. Al completamento totale: banner "Testo estratto (3450 caratteri)"
7. Utente clicca Pubblica
8. Gate SOURCE_ONLY con 3 domande sul testo aggregato
9. Superato il gate → post pubblicato con tutti i media
```

### Feed (Visualizzazione)
```text
1. Post con 7 media mostra carousel con dots e contatore "1/7"
2. Swipe orizzontale per navigare tra le slide
3. Tap su slide → apre MediaViewer full-screen a quella posizione
4. Scorrimento nel Viewer → aggiorna contatore interno
5. Chiusura Viewer → carousel nel feed si sincronizza alla stessa slide
```

---

## File Coinvolti

| File | Azione | Priorità |
|------|--------|----------|
| `src/components/composer/MediaActionBar.tsx` | Modifica limiti (4+1 → 10 totali) | Alta |
| `src/components/media/MediaPreviewTray.tsx` | Refactor layout + indicatori individuali | Alta |
| `src/hooks/useMediaUpload.ts` | Aggiungere batch extraction + aggregazione | Alta |
| `src/components/media/MediaGallery.tsx` | Refactor completo → Carousel snap-scroll | Alta |
| `src/components/media/MediaViewer.tsx` | Aggiungere callback `onClose(finalIndex)` | Media |
| `src/components/feed/ImmersivePostCard.tsx` | Integrazione carousel + stato sync | Media |
| `src/components/composer/ComposerModal.tsx` | Gate con testo aggregato | Alta |

---

## Vincoli Rispettati

✅ **Focalizzazione Media**: tutte le modifiche riguardano solo componenti media  
✅ **No Regression**: Gate Link/Reshare/Commenti non toccati  
✅ **Deepgram**: configurazione Edge Function esistente mantenuta  
✅ **UI Globale**: ExpandableText e FullTextModal non modificati  
✅ **On-Demand**: "Analizza tutto" è azione esplicita dell'utente  
✅ **Indicatori Individuali**: ogni miniatura mostra il proprio stato di elaborazione

---

## Considerazioni Performance

- Carousel usa CSS `scroll-snap` nativo (no JS animation library)
- Lazy loading immagini con `loading="lazy"` 
- Video poster thumbnail già generati al caricamento (hook esistente)
- Batch extraction usa `Promise.allSettled` per parallelismo
- Polling raggruppato esistente (ogni 2s) gestisce tutti i media pending

---

## Dettagli Tecnici Aggiuntivi

### Indicatori di Progresso Individuali

Nella `MediaItem` component, l'overlay di caricamento esistente (righe 229-244 di MediaPreviewTray.tsx) viene già mostrato quando `isPending`. Durante il batch extraction:

1. Ogni media viene impostato a `extracted_status: 'pending'`
2. L'overlay con spinner appare automaticamente su ciascuno
3. Il polling aggiorna lo stato individualmente
4. Quando un media passa a `done`, lo spinner scompare e appare il badge "Pronto"

Miglioramento proposto: aggiungere un piccolo indicatore numerico durante il batch (es. "2/7") per mostrare il progresso globale, oltre allo spinner individuale.

### Ordine Media per Aggregazione

Quando si salvano i media in `post_media`, l'`order_idx` viene assegnato in base all'ordine di upload nell'array `uploadedMedia`. Questo garantisce che l'aggregazione del testo estratto rispetti la sequenza visiva del carousel.


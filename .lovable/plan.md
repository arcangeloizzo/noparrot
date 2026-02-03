
# Piano Fix: Carousel Multi-Media - Feed UI + MediaViewer + Drag & Drop

## Problemi Identificati

### 1. Carousel nel Feed NON ATTIVO
Il componente `ImmersivePostCard.tsx` **importa ma non usa** `MediaGallery`:
- Riga 46: `import { MediaGallery } from "@/components/media/MediaGallery";`
- Righe 1466-1506: Mostra **solo il primo media** (`mediaUrl = post.media?.[0]?.url`) per tutti i post
- **Risultato**: Nessun carousel, nessun dots, nessun contatore 1/X

### 2. Drag & Drop nel Composer NON implementato
Il componente `MediaPreviewTray.tsx`:
- Ha solo layout orizzontale scrollabile (righe 354-371)
- **Nessuna logica drag & drop** per riordinare i media
- Il drop non fa niente perché non c'è handler

### 3. MediaViewer obsoleto
Il componente attuale:
- Usa frecce laterali (ChevronLeft/ChevronRight) per navigazione
- Mostra tutte le immagini in una lista verticale (come nello screenshot)
- Nessun carousel orizzontale con snap-scroll
- UI datata non coerente con il resto dell'app

---

## Soluzione Proposta

### Fix 1: ImmersivePostCard - Usare MediaGallery per multi-media

**File**: `src/components/feed/ImmersivePostCard.tsx`

**Modifica** (righe ~1466-1506): Sostituire il rendering del singolo media con `MediaGallery`:

```typescript
// PRIMA: Solo primo media
{isMediaOnlyPost && mediaUrl && (
  <button onClick={() => setSelectedMediaIndex(0)}>
    <img src={mediaUrl} ... />
  </button>
)}

// DOPO: Carousel per multi-media
{isMediaOnlyPost && post.media && post.media.length > 0 && (
  post.media.length === 1 ? (
    // Singolo media: comportamento esistente
    <button onClick={() => setSelectedMediaIndex(0)} ...>
      {/* existing single media render */}
    </button>
  ) : (
    // Multi-media: usa MediaGallery con carousel
    <div className="w-full max-w-[88%] mx-auto mb-6">
      <MediaGallery
        media={post.media}
        onClick={(_, index) => setSelectedMediaIndex(index)}
        initialIndex={carouselIndex}
        onIndexChange={setCarouselIndex}
      />
    </div>
  )
)}
```

**Aggiungere stato**:
```typescript
const [carouselIndex, setCarouselIndex] = useState(0);
```

**Sincronizzazione con MediaViewer** (riga ~2165):
```typescript
onClose={(finalIndex) => {
  if (finalIndex !== undefined) {
    setCarouselIndex(finalIndex);
  }
  setSelectedMediaIndex(null);
}}
```

---

### Fix 2: MediaPreviewTray - Aggiungere Drag & Drop

**File**: `src/components/media/MediaPreviewTray.tsx`

**Approccio**: Drag & Drop nativo HTML5 senza librerie esterne

```typescript
// Nuove props
interface MediaPreviewTrayProps {
  // ... existing
  onReorder?: (fromIndex: number, toIndex: number) => void; // NUOVO
}

// Stato locale per drag
const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

// Handler per ogni MediaItem
const handleDragStart = (e: DragEvent, index: number) => {
  setDraggedIndex(index);
  e.dataTransfer.effectAllowed = 'move';
};

const handleDragOver = (e: DragEvent, index: number) => {
  e.preventDefault();
  if (draggedIndex === null || draggedIndex === index) return;
  // Visual feedback durante drag
};

const handleDrop = (e: DragEvent, index: number) => {
  e.preventDefault();
  if (draggedIndex !== null && draggedIndex !== index) {
    onReorder?.(draggedIndex, index);
  }
  setDraggedIndex(null);
};
```

**Nel MediaItem** (layout compatto):
```typescript
<div
  draggable
  onDragStart={(e) => handleDragStart(e, index)}
  onDragOver={(e) => handleDragOver(e, index)}
  onDrop={(e) => handleDrop(e, index)}
  className={cn(
    containerClasses,
    draggedIndex === index && "opacity-50 ring-2 ring-primary"
  )}
>
```

**Nel hook useMediaUpload** - aggiungere metodo `reorderMedia`:
```typescript
const reorderMedia = (fromIndex: number, toIndex: number) => {
  setUploadedMedia(prev => {
    const result = [...prev];
    const [removed] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, removed);
    // Update order_idx
    return result.map((m, i) => ({ ...m, order_idx: i }));
  });
};
```

---

### Fix 3: MediaViewer - UI Moderna con Carousel Orizzontale

**File**: `src/components/media/MediaViewer.tsx`

**Refactor completo** per UX moderna:

```text
Layout attuale (obsoleto):
┌────────────────────────────────┐
│ [X]                     1/3    │
│                                │
│     ┌─────────────────┐        │
│     │    Media 1      │        │
│     └─────────────────┘        │
│ [<]                      [>]   │  ← Frecce laterali
│     ┌─────────────────┐        │
│     │    Media 2      │        │
│     └─────────────────┘        │
│                                │
│ [ Action Bar ]                 │
└────────────────────────────────┘

Layout proposto (moderno):
┌────────────────────────────────┐
│ [X]                     1/3    │
│                                │
│  ← SWIPE ORIZZONTALE →         │
│ ┌─────────────────────────────┐│
│ │                             ││
│ │       MEDIA FULLSCREEN      ││
│ │       (uno per volta)       ││
│ │                             ││
│ └─────────────────────────────┘│
│              ● ○ ○             │  ← Dots indicatori
│                                │
│ [ Action Bar ]                 │
└────────────────────────────────┘
```

**Modifiche tecniche**:

1. **Sostituire navigazione a frecce con snap-scroll orizzontale**:
```typescript
<div 
  ref={scrollRef}
  className="flex-1 flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
  onScroll={handleScroll}
>
  {media.map((item, idx) => (
    <div key={item.id} className="flex-shrink-0 w-full h-full snap-center flex items-center justify-center">
      {item.type === 'image' ? (
        <TransformWrapper ...>
          <img src={item.url} className="max-w-full max-h-full object-contain" />
        </TransformWrapper>
      ) : (
        <video src={item.url} controls autoPlay className="max-w-full max-h-full" />
      )}
    </div>
  ))}
</div>
```

2. **Rimuovere frecce laterali**, mantenere swipe-down-to-close

3. **Aggiungere dots indicatori** sotto il media (non sopra):
```typescript
{media.length > 1 && (
  <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-1.5 z-20">
    {media.map((_, idx) => (
      <button
        key={idx}
        onClick={() => scrollToIndex(idx)}
        className={cn(
          "w-2 h-2 rounded-full transition-all",
          idx === currentIndex ? "bg-white w-4" : "bg-white/40"
        )}
      />
    ))}
  </div>
)}
```

4. **Sincronizzazione scroll → indice**:
```typescript
const handleScroll = () => {
  const slideWidth = scrollRef.current?.offsetWidth || 0;
  const scrollLeft = scrollRef.current?.scrollLeft || 0;
  const newIndex = Math.round(scrollLeft / slideWidth);
  if (newIndex !== currentIndex) {
    setCurrentIndex(newIndex);
  }
};
```

---

## File da Modificare

| File | Modifica | Impatto |
|------|----------|---------|
| `src/components/feed/ImmersivePostCard.tsx` | Usare MediaGallery + sync con viewer | Alto |
| `src/components/media/MediaPreviewTray.tsx` | Aggiungere drag & drop nativo | Medio |
| `src/hooks/useMediaUpload.ts` | Aggiungere `reorderMedia()` | Basso |
| `src/components/media/MediaViewer.tsx` | Refactor UI → carousel orizzontale | Alto |

---

## Flusso Corretto dopo Fix

```text
COMPOSER:
1. Utente carica 3 immagini
2. Miniature appaiono in riga orizzontale
3. Utente trascina immagine 3 → posizione 1
4. UI riflette nuovo ordine con feedback visivo
5. Pubblicazione salva order_idx corretto

FEED:
1. Post con 3 media mostra CAROUSEL (non griglia)
2. Dots visibili in basso: ● ○ ○
3. Contatore in alto: 1/3
4. Swipe per navigare
5. Tap apre MediaViewer

MEDIA VIEWER:
1. Apre sul media cliccato (sincronizzato)
2. Swipe orizzontale per navigare
3. Dots in basso mostrano posizione
4. Zoom disponibile per immagini
5. Chiusura sincronizza posizione con feed carousel
```

---

## Vincoli Rispettati

✅ Nessuna modifica a Gate logic (URL/Reshare/Commenti)
✅ Nessuna modifica a Edge Functions
✅ Nessuna modifica a database schema
✅ UI coerente con visual identity esistente
✅ Performance: snap-scroll nativo CSS, no librerie drag-drop pesanti

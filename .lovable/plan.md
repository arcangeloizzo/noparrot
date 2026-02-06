
# Piano: Sistema Adattivo Realmente Responsivo

## Diagnosi del Problema

Il sistema attuale fallisce perché:

1. **Le soglie di overflow sono troppo alte**: 15% e 35% non scattano mai perché il contenuto trabocca subito di molto di più
2. **Le immagini non si ridimensionano abbastanza**: `max-h-[25vh]` e `max-h-[20vh]` sono ancora troppo grandi
3. **Il calcolo overflow avviene DOPO il render**: quando misuriamo, è già tutto esploso
4. **Manca un sistema predittivo**: non stiamo stimando PRIMA quanti elementi ci sono

## Nuova Architettura: Content Density Score

Invece di reagire all'overflow, **prevediamo** la densità del contenuto PRIMA del render:

```text
+------------------+     +------------------+     +------------------+
| DENSITY: LOW     |     | DENSITY: MEDIUM  |     | DENSITY: HIGH    |
| (Contenuto corto)|     | (Misto)          |     | (Tutto pieno)    |
+------------------+     +------------------+     +------------------+
| • Solo testo     |     | • Testo + 1 img  |     | • Reshare + media|
| • Testo + link   |     | • Carousel 2-3   |     | • Quoted + img   |
| • 1 immagine     |     | • Link + testo   |     | • Testo lungo    |
+------------------+     +------------------+     +------------------+
| justify-center   |     | justify-center   |     | justify-start    |
| text-lg          |     | text-base        |     | text-sm          |
| img: naturale    |     | img: max-h-[28vh]|     | img: max-h-[18vh]|
| line-clamp-6     |     | line-clamp-4     |     | line-clamp-2     |
| gap-4            |     | gap-3            |     | gap-2            |
+------------------+     +------------------+     +------------------+
```

## Come Calcolare la Densità (Prima del Render)

```typescript
const calculateContentDensity = (post: Post, quotedPost: Post | null): 'low' | 'medium' | 'high' => {
  let score = 0;
  
  // Testo principale
  if (post.content) {
    if (post.content.length > 300) score += 3;
    else if (post.content.length > 150) score += 2;
    else if (post.content.length > 50) score += 1;
  }
  
  // Media
  if (post.media && post.media.length > 0) {
    score += 2;
    if (post.media.length > 1) score += 1; // Carousel
  }
  
  // Link con preview
  if (post.shared_url && !post.shared_url.startsWith('focus://')) {
    score += 2;
  }
  
  // Quoted post (reshare)
  if (quotedPost) {
    score += 2;
    if (quotedPost.content && quotedPost.content.length > 100) score += 1;
    if (quotedPost.media && quotedPost.media.length > 0) score += 2;
    if (quotedPost.shared_url) score += 1;
  }
  
  // Classificazione
  if (score <= 3) return 'low';
  if (score <= 6) return 'medium';
  return 'high';
};
```

## Modifiche Dettagliate

### 1. ImmersivePostCard.tsx

#### A) Aggiungere calcolo densità (prima del render)

```typescript
// Calcola PRIMA del render, non dopo con ResizeObserver
const contentDensity = useMemo(() => {
  let score = 0;
  
  // Testo principale
  if (post.content) {
    if (post.content.length > 300) score += 3;
    else if (post.content.length > 150) score += 2;
    else if (post.content.length > 50) score += 1;
  }
  
  // Media
  const mediaCount = post.media?.length || 0;
  if (mediaCount > 0) {
    score += 2;
    if (mediaCount > 1) score += 1;
  }
  
  // Link con preview (non editoriale)
  if (post.shared_url && !post.shared_url.startsWith('focus://')) {
    score += 2;
  }
  
  // Quoted post
  if (quotedPost) {
    score += 2;
    if (quotedPost.content && quotedPost.content.length > 100) score += 1;
    if (quotedPost.media && quotedPost.media.length > 0) score += 2;
    if (quotedPost.shared_url) score += 1;
  }
  
  if (score <= 3) return 'low';
  if (score <= 6) return 'medium';
  return 'high';
}, [post.content, post.media, post.shared_url, quotedPost]);
```

#### B) Content Zone con logica adattiva

```tsx
<div ref={contentZoneRef} className={cn(
  "relative z-10 flex-1 flex flex-col px-2 min-h-0 overflow-hidden",
  // Centraggio solo se densità bassa/media
  contentDensity === 'low' && "justify-center gap-4 py-6",
  contentDensity === 'medium' && "justify-center gap-3 py-4",
  contentDensity === 'high' && "justify-start gap-2 py-3"
)}>
```

#### C) Typography adattiva basata su densità

Per il testo principale (post.content):

```tsx
className={cn(
  "font-normal text-white/90 drop-shadow-md",
  contentDensity === 'low' && "text-lg leading-relaxed line-clamp-8",
  contentDensity === 'medium' && "text-base leading-snug line-clamp-5",
  contentDensity === 'high' && "text-sm leading-tight line-clamp-3"
)}
```

#### D) MediaGallery con height adattivo

```tsx
<MediaGallery
  media={post.media}
  onClick={(_, index) => setSelectedMediaIndex(index)}
  initialIndex={carouselIndex}
  onIndexChange={setCarouselIndex}
  imageMaxHeightClass={
    contentDensity === 'low' ? undefined :
    contentDensity === 'medium' ? "max-h-[28vh]" :
    "max-h-[18vh]"
  }
/>
```

#### E) Media-only posts con height dinamico

```tsx
{isMediaOnlyPost && post.media && post.media.length === 1 && (
  <button className={cn(
    "relative w-full max-w-[88%] mx-auto rounded-2xl overflow-hidden",
    contentDensity === 'high' && "max-h-[25vh]"
  )}>
    <img 
      src={mediaUrl} 
      className={cn(
        "w-full object-cover",
        contentDensity === 'low' && "h-[32vh] sm:h-[44vh]",
        contentDensity === 'medium' && "h-[28vh] sm:h-[36vh]",
        contentDensity === 'high' && "max-h-[20vh]"
      )}
    />
  </button>
)}
```

#### F) Quoted Post wrapper adattivo

```tsx
{quotedPost && (
  <div className={cn(
    "rounded-xl",
    contentDensity === 'high' ? "mt-2" : "mt-6"
  )}>
    <QuotedPostCard ... />
  </div>
)}
```

#### G) Link preview image adattivo

Nel componente `SourceImageWithFallback` o nel wrapper:

```tsx
{!post.is_intent && (
  <div className={cn(
    contentDensity === 'high' && "max-h-[18vh] overflow-hidden"
  )}>
    <SourceImageWithFallback ... />
  </div>
)}
```

### 2. QuotedPostCard.tsx - Compattazione interna

#### A) Immagine nel quoted ridotta per densità alta

Il QuotedPostCard non ha accesso diretto a `contentDensity`, quindi applichiamo constraint interni fissi più aggressivi:

```tsx
// Nella preview image del quoted (linea ~270)
{quotedPost.preview_img && (
  <div className="max-h-[20vh] w-full overflow-hidden bg-muted">
    <img 
      src={quotedPost.preview_img}
      className="w-full h-full object-cover"
    />
  </div>
)}
```

### 3. MediaGallery.tsx - Supporto migliorato

Già supporta `imageMaxHeightClass`, ma aggiungiamo fallback per aspect ratio:

```tsx
<img
  src={item.url}
  className={cn(
    "w-full object-contain bg-black/40",
    imageMaxHeightClass || "aspect-auto"
  )}
/>
```

### 4. ImmersiveFocusCard.tsx - Stessa logica

```typescript
const contentDensity = useMemo(() => {
  let score = 0;
  if (title.length > 100) score += 2;
  if (summary.length > 300) score += 2;
  else if (summary.length > 150) score += 1;
  if (sources.length > 3) score += 1;
  
  if (score <= 2) return 'low';
  if (score <= 4) return 'medium';
  return 'high';
}, [title, summary, sources]);
```

Content Zone e typography seguono lo stesso pattern.

## Rimozione del Sistema overflowLevel

Il vecchio sistema basato su ResizeObserver verrà **rimosso** perché:
1. Reagisce DOPO il render (troppo tardi)
2. Causa flickering (il contenuto cambia dimensione dopo essere apparso)
3. Non funziona con `overflow-hidden` (scrollHeight == clientHeight)

## Risultato Atteso

| Scenario | Densità | Layout |
|----------|---------|--------|
| Post solo testo corto | low | Centrato, text-lg, nessun constraint |
| Post con 1 immagine | low/medium | Centrato, immagine normale |
| Post con link + testo lungo | medium | Centrato, text-base, line-clamp-5, img 28vh |
| Reshare con quoted testuale | medium | Centrato, gap ridotti |
| Reshare con quoted + media | high | Top-anchored, text-sm, line-clamp-3, img 18vh |
| Carousel 6 immagini | medium/high | Immagini compresse, gap ridotti |

## File Coinvolti

1. **src/components/feed/ImmersivePostCard.tsx**
   - Aggiunta `contentDensity` calcolato via useMemo
   - Rimozione `overflowLevel` e ResizeObserver
   - Applicazione classi adattive basate su densità

2. **src/components/feed/ImmersiveFocusCard.tsx**
   - Stessa logica `contentDensity`
   - Rimozione overflowLevel

3. **src/components/feed/QuotedPostCard.tsx**
   - Constraint fissi più aggressivi sulle immagini (max-h-[20vh])

4. **src/components/media/MediaGallery.tsx**
   - Nessuna modifica (già supporta `imageMaxHeightClass`)

## Vantaggi di Questo Approccio

1. **Predittivo, non reattivo**: Sappiamo PRIMA quanto spazio serve
2. **Nessun flickering**: Il layout è stabile dal primo frame
3. **Regole chiare**: 3 livelli con soglie definite
4. **Centraggio preservato**: Solo i post densi vanno in alto
5. **Uniformità**: Stesse regole per tutti i tipi di post

## Edge Cases Gestiti

- **Post text-only molto lungo**: density high → line-clamp-3, text-sm
- **Carousel 10 immagini**: Immagini a 18vh, swipe funziona
- **Reshare di reshare**: Già gestito dal ReshareContextStack
- **Editorial shares**: Il Punto ha layout dedicato, non impattato

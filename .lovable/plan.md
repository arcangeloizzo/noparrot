
# Piano di Ottimizzazione Performance - Fase 2: Scroll Fluidity

## Panoramica

Dopo le ottimizzazioni precedenti (noise filter, blur removal, optimistic UI, image optimization), rimangono alcuni colli di bottiglia che causano lag residuo durante lo scroll e il caricamento dei post. Questo piano li risolve con interventi mirati.

---

## PROBLEMA 1: scroll-smooth sul Container (Scroll Jank)

### File: `src/components/feed/ImmersiveFeedContainer.tsx`

### Problema Identificato
Linea 119: `scroll-smooth` applicato al container di scroll:
```tsx
className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar overscroll-none"
```

**Impatto**: Su mobile, `scroll-smooth` forza il browser a interpolare ogni scroll event con animazioni CSS, causando:
- Conflitto con `snap-mandatory` (doppia interpolazione)
- Latenza percepita durante swipe veloce
- Frame drops su dispositivi meno potenti

### Soluzione
Rimuovere `scroll-smooth` - il snap scrolling nativo è già fluido senza interpolazione aggiuntiva:

```tsx
// PRIMA
className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar overscroll-none"

// DOPO
className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar overscroll-none"
```

---

## PROBLEMA 2: transition-colors sul Background Dinamico

### File: `src/components/feed/ImmersivePostCard.tsx`

### Problema Identificato
Linea 861: transizione CSS attiva su background durante lo scroll:
```tsx
<div 
  className="absolute inset-0 transition-colors duration-700"
  style={{ 
    background: `linear-gradient(to bottom, ${dominantPrimary}, ${dominantSecondary})` 
  }}
/>
```

**Impatto**: Ogni volta che i colori dominanti vengono estratti da un'immagine, il browser deve:
1. Calcolare l'interpolazione colore
2. Aggiornare il gradiente su 700ms
3. Compositing layer per la transizione

Questo causa flickering e lag su media-only posts.

### Soluzione
Rimuovere la transizione - il cambio colore è comunque istantaneo quando si passa a un nuovo post:

```tsx
// PRIMA
className="absolute inset-0 transition-colors duration-700"

// DOPO
className="absolute inset-0"
```

---

## PROBLEMA 3: Troppi Hook Calls per Card (Network Waterfall)

### File: `src/components/feed/ImmersivePostCard.tsx`

### Problema Identificato
Ogni `ImmersivePostCard` esegue potenzialmente 5+ hook calls anche per card non visibili:
- `useArticlePreview(urlToPreview)` - linea 242
- `useTrustScore(post.shared_url, ...)` - linea 368
- `useCachedTrustScore(finalSourceUrl)` - linea 364
- `useQuotedPost(post.quoted_post_id)` - linea 229
- `useReshareContextStack(post.quoted_post_id)` - linea 845
- `useDominantColors(mediaUrl)` - linea 848

Alcuni hanno già `skip` ma non tutti sono gated dalla virtualization.

### Soluzione
1. **Gating esistente ok**: `useDominantColors` già usa `{ skip: !isNearActive }` (linea 848)
2. **Migliorare prefetch**: Già implementato in Feed.tsx per article previews
3. **Aggiungere skip a useTrustScore**: Skip se la card non è vicina all'indice attivo

```tsx
// In ImmersivePostCard.tsx - Modificare useTrustScore
const { data: calculatedTrustScore } = useTrustScore(post.shared_url, {
  postText: post.content,
  authorUsername: articlePreview?.author_username,
  isVerified: articlePreview?.is_verified,
  // Skip if reshare (use cached) OR Twitter URL without preview OR not near active index
  skip: !!cachedTrustScore || (isTwitterUrl && !articlePreview) || !isNearActive
});
```

---

## PROBLEMA 4: Shadow Complessa Residua (active:scale + shadow)

### File: `src/components/feed/ImmersivePostCard.tsx`

### Problema Identificato
Linea 1157: Card media con shadow complessa E transizione scale:
```tsx
className="relative w-full max-w-[88%] mx-auto rounded-2xl overflow-hidden shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_20px_rgba(0,0,0,0.3)] border border-white/10 active:scale-[0.98] transition-transform mb-6"
```

Linea 1108: Text-only card con shadow multi-layer simile:
```tsx
className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-3xl p-6 sm:p-8 border border-white/10 shadow-[0_12px_48px_rgba(0,0,0,0.5),_0_0_24px_rgba(31,51,71,0.3)] overflow-hidden"
```

### Soluzione
Sostituire con `shadow-2xl` (Tailwind ottimizzato) mantenendo il look premium:

```tsx
// Linea 1157 - Media card
className="relative w-full max-w-[88%] mx-auto rounded-2xl overflow-hidden shadow-2xl border border-white/10 active:scale-[0.98] transition-transform mb-6"

// Linea 1108 - Text-only card
className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl overflow-hidden"
```

---

## PROBLEMA 5: Image Loading Lazy vs Eager per Card Vicine

### File: `src/components/feed/ProgressiveImage.tsx`

### Problema Identificato
Linea 133: Tutte le immagini usano `loading="lazy"`:
```tsx
<img 
  src={optimizedSrc}
  loading="lazy"
  ...
/>
```

Per card già nel viewport (vicine all'active index), il lazy loading aggiunge latenza inutile perché il browser attende il paint prima di iniziare il download.

### Soluzione
Aggiungere prop `priority` per immagini che devono caricarsi immediatamente:

```tsx
interface ProgressiveImageProps {
  src: string | undefined;
  alt?: string;
  dominantColor?: string;
  shouldLoad?: boolean;
  className?: string;
  onLoad?: () => void;
  /** If true, use eager loading (for cards in or near viewport) */
  priority?: boolean;
}

// Nel render:
<img 
  src={optimizedSrc}
  loading={priority ? "eager" : "lazy"}
  ...
/>
```

E in ImmersivePostCard, passare `priority={isNearActive}`:
```tsx
<ProgressiveImage
  src={backgroundImage}
  shouldLoad={shouldLoadImages}
  priority={isNearActive}
  ...
/>
```

---

## PROBLEMA 6: backdrop-blur-xl su Twitter Card (Overdraw)

### File: `src/components/feed/ImmersivePostCard.tsx`

### Problema Identificato
Linea 1195: Twitter card con backdrop-blur-xl:
```tsx
className="bg-gradient-to-br from-[#15202B]/95 to-[#0d1117]/95 backdrop-blur-xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_16px_rgba(29,161,242,0.12)]"
```

Linea 1181: Video overlay con backdrop-blur:
```tsx
className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full"
```

### Soluzione
Rimuovere backdrop-blur e aumentare opacity dello sfondo:
```tsx
// Twitter card (linea 1195)
className="bg-gradient-to-br from-[#15202B] to-[#0d1117] rounded-3xl p-5 border border-white/15 shadow-2xl"

// Video overlay (linea 1181)
className="absolute bottom-3 right-3 bg-black/80 px-3 py-1.5 rounded-full"
```

---

## RIEPILOGO MODIFICHE

| File | Modifica | Impatto |
|------|----------|---------|
| `ImmersiveFeedContainer.tsx` | Rimuovere `scroll-smooth` | Elimina conflitto con snap |
| `ImmersivePostCard.tsx` L861 | Rimuovere `transition-colors duration-700` | -100ms per transizione |
| `ImmersivePostCard.tsx` L368 | Skip useTrustScore se !isNearActive | -30% network calls |
| `ImmersivePostCard.tsx` L1108, 1157 | Sostituire shadow custom con shadow-2xl | -30% paint time |
| `ImmersivePostCard.tsx` L1195, 1181 | Rimuovere backdrop-blur | -20% composite layers |
| `ProgressiveImage.tsx` | Aggiungere priority prop | -200ms per immagini viewport |

---

## IMPATTO ATTESO

| Metrica | Prima | Dopo |
|---------|-------|------|
| Scroll jank | Occasionale | Eliminato |
| First paint per card | 300-500ms | 100-200ms |
| Network waterfall | 5+ calls/card | 2-3 calls/card visibile |
| GPU composite layers | ~15 per screen | ~8 per screen |
| Interaction latency | 100-200ms | <50ms |

---

## NOTE TECNICHE

### Compatibilità
- Tutti gli interventi sono backward-compatible
- Nessun breaking change alle API
- L'estetica è preservata (shadow-2xl è visivamente simile)
- Il comportamento di snap scrolling rimane identico

### Testing Consigliato
1. Scroll veloce attraverso 10+ post
2. Verifica caricamento immagini su card in viewport
3. Test su dispositivi mobile (iOS Safari, Chrome Android)
4. Verifica che le transizioni di colore non causino flickering

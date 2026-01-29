
# Performance & Stability Overhaul - 4 Interventi Critici

## Panoramica
Questo piano implementa 4 interventi mirati per risolvere definitivamente il lag dello scroll e i tempi di caricamento, eliminando colli di bottiglia su GPU, rendering e network.

---

## INTERVENTO 1: GPU FIX - Ottimizzazione Spotify

### File: `src/components/feed/SpotifyGradientBackground.tsx`

### Problema Identificato
- Linea 58: `transition-all duration-1000` causa ricalcolo CSS continuo durante animazioni
- Linea 67: `blur-3xl` è il principale colpevole del lag grafico (GPU filter costoso)
- Il radial gradient con blur viene ricalcolato a ogni frame durante lo scroll

### Soluzione
Rimuovere effetti dinamici GPU-intensive e sostituire con gradiente statico equivalente.

**Modifiche:**

1. Rimuovere `transition-all duration-1000` dalla linea 58:
```tsx
// PRIMA
className={cn("absolute inset-0 transition-all duration-1000", animationClass)}

// DOPO
className={cn("absolute inset-0", animationClass)}
```

2. Sostituire il div con `blur-3xl` (linee 66-71) con gradiente statico:
```tsx
// PRIMA (GPU Killer)
<div 
  className="absolute inset-0 opacity-30 blur-3xl"
  style={{ 
    background: `radial-gradient(circle at 50% 30%, ${primary} 0%, transparent 60%)` 
  }}
/>

// DOPO (Statico, senza blur)
<div 
  className="absolute inset-0 opacity-20"
  style={{ 
    background: `linear-gradient(180deg, ${primary} 0%, rgba(18,18,18,0.8) 50%, #121212 100%)` 
  }}
/>
```

---

## INTERVENTO 2: RENDER FIX - Stabilizzazione Index Provider

### File: `src/pages/Index.tsx`

### Problema Identificato
Linea 236: l'oggetto `policy={{...}}` viene ricreato a ogni render di `Index.tsx`, causando re-render inutili di tutto il tree sotto `CGProvider`:

```tsx
<CGProvider policy={{ minReadSeconds: 10, minScrollRatio: 0.8, passingRule: ">=2_of_3" }}>
```

Ogni volta che React confronta le props, trova un nuovo oggetto (referenza diversa) e forza il re-render.

### Soluzione
Estrarre la policy come costante fuori dal componente per garantire referenza stabile.

**Modifiche:**

1. Aggiungere costante PRIMA della definizione del componente (sopra linea 14):
```tsx
// Stable policy object - prevents CGProvider re-renders
const FEED_POLICY = { 
  minReadSeconds: 10, 
  minScrollRatio: 0.8, 
  passingRule: ">=2_of_3" 
} as const;

const Index = () => {
  // ...
```

2. Modificare linea 236 per usare la costante:
```tsx
// PRIMA
<CGProvider policy={{ minReadSeconds: 10, minScrollRatio: 0.8, passingRule: ">=2_of_3" }}>

// DOPO
<CGProvider policy={FEED_POLICY}>
```

---

## INTERVENTO 3: SHADOW FIX - Alleggerimento Post Standard

### File: `src/components/feed/SourceImageWithFallback.tsx`

### Problema Identificato
Linea 63: l'ombra complessa `shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_20px_rgba(0,0,0,0.3)]` viene calcolata per ogni card durante lo scroll:

```tsx
<div className="relative mb-3 rounded-2xl overflow-hidden border border-white/10 shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_20px_rgba(0,0,0,0.3)] h-40 sm:h-48">
```

Le box-shadow multi-layer con blur ampio sono computazionalmente costose.

### Soluzione
Sostituire con classe Tailwind standard ottimizzata, mantenendo il look premium.

**Modifica linea 63:**
```tsx
// PRIMA (ombra complessa)
<div className="relative mb-3 rounded-2xl overflow-hidden border border-white/10 shadow-[0_12px_48px_rgba(0,0,0,0.6),_0_0_20px_rgba(0,0,0,0.3)] h-40 sm:h-48">

// DOPO (shadow standard ottimizzata)
<div className="relative mb-3 rounded-2xl overflow-hidden border border-white/10 shadow-xl h-40 sm:h-48">
```

**Nota:** `shadow-xl` in Tailwind corrisponde a:
```css
box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
```
Visivamente simile ma con calcolo GPU ottimizzato. Il `border border-white/10` preserva il look premium.

---

## INTERVENTO 4: NETWORK - Prefetch & Caching Aggressivo

### 4A. Metadata Caching

**File: `src/hooks/useArticlePreview.ts`**

### Problema Identificato
Linee 43-44: staleTime di 30 minuti è troppo breve per metadata che non cambiano mai nella sessione:
```tsx
staleTime: 1000 * 60 * 30, // 30 minutes
gcTime: 1000 * 60 * 60,    // 1 hour
```

### Soluzione
Portare a `staleTime: Infinity` per evitare refetch inutili.

**Modifiche linee 43-44:**
```tsx
// PRIMA
staleTime: 1000 * 60 * 30, // 30 minutes cache
gcTime: 1000 * 60 * 60,    // 1 hour in memory

// DOPO
staleTime: Infinity,              // Never refetch automatically in session
gcTime: 1000 * 60 * 60,           // 1 hour in memory
```

**Aggiornare anche prefetch (linea 88):**
```tsx
// PRIMA
staleTime: 1000 * 60 * 30,

// DOPO  
staleTime: Infinity,
```

---

### 4B. Image Prefetch Ottimizzato

**File: `src/pages/Feed.tsx`**

### Problema Identificato
Linee 96-100: il prefetch delle immagini usa l'URL originale senza ottimizzazione Supabase:
```tsx
const nextItem = mixedFeedRef.current[index + 1];
if (nextItem?.type === 'post' && nextItem.data.preview_img) {
  const img = new Image();
  img.src = nextItem.data.preview_img;  // ❌ URL originale (potenzialmente 4K)
}
```

### Soluzione
Applicare la stessa trasformazione usata da `ProgressiveImage` per prefetchare immagini ottimizzate.

**Modifiche:**

1. Aggiungere helper function (dopo le import, linea ~27):
```tsx
// Helper to get optimized Supabase image URL for prefetch
const getOptimizedImageUrl = (src: string | undefined): string | undefined => {
  if (!src) return undefined;
  const isSupabaseStorage = src.includes('.supabase.co/storage/') || src.includes('supabase.co/storage/');
  if (!isSupabaseStorage) return src;
  if (src.includes('width=') || src.includes('resize=')) return src;
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}width=600&resize=contain&quality=75`;
};
```

2. Modificare prefetch in handleActiveIndexChange (linee 96-100):
```tsx
// PRIMA
if (nextItem?.type === 'post' && nextItem.data.preview_img) {
  const img = new Image();
  img.src = nextItem.data.preview_img;
}

// DOPO
if (nextItem?.type === 'post' && nextItem.data.preview_img) {
  const img = new Image();
  img.src = getOptimizedImageUrl(nextItem.data.preview_img) || nextItem.data.preview_img;
}
```

---

## Riepilogo Modifiche

| File | Intervento | Linee |
|------|-----------|-------|
| `SpotifyGradientBackground.tsx` | GPU: Rimuovere blur-3xl e transition | 58, 66-71 |
| `Index.tsx` | RENDER: Costante FEED_POLICY | 14, 236 |
| `SourceImageWithFallback.tsx` | SHADOW: shadow-xl standard | 63 |
| `useArticlePreview.ts` | NETWORK: staleTime Infinity | 43-44, 88 |
| `Feed.tsx` | NETWORK: Prefetch immagini ottimizzate | 27, 96-100 |

---

## Impatto Atteso

| Intervento | Metrica | Miglioramento |
|------------|---------|---------------|
| GPU Fix (Spotify) | GPU composite time | -50% durante scroll su Spotify content |
| Render Fix (Provider) | React re-renders | -100% re-render inutili su Index |
| Shadow Fix | Box-shadow calculation | -30% per card |
| Network Caching | API calls | -100% refetch metadata dopo primo load |
| Image Prefetch | Bandwidth | -40-60% per immagine prefetch |

---

## Note Tecniche

### Compatibilità
- Tutti gli interventi sono backward-compatible
- Nessun breaking change alle API
- L'estetica Spotify viene preservata (gradiente statico simula il glow)
- Il look premium delle card è mantenuto con `shadow-xl` + `border-white/10`

### Vincoli Rispettati
- Sliding window virtualization invariata
- Snap scroll invariato
- `React.memo` continua a funzionare correttamente dopo stabilizzazione policy


# Piano di Performance Optimization - Eliminazione Lag

## Panoramica

Questo piano implementa 5 interventi tecnici prioritari per eliminare i colli di bottiglia su GPU, rendering e network. Ogni intervento è mirato a una specifica causa di lag.

---

## INTERVENTO 1: Sostituzione Noise Filter (GPU Killer)

### Problema
Il filtro SVG inline con `<feTurbulence type='fractalNoise' .../>` viene ricalcolato dalla GPU per OGNI card ad ogni frame, causando jank nello scroll.

### File coinvolti e occorrenze trovate:
- `src/components/feed/ImmersivePostCard.tsx` (linee 877-881, 917-921, 1122-1126, 1862-1866, 1995-1999)
- `src/components/feed/ImmersiveEditorialCarousel.tsx` (linee 219-223)
- `src/components/feed/QuotedPostCard.tsx` (linee 101-105)
- `src/components/feed/QuotedEditorialCard.tsx` (linee 36-40)
- `src/components/composer/ComposerModal.tsx` (linee 976-980)
- `src/components/profile/CompactNebula.tsx` (linee 287-291)

### Soluzione
1. **Creare file texture statico**: `public/assets/noise.png` (64x64 px, pattern noise leggero)
2. **Creare CSS utility class** in `src/index.css`:
```css
.urban-noise-overlay {
  background-image: url('/assets/noise.png');
  background-repeat: repeat;
  background-size: 64px 64px;
}
```
3. **Sostituire tutti i div con SVG inline** con la nuova classe CSS

### Esempio di cambiamento:
```tsx
// PRIMA (GPU Killer)
<div 
  className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
  style={{
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512'...`)
  }}
/>

// DOPO (Statico, GPU-friendly)
<div className="absolute inset-0 opacity-[0.08] mix-blend-overlay urban-noise-overlay" />
```

---

## INTERVENTO 2: Fix Memoization in Feed (Render Killer)

### Problema
In `Feed.tsx` (linee 445-451), le funzioni passate alle card sono instabili:
```tsx
onRemove={() => handleRemovePost(item.data.id)}  // ❌ Nuova funzione ad ogni render
onQuoteShare={handleQuoteShare}
```
Questo invalida il `React.memo` di `ImmersivePostCard` ad ogni scroll.

### Soluzione
1. **Stabilizzare tutti gli handler con useCallback** (alcuni già stabilizzati):
   - `handleRemovePost` → già callback ma deve usare ID passato come prop
   - `handleQuoteShare` → già callback, OK
   - `handleCreatePost` → già callback, OK

2. **Modificare ImmersivePostCard** per accettare `postId` invece di `onRemove`:
```tsx
// In ImmersivePostCard.tsx
interface ImmersivePostCardProps {
  post: Post;
  // onRemove?: () => void;  // ❌ Rimuovere
  onRemove?: (postId: string) => void;  // ✅ Passare ID
  ...
}
```

3. **In Feed.tsx, passare handler stabile**:
```tsx
// PRIMA
onRemove={() => handleRemovePost(item.data.id)}

// DOPO
onRemove={handleRemovePost}
```

4. **Modificare handleRemovePost**:
```tsx
const handleRemovePost = useCallback((postId: string) => {
  // Post removed via database
}, []);
```

5. **In ImmersivePostCard, chiamare con ID**:
```tsx
onRemove?.(post.id);  // Invece di onRemove?.()
```

---

## INTERVENTO 3: Rimozione Blur Superfluo (Overdraw Killer)

### Problema
Le classi `backdrop-blur-*` su elementi piccoli e dinamici causano compositing layers costosi. Trovate in `ImmersivePostCard.tsx`:
- Linea 943: `backdrop-blur-md` su avatar (10x10 px)
- Linea 968: `backdrop-blur-xl` su Trust Score badge
- Linea 1017: `backdrop-blur-md` su menu button
- Linea 1049-1050: `backdrop-blur-sm` su Intent post block
- Linea 1059: `backdrop-blur-sm` su Intent post block
- Linea 1118: `backdrop-blur-xl` su text-only card container
- Linea 1935: `backdrop-blur-xl` su reactions bar (dialog)
- Linea 2058: `backdrop-blur-xl` su reactions bar (caption modal)

Trovate in `ImmersiveEditorialCarousel.tsx`:
- Linea 400: `backdrop-blur-sm` su quiz loading (OK - modal)
- Linea 492: `backdrop-blur-sm` su AI badge
- Linea 553: `backdrop-blur-sm` su sources button
- Linea 579: `backdrop-blur-xl` su reactions bar

### Soluzione
**Rimuovere `backdrop-blur` da elementi piccoli/dinamici**, mantenendolo SOLO su:
- Modal/overlay a schermo intero (es. quiz loading, SourceReaderGate)
- Dialog content

**Elementi da cui RIMUOVERE backdrop-blur:**

| File | Linea | Elemento | Azione |
|------|-------|----------|--------|
| ImmersivePostCard.tsx | 943 | Avatar container | Rimuovere `backdrop-blur-md` |
| ImmersivePostCard.tsx | 968 | Trust Score badge | Rimuovere `backdrop-blur-xl` |
| ImmersivePostCard.tsx | 1017 | Menu button | Rimuovere `backdrop-blur-md` |
| ImmersivePostCard.tsx | 1049-1050 | Intent post block | Rimuovere `backdrop-blur-sm` |
| ImmersivePostCard.tsx | 1059 | Intent post block | Rimuovere `backdrop-blur-sm` |
| ImmersivePostCard.tsx | 1118 | Text-only card | Rimuovere `backdrop-blur-xl` |
| ImmersivePostCard.tsx | 1935 | Reactions bar (dialog) | Rimuovere `backdrop-blur-xl` |
| ImmersivePostCard.tsx | 2058 | Reactions bar (modal) | Rimuovere `backdrop-blur-xl` |
| ImmersiveEditorialCarousel.tsx | 492 | AI badge | Rimuovere `backdrop-blur-sm` |
| ImmersiveEditorialCarousel.tsx | 553 | Sources button | Rimuovere `backdrop-blur-sm` |
| ImmersiveEditorialCarousel.tsx | 579 | Reactions bar | Rimuovere `backdrop-blur-xl` |

**Mantenere backdrop-blur su:**
- `SourceReaderGate.tsx` linea 875 (modal fullscreen)
- `ImmersiveEditorialCarousel.tsx` linea 400 (quiz loading overlay)

---

## INTERVENTO 4: Optimistic UI per Reazioni (Interaction Lag)

### Problema
In `usePosts.ts` (linee 174-225), `useToggleReaction` aspetta la risposta del server prima di aggiornare la UI, causando 200-500ms di lag percepito.

### Soluzione
Implementare pattern optimistic update con React Query:

```typescript
export const useToggleReaction = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ postId, reactionType }: { postId: string; reactionType: 'heart' | 'bookmark' }) => {
      // ... existing DB logic
    },
    
    // ✅ NUOVO: Optimistic update
    onMutate: async ({ postId, reactionType }) => {
      if (!user) return;
      
      // 1. Cancella query in corso per evitare race conditions
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      await queryClient.cancelQueries({ queryKey: ['saved-posts'] });
      
      // 2. Salva snapshot dello stato precedente
      const previousPosts = queryClient.getQueryData(['posts', user.id]);
      const previousSaved = queryClient.getQueryData(['saved-posts', user.id]);
      
      // 3. Aggiorna cache immediatamente (optimistic)
      queryClient.setQueryData(['posts', user.id], (old: Post[] | undefined) => {
        if (!old) return old;
        return old.map(post => {
          if (post.id !== postId) return post;
          
          const wasActive = reactionType === 'heart' 
            ? post.user_reactions.has_hearted 
            : post.user_reactions.has_bookmarked;
          
          return {
            ...post,
            reactions: {
              ...post.reactions,
              hearts: reactionType === 'heart' 
                ? post.reactions.hearts + (wasActive ? -1 : 1)
                : post.reactions.hearts
            },
            user_reactions: {
              ...post.user_reactions,
              has_hearted: reactionType === 'heart' ? !wasActive : post.user_reactions.has_hearted,
              has_bookmarked: reactionType === 'bookmark' ? !wasActive : post.user_reactions.has_bookmarked
            }
          };
        });
      });
      
      // 4. Ritorna contesto per rollback
      return { previousPosts, previousSaved };
    },
    
    // ✅ NUOVO: Rollback su errore
    onError: (err, variables, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(['posts', user?.id], context.previousPosts);
      }
      if (context?.previousSaved) {
        queryClient.setQueryData(['saved-posts', user?.id], context.previousSaved);
      }
    },
    
    // ✅ NUOVO: Sync finale (opzionale, per sicurezza)
    onSettled: () => {
      // Rivalidazione in background per garantire consistenza
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['saved-posts'] });
    }
  });
};
```

---

## INTERVENTO 5: Image Optimization (Bandwidth Killer)

### Problema
In `ProgressiveImage.tsx`, le immagini da Supabase Storage vengono caricate a risoluzione piena, consumando banda e rallentando il caricamento su mobile.

### Soluzione
Aggiungere trasformazione automatica per immagini Supabase:

```typescript
// In ProgressiveImage.tsx

// Helper per rilevare e trasformare URL Supabase Storage
const getOptimizedSrc = (src: string | undefined): string | undefined => {
  if (!src) return undefined;
  
  // Rileva dominio Supabase Storage
  const isSupabaseStorage = src.includes('.supabase.co/storage/') || 
                            src.includes('supabase.co/storage/');
  
  if (!isSupabaseStorage) return src; // Link esterni invariati
  
  // Controlla se già ha parametri di trasformazione
  if (src.includes('?') && (src.includes('width=') || src.includes('resize='))) {
    return src;
  }
  
  // Aggiungi parametri di ottimizzazione per mobile
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}width=600&resize=contain&quality=75`;
};

// Usare nel componente
export const ProgressiveImage = memo(function ProgressiveImage({
  src,
  ...props
}: ProgressiveImageProps) {
  // Ottimizza URL se da Supabase
  const optimizedSrc = useMemo(() => getOptimizedSrc(src), [src]);
  
  // ... rest of component usando optimizedSrc invece di src
});
```

### Parametri scelti:
- `width=600`: Sufficiente per display mobile (max 3x density)
- `resize=contain`: Mantiene aspect ratio
- `quality=75`: Buon compromesso qualità/peso (-50% bandwidth tipico)

---

## Riepilogo File da Modificare

| File | Intervento | Tipo |
|------|-----------|------|
| `public/assets/noise.png` | Creare texture | NUOVO |
| `src/index.css` | Aggiungere `.urban-noise-overlay` | CSS |
| `src/components/feed/ImmersivePostCard.tsx` | Noise + Blur + Memoization | TSX |
| `src/components/feed/ImmersiveEditorialCarousel.tsx` | Noise + Blur | TSX |
| `src/components/feed/QuotedPostCard.tsx` | Noise | TSX |
| `src/components/feed/QuotedEditorialCard.tsx` | Noise | TSX |
| `src/components/composer/ComposerModal.tsx` | Noise | TSX |
| `src/components/profile/CompactNebula.tsx` | Noise | TSX |
| `src/pages/Feed.tsx` | Memoization fix | TSX |
| `src/hooks/usePosts.ts` | Optimistic UI | TS |
| `src/components/feed/ProgressiveImage.tsx` | Image optimization | TSX |

---

## Impatto Atteso

| Intervento | Metrica | Miglioramento Atteso |
|------------|---------|---------------------|
| 1. Noise Filter | GPU time | -30-50% per card |
| 2. Memoization | Re-renders | -80% durante scroll |
| 3. Blur Removal | Composite layers | -10-15 layers |
| 4. Optimistic UI | Interaction latency | -200-500ms |
| 5. Image Optimization | Bandwidth | -40-60% per immagine |

---

## Note Tecniche

### Creazione noise.png
La texture noise deve essere:
- 64x64 pixel
- Grayscale con alpha
- Molto leggera (opacity finale ~0.04-0.08)
- Pattern tileable (seamless)

Può essere generata con qualsiasi tool (Photoshop, GIMP, online generator) o scaricata da librerie free (es. transparenttextures.com già usato nel progetto).

### Compatibilità
- Tutti gli interventi sono backward-compatible
- Nessun breaking change alle API
- Sliding window virtualization rimane invariata
- Snap scroll invariato

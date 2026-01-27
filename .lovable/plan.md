
# Implementazione Hardening Plan per Feed.tsx

## Panoramica
Implementeremo 3 hardening per eliminare race conditions e rendere la UX deterministica:

1. **Robust Home Refresh** - Sync deterministico di `activeIndex` prima dello scroll
2. **Immediate Link Fallback** - Container a altezza fissa + skeleton per link preview
3. **Resilient Post-Publish Scroll** - Retry loop bounded per trovare il nuovo post

---

## HARDENING 1: Robust Home Refresh

### File: `src/pages/Feed.tsx`

**Problema attuale (linee 107-128):**
```typescript
const handleHomeRefresh = () => {
  sessionStorage.removeItem('feed-active-index'); // ❌ Rimuove invece di settare a 0
  feedContainerRef.current?.scrollToTop();
  window.scrollTo({ top: 0, behavior: 'smooth' }); // ❌ VIOLA constraint - usa window scroll
  // ...
};
```

**Soluzione:**

1. Creare funzione `syncActiveIndex` (nuova, linea ~74):
```typescript
// Lightweight state sync ONLY (no side effects)
const syncActiveIndex = useCallback((index: number) => {
  setActiveIndex(index);
  sessionStorage.setItem('feed-active-index', index.toString());
}, []);
```

2. Modificare `handleActiveIndexChange` per usare `syncActiveIndex`:
```typescript
const handleActiveIndexChange = useCallback((index: number) => {
  syncActiveIndex(index);
  
  // Prefetch next card's image
  const nextItem = mixedFeedRef.current[index + 1];
  if (nextItem?.type === 'post' && nextItem.data.preview_img) {
    const img = new Image();
    img.src = nextItem.data.preview_img;
  }
  
  // Perf tracking
  perfStore.startAction('scroll');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      perfStore.endAction();
    });
  });
}, [syncActiveIndex]);
```

3. Riscrivere `handleHomeRefresh` (linee 107-128):
```typescript
const handleHomeRefresh = () => {
  // 1) Hard sync activeIndex a 0 PRIMA dello scroll
  syncActiveIndex(0);
  
  // 2) Scroll SOLO il container (NO window.scrollTo)
  if (feedContainerRef.current) {
    feedContainerRef.current.scrollToIndex(0);
  }
  
  // 3) Refresh data
  setRefreshNonce(prev => prev + 1);
  queryClient.invalidateQueries({ queryKey: ['posts'] });
  queryClient.invalidateQueries({ queryKey: ['daily-focus'] });
  
  haptics.light();
  sonnerToast.success('Feed aggiornato');
};
```

---

## HARDENING 2: Immediate Link Fallback

### File: `src/pages/Feed.tsx`

Aggiungere useEffect per prefetch dinamico (dopo linea 67):
```typescript
// Dynamic prefetch: when activeIndex changes, prefetch for upcoming items
useEffect(() => {
  if (mixedFeed.length === 0) return;
  
  const candidates = [activeIndex + 1, activeIndex + 2, activeIndex + 3]
    .map(i => mixedFeedRef.current[i])
    .filter(item => item?.type === 'post')
    .map(item => item.data.shared_url)
    .filter((url): url is string => !!url);

  if (candidates.length > 0) {
    prefetchArticlePreviews(queryClient, candidates);
  }
}, [activeIndex, queryClient, mixedFeed.length]);
```

### File: `src/components/feed/ImmersivePostCard.tsx`

Aggiungere rilevamento stato loading (dopo linea 256):
```typescript
// Detect if we're waiting for preview data
const isPreviewLoading = !articlePreviewData && !!urlToPreview;
```

Modificare il Generic Link Preview (linee 1522-1577) per usare container a altezza fissa:
```tsx
{hasLink && !isReshareWithShortComment && (
  <div className="min-h-[300px]"> {/* Fixed height container */}
    <div 
      className="cursor-pointer active:scale-[0.98] transition-transform"
      onClick={(e) => {
        e.stopPropagation();
        if (post.shared_url) {
          window.open(post.shared_url, '_blank', 'noopener,noreferrer');
        }
      }}
    >
      <SourceImageWithFallback
        src={articlePreview?.image || post.preview_img}
        sharedUrl={post.shared_url}
        isIntent={post.is_intent}
        trustScore={displayTrustScore}
        hideOverlay={true}
      />
      
      <div className="w-12 h-1 bg-white/30 rounded-full mb-4" />
      
      {/* Title with loading skeleton */}
      {isPreviewLoading && !post.shared_title ? (
        <div className="mb-3 space-y-2">
          <div className="h-6 bg-white/10 rounded-lg w-3/4 animate-pulse" />
          <div className="h-6 bg-white/10 rounded-lg w-1/2 animate-pulse" />
        </div>
      ) : (
        // Existing title rendering logic
      )}
      
      <div className="flex items-center gap-2 text-white/70 mb-4">
        <ExternalLink className="w-3 h-3" />
        <span className="text-xs uppercase font-bold tracking-widest">
          {getHostnameFromUrl(post.shared_url)}
        </span>
      </div>
    </div>
  </div>
)}
```

---

## HARDENING 3: Resilient Post-Publish Scroll

### File: `src/components/composer/ComposerModal.tsx`

1. Aggiungere prop all'interface (linea 34):
```typescript
interface ComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotedPost?: any;
  onPublishSuccess?: (newPostId: string) => void; // NUOVO
}
```

2. Destructurare nel componente (linea 88):
```typescript
export function ComposerModal({ isOpen, onClose, quotedPost, onPublishSuccess }: ComposerModalProps) {
```

3. Chiamare callback dopo cache update (dopo linea 836):
```typescript
// Update BOTH query keys to ensure immediate visibility
queryClient.setQueriesData({ queryKey: ['posts'] }, (old: any) => {
  // ... existing logic
});

// Notify parent about new post
if (postId) {
  onPublishSuccess?.(postId);
}
```

### File: `src/pages/Feed.tsx`

1. Aggiungere stato e handler (dopo linea 44):
```typescript
// State for pending scroll after publish
const [pendingScrollToPostId, setPendingScrollToPostId] = useState<string | null>(null);

// Handler for publish success
const handlePublishSuccess = useCallback((newPostId: string) => {
  console.log('[Feed] Post published, scheduling scroll to:', newPostId);
  setPendingScrollToPostId(newPostId);
}, []);
```

2. Aggiungere bounded retry loop (dopo linea 184):
```typescript
// Bounded retry loop for post-publish scroll
useEffect(() => {
  if (!pendingScrollToPostId) return;
  
  let attempts = 0;
  const maxAttempts = 10; // ~2s total (10 * 200ms)
  const intervalMs = 200;
  let timeoutId: NodeJS.Timeout;
  
  const tryScroll = () => {
    attempts++;
    
    const idx = mixedFeed.findIndex(
      item => item.type === 'post' && item.data.id === pendingScrollToPostId
    );
    
    if (idx !== -1) {
      console.log(`[Feed] Found post at index ${idx}, scrolling...`);
      syncActiveIndex(idx);
      requestAnimationFrame(() => {
        feedContainerRef.current?.scrollToIndex(idx);
      });
      setPendingScrollToPostId(null);
      return;
    }
    
    if (attempts < maxAttempts) {
      timeoutId = setTimeout(tryScroll, intervalMs);
    } else {
      console.warn('[Feed] Could not find new post after', maxAttempts, 'attempts');
      setPendingScrollToPostId(null);
    }
  };
  
  tryScroll();
  
  return () => {
    if (timeoutId) clearTimeout(timeoutId);
  };
}, [pendingScrollToPostId, mixedFeed, syncActiveIndex]);
```

3. Passare callback a ComposerModal (linee 408-415):
```tsx
<ComposerModal
  isOpen={showComposer}
  onClose={() => {
    setShowComposer(false);
    setQuotedPost(null);
  }}
  quotedPost={quotedPost}
  onPublishSuccess={handlePublishSuccess}
/>
```

---

## Riepilogo Modifiche

| File | Modifica |
|------|----------|
| `src/pages/Feed.tsx` | Nuova funzione `syncActiveIndex` |
| `src/pages/Feed.tsx` | `handleActiveIndexChange` usa `syncActiveIndex` |
| `src/pages/Feed.tsx` | `handleHomeRefresh` usa `syncActiveIndex(0)` + rimuove `window.scrollTo` |
| `src/pages/Feed.tsx` | Nuovo `useEffect` per prefetch dinamico |
| `src/pages/Feed.tsx` | Stato `pendingScrollToPostId` + handler + retry loop |
| `src/pages/Feed.tsx` | Passare `onPublishSuccess` a `ComposerModal` |
| `src/components/composer/ComposerModal.tsx` | Aggiungere prop `onPublishSuccess` |
| `src/components/composer/ComposerModal.tsx` | Chiamare `onPublishSuccess(postId)` dopo cache |
| `src/components/feed/ImmersivePostCard.tsx` | Aggiungere `isPreviewLoading` detection |
| `src/components/feed/ImmersivePostCard.tsx` | Container `min-h-[300px]` + skeleton per link preview |

---

## Vincoli Rispettati

- Sliding Window Virtualization intatta (wrapper sempre montato)
- Snap scroll invariato (`h-[100dvh]`)
- Nessun `window.scrollTo` per navigazione feed
- Keys stabili (`post-${id}`, `daily-carousel-${id}`)
- Retry loop bounded (max 2s, no loop infiniti)

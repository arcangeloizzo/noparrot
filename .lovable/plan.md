
# Fix Completo: LinkedIn Preview Immagine Non Mostrata

## Analisi del Problema

Il problema ha **due cause**:

### Causa 1: Cache esistente senza immagine
Le entry in `content_cache` per LinkedIn hanno `meta_image_url = NULL` perché il fix che ho applicato (salvare l'immagine) funziona solo per **nuovi** inserimenti.

### Causa 2: Cache HIT blocca il refresh
Quando c'è un cache HIT (linee 892-960 in `fetch-article-preview/index.ts`), la risposta viene restituita immediatamente con `image: cached.meta_image_url || ''` (che è stringa vuota).
Il sistema non fa mai un nuovo fetch per aggiornare l'immagine mancante.

---

## Soluzione: Refresh Automatico se Immagine Mancante

Aggiungere una logica "soft refresh" nel blocco cache HIT: se l'immagine è NULL per piattaforme che dovrebbero avere immagini (LinkedIn, Twitter, TikTok), non restituire il cache HIT ma procedere con un fetch fresco.

### File: `supabase/functions/fetch-article-preview/index.ts`

#### Modifica al blocco cache HIT (dopo linea 899)

```typescript
if (!cacheErr && cached && cached.title) {
  // NEW: Soft refresh for social platforms missing images
  const socialPlatformsNeedImage = ['linkedin', 'twitter', 'tiktok', 'threads'];
  const isSocialMissingImage = 
    socialPlatformsNeedImage.includes(cached.source_type) && 
    !cached.meta_image_url;
  
  if (isSocialMissingImage) {
    console.log(`[Cache] ⚠️ Social platform ${cached.source_type} missing image, forcing refresh`);
    // DON'T return from cache - proceed to fetch fresh data
  } else {
    console.log(`[Cache] ✅ HIT for ${normalizedUrl}: "${cached.title?.slice(0, 40)}..."`);
    // ... rest of cache hit logic ...
    return new Response(JSON.stringify(cacheResponse), { ... });
  }
}
```

---

## Logica Completa

```text
                  Cache Check
                      │
                      ▼
              ┌───────────────┐
              │  Cache HIT?   │
              └───────┬───────┘
                      │
           ┌──────────┴──────────┐
           │                     │
           ▼                     ▼
    Has Image?            No Image + Social?
           │                     │
           ▼                     ▼
    Return cache         Skip cache HIT
                         Fetch fresh data
                         Save with image
                         Return fresh response
```

---

## Impatto

- **LinkedIn**: Le preview senza immagine faranno un fetch fresco e salveranno l'immagine
- **Altri social (Twitter, TikTok, Threads)**: Stesso beneficio
- **Spotify/YouTube**: Non toccati (hanno già logiche separate con immagini funzionanti)
- **Articoli generici**: Non toccati (non sono nella lista `socialPlatformsNeedImage`)
- **Performance**: Lieve aumento di latenza per la prima richiesta dopo il fix, poi cache normale

---

## Riepilogo Modifiche

| File | Linee | Modifica |
|------|-------|----------|
| `supabase/functions/fetch-article-preview/index.ts` | 899-960 | Aggiungere soft refresh per social platform senza immagine |

---

## Test Post-Implementazione

1. Aprire un post LinkedIn esistente senza immagine
2. Verificare nei log: `[Cache] ⚠️ Social platform linkedin missing image, forcing refresh`
3. Verificare che l'immagine appaia nel feed
4. Ricaricare la pagina e verificare che l'immagine sia persistente (ora cachata con immagine)

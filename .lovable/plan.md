
# Piano Implementazione v3 - Fix Comprehension Gate Completo

## Diagnosi Finale Confermata

### Problema 1: Badge PULSE Spotify Non Mostrato
**Root Cause:** La tabella `content_cache` non ha la colonna `popularity`. Quando il frontend fa un cache-hit, la risposta non include il valore `popularity`, quindi `ImmersivePostCard` mostra il Trust Score standard invece del PULSE badge.

**Schema attuale `content_cache`:**
```
id, source_url, source_type, content_text, title, 
created_at, expires_at, meta_image_url, meta_hostname
```

**Schema richiesto:**
```
+ popularity (integer, nullable)
```

### Problema 2: Domande Generiche (Contenuto Insufficiente)
**Root Cause:** Il threshold minimo per il contenuto in `generate-qa` è 100 caratteri. Quando Jina fallisce o restituisce poco contenuto, il sistema usa il fallback metadata che spesso è < 200 chars, producendo domande generiche.

**Log evidenza:**
```
Content source: metadata_fallback
Content text length: 179
```

### Problema 3: Editoriali Vuoti in Reshare
**Root Cause CRITICO:** Il backend `generate-qa` gestisce SOLO `editorial://` ma l'app usa `focus://daily/` per tutti gli editoriali! 

**Codice attuale (linea 430):**
```typescript
if (sourceUrl?.startsWith('editorial://') && !serverSideContent) {
```

**Ma l'app usa:**
```typescript
shared_url: `focus://daily/${focusItem.id}`
```

Questo significa che quando si ricondivide un editoriale, il backend non trova il contenuto perché cerca `editorial://` ma riceve `focus://daily/`.

---

## Fix da Implementare

### Fix 1: Aggiungere `popularity` a `content_cache` (DB Migration)

```sql
ALTER TABLE content_cache ADD COLUMN popularity integer;
```

### Fix 2: Aggiornare `fetch-article-preview` per gestire `popularity`

**Cache Write (quando salva nuovo contenuto Spotify):**
```typescript
// Linee ~dove si fa upsert in content_cache per Spotify
await supabase.from('content_cache').upsert({
  source_url: spotifyUrl,
  source_type: 'spotify',
  content_text: lyrics || '',
  title: `${track.name} - ${track.artists[0].name}`,
  popularity: track.popularity, // AGGIUNGERE
  meta_image_url: track.album?.images[0]?.url,
  expires_at: expiresAt.toISOString()
}, { onConflict: 'source_url' });
```

**Cache Read (quando restituisce da cache):**
```typescript
// Linee 870-885: aggiungere popularity alla risposta cache
return new Response(JSON.stringify({
  success: true,
  title: cached.title,
  summary: cached.content_text?.substring(0, 300) || '',
  image: cached.meta_image_url || '',
  previewImg: cached.meta_image_url || '',
  popularity: cached.popularity, // AGGIUNGERE
  platform,
  type: cached.source_type === 'spotify' ? 'audio' : 'article',
  // ... resto
}));
```

### Fix 3: Aggiornare `generate-qa` per gestire `focus://daily/`

**Problema:** La condizione attuale controlla solo `editorial://`

**Fix:** Modificare la condizione alla linea 430 per includere entrambi i prefissi:

```typescript
// BEFORE:
if (sourceUrl?.startsWith('editorial://') && !serverSideContent) {

// AFTER:
if ((sourceUrl?.startsWith('editorial://') || sourceUrl?.startsWith('focus://daily/')) && !serverSideContent) {
```

E aggiornare l'estrazione ID:

```typescript
// BEFORE:
const focusId = sourceUrl.replace('editorial://', '');

// AFTER:
const focusId = sourceUrl
  .replace('editorial://', '')
  .replace('focus://daily/', '');
```

### Fix 4: Aumentare Threshold Minimo Contenuto in `generate-qa`

**Problema:** Il threshold attuale è 100 chars (linea 379), troppo basso per domande di qualità.

**Fix:** Aumentare a 300 chars e aggiungere retry con timeout più lungo:

```typescript
// BEFORE (linea 379):
if (!serverSideContent || serverSideContent.length < 100) {

// AFTER:
if (!serverSideContent || serverSideContent.length < 300) {
  // Retry Jina con timeout più lungo
  if (cacheUrl && !retried) {
    console.log('[generate-qa] Content too short, retrying Jina with 8s timeout...');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const jinaResponse = await fetch(`https://r.jina.ai/${cacheUrl}`, {
        headers: { 'Accept': 'application/json', 'X-Return-Format': 'json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (jinaResponse.ok) {
        const jinaData = await jinaResponse.json();
        if (jinaData.content && jinaData.content.length > serverSideContent.length) {
          serverSideContent = jinaData.content;
          contentSource = 'jina_retry';
        }
      }
    } catch (e) {
      console.log('[generate-qa] Jina retry failed:', e);
    }
  }
  
  // Fallback metadata solo se ancora insufficiente
  if (serverSideContent.length < 300 && title) {
    // ... fallback logic esistente
  }
}
```

---

## File da Modificare

| File | Modifica | Priorità |
|------|----------|----------|
| **Database** | `ALTER TABLE content_cache ADD COLUMN popularity integer` | CRITICA |
| `supabase/functions/fetch-article-preview/index.ts` | Salvare e restituire `popularity` da cache | ALTA |
| `supabase/functions/generate-qa/index.ts` | Gestire `focus://daily/` oltre a `editorial://` | CRITICA |
| `supabase/functions/generate-qa/index.ts` | Aumentare threshold a 300 chars + retry Jina | MEDIA |

---

## Ordine di Implementazione

1. **Migration DB:** Aggiungere colonna `popularity` a `content_cache`
2. **Fix generate-qa (focus://):** Gestire URL `focus://daily/` per editoriali
3. **Fix fetch-article-preview:** Salvare/restituire `popularity` per Spotify
4. **Fix generate-qa (threshold):** Aumentare soglia minima contenuto + retry

---

## Test Case Post-Implementazione

1. **Spotify PULSE Badge:** Condividere nuovo link Spotify → PULSE badge visibile immediatamente e dopo cache hit
2. **Editorial Reshare:** Ricondividere post "Il Punto" → Quiz con domande specifiche sul contenuto editoriale
3. **Content Quality:** Condividere link Il Fatto Quotidiano → Domande specifiche sul contenuto articolo, non solo titolo
4. **Comment Gate Editorial:** Commentare post editoriale → Quiz con contenuto completo dal DB

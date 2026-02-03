
# Piano: Fix estrazione testo LinkedIn per Comprehension Gate

## Problema identificato

Il quiz viene generato solo sulle prime 2 righe del post LinkedIn perché `generate-qa` non trova il contenuto in cache, nonostante sia presente.

### Analisi dei log

```
[generate-qa] ⏳ Content not cached or synthetic (LinkedIn refresh: undefined), trying Jina...
[generate-qa] ⚠️ Content too short (0 chars), trying extraction cascade...
[generate-qa] 🔥 Trying Firecrawl as backup...
[generate-qa] 📝 Using metadata fallback for URL: 220 chars
```

Il contenuto completo (2524 chars) È presente in `content_cache`, ma non viene trovato.

### Root Cause: Mismatch URL normalizzato

| Fase | URL utilizzato |
|------|---------------|
| **Salvataggio** (`fetch-article-preview`) | `https://linkedin.com/posts/...?rcm=...` (normalizzato) |
| **Ricerca** (`generate-qa`) | `https://www.linkedin.com/posts/...?utm_source=...&rcm=...` (originale) |

La funzione `cacheContentServerSide` normalizza l'URL prima di salvare, ma `generate-qa` cerca con l'URL originale.

---

## Soluzione proposta

### Fix 1: Normalizzare URL prima della ricerca in cache (generate-qa)

Modificare `generate-qa` per normalizzare l'URL prima di cercare nel database:

```typescript
// PRIMA
const cacheUrl = effectiveQaSourceRef.url || sourceUrl;

// DOPO
const rawCacheUrl = effectiveQaSourceRef.url || sourceUrl;
const cacheUrl = rawCacheUrl ? safeNormalizeUrl(rawCacheUrl) : null;
```

Questo garantisce che la ricerca usi lo stesso formato dell'URL salvato.

### Fix 2: Hardening del racing LinkedIn (fetch-article-preview)

Attualmente Firecrawl può "vincere" la race con solo 150 caratteri (spesso contenuto troncato). Aumentare la soglia:

```typescript
// PRIMA
if (data.success && markdown && markdown.length > 150) {

// DOPO  
if (data.success && markdown && markdown.length > 400 && 
    !isLinkedInAuthWallContent(markdown) &&
    !isBotChallengeContent(markdown)) {
```

### Fix 3: Detect "Visualizza altro" / "See more" truncation

Aggiungere un controllo per rilevare contenuto troncato da LinkedIn:

```typescript
function isLinkedInTruncated(content: string): boolean {
  const truncationMarkers = [
    '… Visualizza altro',
    '...Visualizza altro', 
    '… See more',
    '...See more',
    '…See more',
    '…Visualizza altro'
  ];
  return truncationMarkers.some(marker => 
    content.trim().endsWith(marker) || 
    content.trim().endsWith(marker.replace('…', '...'))
  );
}
```

Se rilevato, il contenuto viene marcato come `partial` e non salvato in cache come "complete".

---

## Files da modificare

| File | Modifica |
|------|----------|
| `supabase/functions/generate-qa/index.ts` | Normalizzare URL prima della ricerca in cache |
| `supabase/functions/fetch-article-preview/index.ts` | Aumentare soglia Firecrawl + detect truncation |

---

## Dettagli tecnici

### Modifica 1: generate-qa/index.ts (linee 509-518)

```typescript
case 'url': {
  // Fetch from content_cache - NORMALIZE URL for consistent cache key
  const rawCacheUrl = effectiveQaSourceRef.url || sourceUrl;
  const cacheUrl = rawCacheUrl ? safeNormalizeUrl(rawCacheUrl) : null;
  
  if (cacheUrl) {
    console.log(`[generate-qa] Looking up cache with normalized URL: ${cacheUrl}`);
    const { data: cached } = await supabase
      .from('content_cache')
      .select('content_text, source_type')
      .eq('source_url', cacheUrl)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
```

### Modifica 2: fetch-article-preview/index.ts (linee 1603-1625)

Hardening del racing Firecrawl per LinkedIn:

```typescript
.then(async (res) => {
  if (!res.ok) throw new Error(`Firecrawl ${res.status}`);
  const data = await res.json();
  const markdown = data.data?.markdown || data.markdown;
  
  // HARDENED: Higher threshold + validation for LinkedIn
  const cleanedMarkdown = extractTextFromHtml(markdown || '');
  const isValidContent = 
    data.success && 
    cleanedMarkdown.length > 400 &&  // Raised from 150
    !isLinkedInAuthWallContent(cleanedMarkdown) &&
    !isBotChallengeContent(cleanedMarkdown) &&
    !isLinkedInTruncated(cleanedMarkdown);  // NEW check
    
  if (isValidContent) {
    console.log(`[Race] 🏆 Firecrawl WINNER: ${cleanedMarkdown.length} chars`);
    // ... rest of success handling
  }
  throw new Error('Firecrawl insufficient or truncated');
})
```

### Modifica 3: Aggiungere helper function

In `fetch-article-preview/index.ts` (dopo `isLinkedInAuthWallContent`):

```typescript
function isLinkedInTruncated(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  const truncationMarkers = [
    '… Visualizza altro',
    '...Visualizza altro',
    '… See more', 
    '...See more',
    '…See more',
    '…Visualizza altro',
    '... see more',
    '… see more'
  ];
  return truncationMarkers.some(marker => 
    trimmed.toLowerCase().endsWith(marker.toLowerCase())
  );
}
```

---

## Impatto sugli altri flussi

| Piattaforma | Impatto |
|-------------|---------|
| YouTube | Nessuno - usa `youtubeId` come qaSourceRef |
| Spotify | Nessuno - usa `spotifyId` come qaSourceRef |
| Twitter | Nessuno - usa `tweetId` come qaSourceRef |
| TikTok | Positivo - beneficia della normalizzazione URL |
| Threads | Positivo - beneficia della normalizzazione URL |
| Articoli generici | Positivo - beneficia della normalizzazione URL |

---

## Test di validazione

1. Condividere lo stesso post LinkedIn usato come test
2. Verificare nei log che `generate-qa` trovi il contenuto in cache
3. Verificare che il quiz contenga domande sul contenuto completo (es. "Rawit Studio", "Contrader", "NDA", ecc.)
4. Testare con un nuovo link LinkedIn per verificare il flusso completo

---

## Rischio e rollback

- **Rischio basso**: le modifiche sono additive e non rimuovono funzionalità esistenti
- **Rollback**: se problemi, revertire le 3 modifiche ai file edge functions

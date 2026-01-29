
# Piano: Implementazione Ottimizzazione Performance (Fase 1 + 2)

## Panoramica

Implementazione delle ottimizzazioni per ridurre drasticamente la latenza dei link preview, passando da 1-6 secondi a ~50ms per URL già visti.

---

## Modifiche al Database (Migration Richiesta)

### Nuove Colonne

```text
┌────────────────────────────────────────────────────────────────┐
│ TABELLA: content_cache                                         │
├────────────────────────────────────────────────────────────────┤
│ + meta_image_url TEXT  → URL dell'immagine di anteprima       │
│ + meta_hostname TEXT   → Hostname per display rapido          │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ TABELLA: posts                                                  │
├────────────────────────────────────────────────────────────────┤
│ + hostname TEXT        → Hostname estratto da shared_url      │
│ + preview_fetched_at TIMESTAMPTZ → Timestamp del fetch        │
└────────────────────────────────────────────────────────────────┘
```

**SQL Migration:**
```sql
-- Cache Table Update
ALTER TABLE content_cache
ADD COLUMN IF NOT EXISTS meta_image_url TEXT,
ADD COLUMN IF NOT EXISTS meta_hostname TEXT;

-- Posts Table Update (Denormalization)
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS hostname TEXT,
ADD COLUMN IF NOT EXISTS preview_fetched_at TIMESTAMPTZ;
```

---

## Fase 1: Cache-First nella Edge Function

### File: `supabase/functions/fetch-article-preview/index.ts`

**Modifiche principali:**

1. **Aggiungere funzione `safeNormalizeUrl`** (linee ~73-120)
   - Copia esatta della logica da `src/lib/url.ts`
   - Rimuove parametri di tracking (utm_*, fbclid, etc.)
   - Forza https, rimuove www., ordina parametri

2. **Aggiungere Cache-First Check** (dopo linea 756)
   - Query sulla tabella `content_cache` PRIMA di qualsiasi fetch esterno
   - Se cache HIT: restituisce immediatamente i dati cached (latenza ~50ms)
   - Se cache MISS: continua con il flusso esistente

3. **Aggiornare funzione `cacheContentServerSide`** (linea 681-717)
   - Aggiungere parametro `imageUrl?: string`
   - Salvare `meta_image_url` nell'upsert
   - Salvare `meta_hostname` estratto dall'URL

4. **Aggiornare tutte le chiamate a `cacheContentServerSide`**
   - Passare l'immagine come parametro aggiuntivo

### Struttura Cache-First Check

```text
┌─────────────────────────────────────────────────────────────────┐
│ FLUSSO CACHE-FIRST                                              │
├─────────────────────────────────────────────────────────────────┤
│ 1. Ricevi URL e valida (SSRF protection)                        │
│ 2. Inizializza Supabase client                                  │
│                                                                 │
│ 3. normalizedUrl = safeNormalizeUrl(url)                        │
│ 4. SELECT title, content_text, meta_image_url, source_type,     │
│           meta_hostname                                         │
│    FROM content_cache                                           │
│    WHERE source_url = normalizedUrl                             │
│    AND expires_at > NOW()                                       │
│                                                                 │
│    ✅ Cache HIT (title presente):                               │
│       → Return JSON con title, summary, image, fromCache: true  │
│       ⏱️ Latenza: ~50ms                                         │
│                                                                 │
│    ❌ Cache MISS:                                                │
│       → Continua con fetch esterno (YouTube, Jina, etc.)        │
│       → Alla fine, salva anche meta_image_url e meta_hostname   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fase 2: Denormalizzazione in publish-post

### File: `supabase/functions/publish-post/index.ts`

**Posizione:** Dopo l'inserimento del post (riga ~327), PRIMA del return finale

### Logica Implementata

```text
┌─────────────────────────────────────────────────────────────────┐
│ NUOVO FLUSSO publish-post                                       │
├─────────────────────────────────────────────────────────────────┤
│ 1. Inserisci post (flusso esistente)                            │
│ 2. Link media (flusso esistente)                                │
│ 3. Aggiorna idempotency (flusso esistente)                      │
│                                                                 │
│ 4. SE shared_url presente E shared_title/preview_img nulli:     │
│    → AWAIT chiamata a fetch-article-preview                     │
│    → UPDATE posts SET                                           │
│        shared_title = risposta.title                            │
│        preview_img = risposta.image                             │
│        hostname = new URL(sharedUrl).hostname                   │
│        preview_fetched_at = NOW()                               │
│                                                                 │
│ 5. Classifica post (flusso esistente, async)                    │
│ 6. Return response                                              │
└─────────────────────────────────────────────────────────────────┘
```

**Nota importante:** Uso `await` esplicito (non fire-and-forget) perché:
- Il runtime Deno potrebbe terminare il processo dopo il return
- Con la Fase 1 implementata, la chiamata sarà rapida (cache HIT probabile)
- Garantisce integrità dei dati

---

## File da Modificare

| File | Modifiche |
|------|-----------|
| **Migration SQL** | Aggiungere colonne a content_cache e posts |
| `supabase/functions/fetch-article-preview/index.ts` | + safeNormalizeUrl, + cache-first check, + imageUrl in cache |
| `supabase/functions/publish-post/index.ts` | + await fetch-article-preview, + UPDATE metadati |

---

## Impatto Stimato

| Metrica | Prima | Dopo |
|---------|-------|------|
| Latenza link già visti | 1-6 secondi | ~50ms |
| Nuovi post con link | Solo client-fetch | Pre-popolato nel DB |
| Chiamate API esterne | Ogni render | Solo primo fetch |
| Costi Jina/Firecrawl | Alto | Ridotto 70-80% |

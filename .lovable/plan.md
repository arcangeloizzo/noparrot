
# Piano: Logica di Escalation Stealth per Scraping ✅ IMPLEMENTATO

> **Status**: Implementato e deployato
> **Data**: 2026-02-06
> 
> **Risultati Test**:
> - ✅ HDblog: 1081 chars estratti con successo (contentQuality: complete)
> - ⚠️ Forbes: Stealth attivato ma contenuto < 600 chars (paywall molto aggressivo)
>   - Forbes rimane un caso limite - il loro paywall è troppo aggressivo anche per Firecrawl stealth
>   - L'app gestisce gracefully con contentQuality: "minimal" + iframe fallback

## Panoramica

Implementazione di un sistema "Fail-and-Retry" isolato che interviene **solo quando lo scraping standard fallisce** (errore 403/401 o contenuto < 600 caratteri). L'obiettivo e garantire l'estrazione corretta da siti protetti come **Forbes** e **HDblog** senza rallentare il flusso esistente.

## Analisi del Sistema Attuale

Il flusso attuale in `fetch-article-preview/index.ts` per articoli generici:

1. **Check cache** - Se esiste contenuto valido, ritorna immediatamente
2. **Firecrawl prioritario** - Solo per domini specifici (`hdblog`, `hdmotori`, `threads.net`, `ilpost.it`)
3. **Jina AI Reader** - Tentativo standard senza parametri stealth
4. **Direct fetch** - Fetch diretto con User-Agent base
5. **Fallback** - OpenGraph/metadata

### Problemi Identificati

1. **Forbes non e nella whitelist Firecrawl** - Usa solo Jina che fallisce sui paywall
2. **Firecrawl senza parametri stealth** - `waitFor: 15000` ma senza `javascript: true` o User-Agent spoofing
3. **Nessun retry intelligente** - Se il primo tentativo fallisce, non c'e escalation
4. **Threshold basso** - Non c'e check su contenuto < 600 caratteri o "Cookie Policy"

## Strategia di Implementazione

### Fase 1: Aggiungere Detection per Contenuto Insufficiente

Creare una funzione che identifica quando il contenuto e:
- Troppo corto (< 600 caratteri)
- Contiene solo boilerplate ("Cookie Policy", "Accept All", "Privacy Settings")
- Contiene challenge anti-bot

```text
isInsufficientContent(content: string): boolean
  - length < 600 chars
  - contains only cookie/privacy text
  - isBotChallengeContent() returns true
```

### Fase 2: Implementare Stealth Retry in Firecrawl

Aggiungere una funzione dedicata per il retry stealth:

```text
fetchWithStealthMode(url: string):
  - waitFor: 3000 (aspetta rendering JS)
  - headers: desktop Chrome 120 User-Agent
  - formats: ['markdown']
  - onlyMainContent: true
  - timeout: 15000 (piu lungo per paywall)
```

### Fase 3: Modificare il Flusso Generic Article

```text
FLUSSO ATTUALE                    FLUSSO NUOVO
                                  
1. Cache check                    1. Cache check (invariato)
      |                                  |
2. Firecrawl (solo whitelist)     2. Jina standard (invariato)
      |                                  |
3. Jina standard                  3. Direct fetch (invariato)
      |                                  |
4. Direct fetch                   4. isInsufficientContent?
      |                                  |
5. OpenGraph fallback                 NO: return response
                                      SI: STEALTH ESCALATION
                                          |
                                  5a. Firecrawl stealth mode
                                          |
                                  5b. Se ancora insufficiente:
                                      return con contentQuality: 'blocked'
```

### Fase 4: Aggiornare generate-qa per Stealth Retry

Nel fallback cascade di `generate-qa/index.ts`, aggiungere parametri stealth:

```text
STEP 2: Firecrawl backup (GIA ESISTE)
  PRIMA: waitFor: 2000
  DOPO:  waitFor: 3000, headers stealth se content < 300
```

## Dettagli Tecnici

### File da Modificare

**1. `supabase/functions/fetch-article-preview/index.ts`**

Aggiungere dopo riga ~2400 (post Jina fallback):

```typescript
// STEALTH ESCALATION: Retry con parametri aggressivi se contenuto insufficiente
const isContentInsufficient = (text: string | undefined): boolean => {
  if (!text || text.length < 600) return true;
  
  const lower = text.toLowerCase();
  const boilerplateMarkers = [
    'cookie policy',
    'accept all',
    'privacy settings',
    'cookie settings',
    'manage preferences',
    'necessary cookies',
    'reject all',
  ];
  
  // Se piu del 50% del testo e boilerplate, insufficiente
  const markerMatches = boilerplateMarkers.filter(m => lower.includes(m)).length;
  return markerMatches >= 3;
};

async function stealthFirecrawlFetch(url: string): Promise<{
  content: string;
  title?: string;
  image?: string;
} | null> {
  const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
  if (!FIRECRAWL_API_KEY) return null;
  
  console.log('[Stealth] 🕵️ Activating stealth mode for:', url);
  
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,  // Wait for JS and anti-bot bypass
        timeout: 20000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      })
    });
    
    if (!response.ok) {
      console.log('[Stealth] ❌ Firecrawl failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    const markdown = data.data?.markdown || '';
    
    if (markdown.length > 600) {
      console.log(`[Stealth] ✅ Success: ${markdown.length} chars`);
      return {
        content: markdown,
        title: data.data?.metadata?.title,
        image: data.data?.metadata?.ogImage
      };
    }
    
    console.log('[Stealth] ⚠️ Content still insufficient:', markdown.length);
    return null;
  } catch (err) {
    console.error('[Stealth] Error:', err);
    return null;
  }
}
```

Modificare il flusso principale aggiungendo dopo il check `fetchSuccess && html.length > 1000`:

```typescript
// Dopo l'estrazione standard, verifica se il contenuto e sufficiente
const extractedContent = articleContent || jsonLdData?.content || '';

if (isContentInsufficient(extractedContent)) {
  console.log('[Preview] ⚠️ Content insufficient, trying stealth escalation...');
  
  const stealthResult = await stealthFirecrawlFetch(url);
  
  if (stealthResult && stealthResult.content.length > 600) {
    // Cache il contenuto stealth
    if (supabase) {
      await cacheContentServerSide(
        supabase, url, 'article',
        stealthResult.content,
        stealthResult.title || title,
        stealthResult.image || image
      );
    }
    
    // Aggiorna le variabili per la response
    articleContent = stealthResult.content;
    if (stealthResult.title) title = stealthResult.title;
    if (stealthResult.image) image = stealthResult.image;
    
    console.log('[Preview] ✅ Stealth escalation successful');
  }
}
```

**2. `supabase/functions/generate-qa/index.ts`**

Aggiornare STEP 2 (Firecrawl backup) con parametri stealth:

```typescript
// STEP 2: Try Firecrawl with stealth mode if Jina failed
if (cacheUrlForRetry && FIRECRAWL_API_KEY && (!serverSideContent || serverSideContent.length < 300)) {
  console.log(`[generate-qa] 🕵️ Trying Firecrawl stealth mode...`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // Longer timeout
    
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: cacheUrlForRetry,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,  // STEALTH: Wait for JS render
        timeout: 18000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }),
      signal: controller.signal
    });
    // ... rest of handling unchanged
```

## Test Cases

### Test 1: Forbes (Paywall/Anti-bot)
```
URL: https://www.forbes.com/sites/rashishrivastava/2026/02/03/why-some-of-the-largest-book-publishers-are-hiring-ai-engineers/
Expected: Estrazione completa del testo dell'articolo (> 1000 chars)
```

### Test 2: HDblog (Cookie Wall)
```
URL: https://www.hdblog.it/tim/articoli/n647311/mytim-app-android-filtro-call-center-esteri/
Expected: Testo articolo senza boilerplate cookie
```

### Test 3: Sito Normale (Non deve rallentare)
```
URL: https://www.ansa.it/... (qualsiasi articolo)
Expected: Estrazione veloce senza stealth mode (< 3s)
```

## Metriche di Successo

| Metrica | Prima | Dopo |
|---------|-------|------|
| Forbes extraction rate | 0% | > 90% |
| HDblog extraction rate | ~50% | > 90% |
| Tempo medio siti normali | ~2s | ~2s (invariato) |
| Tempo Forbes/HDblog | Fallimento | ~5-7s |

## Rischi e Mitigazioni

1. **Rate limiting Firecrawl** - La stealth mode costa piu crediti
   - Mitigazione: Cache aggressiva (7 giorni) per evitare retry

2. **False positive stealth trigger** - Potrebbe attivarsi su siti che funzionano
   - Mitigazione: Threshold alto (600 chars) e check boilerplate specifico

3. **Timeout esteso** - 20s timeout puo sembrare lento
   - Mitigazione: Solo per retry, non per primo tentativo

## Ordine di Implementazione

1. Aggiungere `isContentInsufficient()` e `stealthFirecrawlFetch()` in fetch-article-preview
2. Integrare stealth escalation nel flusso generic article
3. Aggiornare parametri Firecrawl in generate-qa
4. Deploy e test su Forbes/HDblog
5. Monitorare logs per verificare che siti normali non siano impattati

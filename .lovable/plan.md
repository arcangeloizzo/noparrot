

# Fix: YouTube Fallback per Spotify Episodes - Affidabilità Migliorata

## Diagnosi

Il sistema funziona correttamente, ma incontra due problemi:

1. **Invidious pubblici instabili** - Tutti e 6 i mirror restituiscono errori (403, 404, 502, DNS failures)
2. **Jina/YouTube bloccati** - YouTube blocca gli scraper automatici con 403 Forbidden
3. **Podcast non su YouTube** - "Now What?" è esclusivo Spotify/Apple, non ha un canale YouTube

Il comportamento attuale è corretto: ritorna `contentQuality: 'minimal'` quando non trova trascrizione.

## Soluzione Proposta

### Fase 1: Aggiungere YouTube Data API (Affidabile)

Per garantire ricerche affidabili, usiamo la **YouTube Data API v3** ufficiale come provider principale, con Invidious/Jina come fallback.

| Provider | Affidabilità | Limite | Costo |
|----------|--------------|--------|-------|
| YouTube Data API v3 | 99.9% | 10.000 query/giorno | Gratuito |
| Invidious (fallback) | ~30% | Nessuno | Gratuito |
| Jina Reader (fallback) | ~50% | Dipende da key | Gratuito/Paid |

### Fase 2: Struttura Ricerca (5s per provider, ~10s max)

```text
┌─────────────────────────────────────────────────────────────────┐
│                   RICERCA YOUTUBE (Parallelo)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Promise.any([                                                  │
│    youtubeDataApiSearch(query, 5s timeout),                     │
│    invidiousSearch(query, 5s timeout)                           │
│  ])                                                             │
│                                                                 │
│  Se entrambi falliscono → Jina Reader (5s timeout finale)       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Fase 3: Modifiche File

| File | Modifica |
|------|----------|
| `supabase/functions/fetch-article-preview/index.ts` | Aggiungere `searchYouTubeWithDataAPI()`, modificare `searchYouTubeForPodcast()` per usare Promise.any |
| Secrets | Richiedere `YOUTUBE_API_KEY` all'utente |

### Fase 4: Implementazione Tecnica

**Nuova funzione `searchYouTubeWithDataAPI`:**
```typescript
async function searchYouTubeWithDataAPI(query: string, timeout: number): Promise<string | null> {
  const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
  if (!YOUTUBE_API_KEY) return null;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  const url = `https://www.googleapis.com/youtube/v3/search?` +
    `part=snippet&type=video&maxResults=3&q=${encodeURIComponent(query)}` +
    `&key=${YOUTUBE_API_KEY}`;
  
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
  
  if (!res.ok) return null;
  const data = await res.json();
  
  // Confidence check su primo risultato
  const video = data.items?.[0];
  if (video?.id?.videoId) {
    return video.id.videoId;
  }
  return null;
}
```

**Modifica `searchYouTubeForPodcast`:**
```typescript
async function searchYouTubeForPodcast(showName: string, episodeTitle: string): Promise<string | null> {
  const query = `${showName} ${episodeTitle}`.trim();
  
  // 1. Try YouTube Data API and Invidious in parallel
  const apiPromise = searchYouTubeWithDataAPI(query, 5000);
  const invidiousPromise = searchWithInvidious(query, 5000);
  
  try {
    const result = await Promise.any([apiPromise, invidiousPromise]);
    if (result) return result;
  } catch {}
  
  // 2. Fallback: Jina Reader
  return searchWithJinaReader(query, 5000);
}
```

### Considerazioni

- **Nessun video = comportamento corretto**: Se il podcast non è su YouTube, Intent Mode (30+ parole) si attiva automaticamente
- **Quota YouTube API**: 10.000 query/giorno gratuite, più che sufficienti
- **Fallback graceful**: Se l'API key non è configurata, usa solo Invidious/Jina

### Domanda

Vuoi procedere con l'integrazione della YouTube Data API, oppure preferisci mantenere solo Invidious/Jina sapendo che alcuni podcast (come "Now What?") potrebbero non trovare corrispondenza?


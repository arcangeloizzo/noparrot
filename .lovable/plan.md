
# Performance & Reliability Overhaul: Spotify, YouTube e Contenuti Esterni

## Panoramica

Questo piano implementa una ristrutturazione completa del flusso di fetching contenuti per:
- Ridurre la latenza del 60-80% usando parallel fetching e racing
- Eliminare l'errore "Contenuto insufficiente" dopo retry
- Estendere le ottimizzazioni a tutti i tipi di contenuto (non solo Spotify)

---

## PROBLEMA 1: Fallback Sequenziale in fetch-lyrics (20+ secondi)

### Stato Attuale
Il codice attuale (linee 526-566) esegue fallback SEQUENZIALI:
```
Genius Search → Genius Page → Lyrics.ovh → Musixmatch
Tempo totale caso peggiore: 20+ secondi
```

### Soluzione: Promise.any Racing Pattern
Implementare il pattern proposto con miglioramenti:

```typescript
// NUOVO fetch-lyrics/index.ts - RACE PATTERN

// 1. Lyrics.ovh (VELOCE, 5s timeout)
async function fetchLyricsOvh(artist: string, title: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (res.ok) {
      const data = await res.json();
      if (data.lyrics?.length > 50) {
        console.log('[Race] Lyrics.ovh WINNER');
        return cleanLyrics(data.lyrics);
      }
    }
  } catch { /* ignore */ }
  return null;
}

// 2. Genius (via Jina, 8s timeout)
async function fetchGenius(artist: string, title: string, apiKey: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  
  try {
    // Search
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(`${artist} ${title}`)}`;
    const searchRes = await fetch(searchUrl, { 
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal 
    });
    
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const hit = searchData.response?.hits?.[0]?.result;
    if (!hit?.url) return null;
    
    // Jina scraping
    const jinaRes = await fetch(`https://r.jina.ai/${hit.url}`, {
      signal: controller.signal,
      headers: { 'Accept': 'text/markdown' }
    });
    clearTimeout(timeout);
    
    if (jinaRes.ok) {
      const text = await jinaRes.text();
      const lyrics = extractLyricsFromMarkdown(text);
      if (lyrics.length > 100) {
        console.log('[Race] Genius WINNER');
        return lyrics;
      }
    }
  } catch { /* ignore */ }
  return null;
}

// 3. Musixmatch (8s timeout)
async function fetchMusixmatch(artist: string, title: string): Promise<string | null> {
  // ... existing logic with 8s timeout
}

// MAIN HANDLER - RACE!
serve(async (req) => {
  // ... setup ...
  
  const promises = [
    fetchLyricsOvh(artist, title),
    GENIUS_KEY ? fetchGenius(artist, title, GENIUS_KEY) : Promise.resolve(null),
    fetchMusixmatch(artist, title)
  ];
  
  try {
    // Promise.any: first success wins!
    const lyrics = await Promise.any(
      promises.map(p => p.then(res => {
        if (!res) throw new Error('Empty');
        return res;
      }))
    );
    
    return new Response(JSON.stringify({ success: true, lyrics }), { ... });
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Lyrics not found' }), { ... });
  }
});
```

### Impatto
- Latenza media: 20s → 3-5s (riduzione 75%)
- Primo provider che risponde vince

---

## PROBLEMA 2: Retry Fallisce Dopo Errore Quiz

### Causa
Quando l'utente fallisce il quiz e ritorna, `generate-qa` cerca in `content_cache` ma:
1. Se il primo fetch di lyrics ha fallito, il cache è vuoto
2. Il secondo tentativo ricrea la stessa race che potrebbe fallire di nuovo

### Soluzione: Negative Caching + Retry Backoff

```typescript
// In fetch-article-preview/index.ts - SPOTIFY HANDLING

// Dopo il fetch lyrics
if (lyricsResult) {
  lyricsAvailable = true;
  await cacheContentServerSide(supabase, url, 'spotify', lyricsResult.lyrics);
} else {
  // NEGATIVE CACHE: salva che non abbiamo trovato lyrics
  // Evita retry infiniti
  await supabase.from('content_cache').upsert({
    source_url: url,
    source_type: 'spotify',
    content_text: '', // EMPTY = unavailable
    title: trackTitle,
    expires_at: new Date(Date.now() + 1000 * 60 * 30).toISOString() // 30 min TTL for negative
  }, { onConflict: 'source_url' });
  
  console.log('[Spotify] Negative cache set: lyrics unavailable');
}
```

```typescript
// In generate-qa/index.ts - Check cache first

case 'spotifyId': {
  const spotifyUrl = `https://open.spotify.com/track/${qaSourceRef.id}`;
  const { data: cached } = await supabase
    .from('content_cache')
    .select('content_text')
    .eq('source_url', spotifyUrl)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  
  if (cached) {
    if (cached.content_text && cached.content_text.length > 50) {
      serverSideContent = cached.content_text;
      contentSource = 'content_cache';
    } else {
      // NEGATIVE CACHE HIT: lyrics sono already known unavailable
      console.log('[generate-qa] Negative cache hit for Spotify - lyrics unavailable');
      // Skip expensive re-fetch, return insufficient_context immediately
      return new Response(
        JSON.stringify({ insufficient_context: true }),
        { headers: corsHeaders }
      );
    }
  } else {
    // Only try fresh fetch if not in cache at all
    // ... existing fetch logic
  }
  break;
}
```

### Impatto
- Elimina retry inutili dopo fallimento
- TTL di 30min per negative cache (permette retry manuale dopo)

---

## PROBLEMA 3: Spotify API Calls Sequenziali (3-7s overhead)

### Stato Attuale (linee 1095-1155)
```
getSpotifyAccessToken() → fetchSpotifyTrackMetadata() → fetchSpotifyAudioFeatures() → fetchLyricsFromGeniusServerSide()
```
Tutte sequenziali.

### Soluzione: Parallel Fetching

```typescript
// In fetch-article-preview/index.ts - SPOTIFY HANDLING

if (spotifyInfo) {
  try {
    // 1. oEmbed (always needed, quick)
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const oembedResponse = await fetch(oembedUrl);
    const oembedData = await oembedResponse.json();
    
    // 2. PARALLEL: token + all metadata calls
    if (spotifyInfo.type === 'track') {
      const accessToken = await getSpotifyAccessToken();
      
      if (accessToken) {
        // PARALLEL execution of metadata + features + lyrics
        const [trackMetadata, audioFeatures, lyricsResult] = await Promise.allSettled([
          fetchSpotifyTrackMetadata(spotifyInfo.id, accessToken),
          fetchSpotifyAudioFeatures(spotifyInfo.id, accessToken),
          fetchLyricsFromGeniusServerSide(oembedData.author_name || '', oembedData.title || '')
        ]);
        
        // Extract results safely
        const metadata = trackMetadata.status === 'fulfilled' ? trackMetadata.value : null;
        const features = audioFeatures.status === 'fulfilled' ? audioFeatures.value : null;
        const lyrics = lyricsResult.status === 'fulfilled' ? lyricsResult.value : null;
        
        // Merge data
        artist = metadata?.artist || oembedData.author_name || '';
        trackTitle = metadata?.title || oembedData.title || '';
        trackPopularity = metadata?.popularity;
        audioFeaturesData = features;
        
        if (lyrics?.lyrics && supabase) {
          lyricsAvailable = true;
          await cacheContentServerSide(supabase, url, 'spotify', lyrics.lyrics);
        }
      }
    }
    // ... rest of response
  }
}
```

### Impatto
- Latenza Spotify: 7s → 3s (parallel execution)
- AudioFeatures e Lyrics non bloccano più il metadata fetch

---

## PROBLEMA 4: Lentezza Generalizzata per Altri Contenuti

### Estensione a YouTube

```typescript
// In fetch-article-preview/index.ts - YOUTUBE HANDLING

if (youtubeId) {
  // PARALLEL: oEmbed + cache check
  const [oembedResult, cacheResult] = await Promise.allSettled([
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`),
    supabase?.from('youtube_transcripts_cache')
      .select('transcript')
      .eq('video_id', youtubeId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
  ]);
  
  // ... process results
}
```

### Estensione a LinkedIn/Twitter (Jina + Firecrawl Race)

```typescript
// RACE between Jina and Firecrawl for social content
if (socialPlatform === 'linkedin') {
  const contentPromises = [
    fetchSocialWithJina(url, 'linkedin'),
    FIRECRAWL_KEY ? fetchFirecrawl(url) : Promise.resolve(null)
  ];
  
  try {
    const content = await Promise.any(
      contentPromises.map(p => p.then(res => {
        if (!res?.content || res.content.length < 300) throw new Error('Insufficient');
        return res;
      }))
    );
    // First good result wins
  } catch {
    // All failed, use OG fallback
  }
}
```

---

## RIEPILOGO MODIFICHE

| File | Modifica | Impatto |
|------|----------|---------|
| `supabase/functions/fetch-lyrics/index.ts` | Promise.any racing pattern | -75% latenza |
| `supabase/functions/fetch-article-preview/index.ts` | Parallel Spotify API calls | -60% latenza |
| `supabase/functions/fetch-article-preview/index.ts` | Negative caching | Elimina retry inutili |
| `supabase/functions/generate-qa/index.ts` | Negative cache check | Fast-fail per lyrics unavailable |
| `supabase/functions/fetch-article-preview/index.ts` | YouTube parallel fetch | -40% latenza |
| `supabase/functions/fetch-article-preview/index.ts` | LinkedIn/Twitter race | -50% latenza |

---

## IMPATTO ATTESO

| Scenario | Prima | Dopo |
|----------|-------|------|
| Spotify (lyrics trovati) | 7-22s | 3-5s |
| Spotify (lyrics non trovati) | 20s + errore | 5s + negative cache |
| Retry dopo errore quiz | 20s | Immediato (negative cache) |
| YouTube metadata | 3-5s | 1-2s |
| LinkedIn/Twitter | 5-10s | 2-4s |

---

## NOTE TECNICHE

### Promise.any vs Promise.race
- `Promise.any`: aspetta il PRIMO SUCCESS, ignora rejects
- `Promise.race`: ritorna il PRIMO result (anche errore)
- Usiamo `Promise.any` per i provider lyrics

### Negative Caching
- TTL breve (30 min) per permettere retry manuale
- Evita loop infiniti di retry
- Indica chiaramente all'utente che i lyrics non sono disponibili

### Compatibilità
- Nessun breaking change alle API
- Le risposte mantengono la stessa struttura
- Il frontend non richiede modifiche

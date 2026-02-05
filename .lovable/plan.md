

# Piano: YouTube Fallback per Episodi Podcast Spotify

## Contesto

Gli episodi podcast di Spotify non hanno trascrizioni disponibili tramite l'API Spotify. Molti podcast popolari sono pubblicati sia su Spotify che su YouTube, dove i sottotitoli sono spesso disponibili.

## Clausole di Sicurezza

1. **NON toccare il blocco `if (spotifyInfo.type === 'track')`** - Il codice esistente per le tracce musicali rimane intatto
2. **Timeout rigoroso di 5 secondi** su tutte le chiamate YouTube (ricerca e trascrizione)

## Architettura

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     FLUSSO SPOTIFY EPISODE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. URL Spotify Episode                                             │
│         ↓                                                           │
│  2. fetch-article-preview: Estrai metadata (title, show_name)       │
│         ↓                                                           │
│  3. Cerca su YouTube: "[show_name] [episode_title]"                 │
│         ↓                                                           │
│  4. Match trovato?                                                  │
│      ├── SI → Recupera transcript YouTube (timeout 5s)              │
│      │         ↓                                                    │
│      │   Salva in cache con youtubeId associato                     │
│      │         ↓                                                    │
│      │   Ritorna qaSourceRef: { kind: 'youtubeId', id: videoId }    │
│      │                                                              │
│      └── NO → Ritorna contentQuality: 'minimal'                     │
│               Messaggio: "Nessuna trascrizione disponibile"         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## File da Modificare

| File | Modifica |
|------|----------|
| `supabase/functions/fetch-article-preview/index.ts` | Aggiungere `else if (spotifyInfo.type === 'episode')` con YouTube search e transcript retrieval |
| `src/components/composer/ComposerModal.tsx` | Visualizzare banner feedback YouTube fallback |

## Implementazione Tecnica

### 1. `fetch-article-preview/index.ts`

Dopo il blocco `if (spotifyInfo.type === 'track')` (riga ~1496), aggiungere:

**Helper Function `searchYouTubeForPodcast`:**
- Usa Invidious API (no API key richiesta)
- Timeout 5 secondi per istanza
- Verifica confidenza: almeno 2/3 delle prime parole del podcast devono matchare

**Helper Function `fetchYouTubeTranscriptInternal`:**
- Chiama `transcribe-youtube` edge function
- Timeout 5 secondi
- Usa `SUPABASE_SERVICE_ROLE_KEY` per auth

**Blocco Episode:**
```typescript
else if (spotifyInfo.type === 'episode') {
  // 1. Fetch Spotify metadata (title, show name)
  // 2. Search YouTube with timeout 5s
  // 3. If match found, fetch transcript with timeout 5s
  // 4. Cache result and return with youtubeFallback flag
}
```

### 2. `ComposerModal.tsx`

Aggiungere banner quando `urlPreview?.youtubeFallback` è true:

```tsx
{urlPreview?.youtubeFallback && urlPreview?.youtubeFallbackMessage && (
  <div className="mx-4 mb-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
    <p className="text-xs text-green-400 flex items-center gap-2">
      <Youtube className="h-4 w-4" />
      {urlPreview.youtubeFallbackMessage}
    </p>
  </div>
)}
```

## Considerazioni

- **Nessuna API Key Richiesta**: Invidious è un mirror YouTube open-source
- **Performance**: +3-5 secondi solo per episodi podcast, non per track
- **Fallback Graceful**: Se YouTube fallisce, comportamento esistente mantenuto
- **Caching**: Trascrizioni salvate con `source_type: 'spotify_episode_yt'`


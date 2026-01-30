
# Fix Gate Commenti - Aggiunta qaSourceRef

## Problema Identificato

Il flusso del **Comprehension Gate per i commenti consapevoli** (CommentsDrawer) usa una modalità legacy che non sfrutta il `qaSourceRef` restituito da `fetch-article-preview`. Di conseguenza:

- Per contenuti **Spotify/YouTube/Twitter**, il backend ricade sulla modalità legacy che usa il testo generico del `summary` passato dal client
- Questo produce **domande generiche** invece di domande specifiche sui testi/trascrizioni

### Comportamento Attuale

```
CommentsDrawer                          Composer (funziona)
     │                                       │
     ▼                                       ▼
fetchArticlePreview(url)              fetchArticlePreview(url)
     │                                       │
     ├── preview.qaSourceRef ✓              ├── preview.qaSourceRef ✓
     │                                       │
     ▼                                       ▼
generateQA({                          generateQA({
  summary: preview.content,  ❌         qaSourceRef: preview.qaSourceRef ✓
  sourceUrl: url                        sourceUrl: url
})                                    })
     │                                       │
     ▼                                       ▼
Backend: "Legacy mode" →             Backend: "Source-first" →
domande generiche                    domande su testi Spotify
```

### Causa Root

In `CommentsDrawer.tsx` linea 728-736, il codice:
```typescript
const result = await generateQA({
  contentId: post.id,
  title: contentTitle,
  summary: fullContent,        // ❌ Attiva legacy mode
  userText: newComment,
  sourceUrl: post.shared_url!,
  testMode,
  // ❌ MANCA: qaSourceRef: preview.qaSourceRef
});
```

## Soluzione

### Modifica a CommentsDrawer.tsx

Passare `qaSourceRef` da `preview` a `generateQA`, e rimuovere `summary` per contenuti esterni (mantenendolo solo per Focus interni):

**Linee 728-736 - Prima:**
```typescript
const result = await generateQA({
  contentId: post.id,
  title: contentTitle,
  summary: fullContent,
  userText: newComment,
  sourceUrl: post.shared_url!,
  testMode,
});
```

**Dopo:**
```typescript
const result = await generateQA({
  contentId: post.id,
  title: contentTitle,
  // Use qaSourceRef for external sources (Spotify, YouTube, etc.)
  // Use summary only for internal Focus content
  summary: isFocusContent ? fullContent : undefined,
  qaSourceRef: !isFocusContent ? preview?.qaSourceRef : undefined,
  userText: newComment,
  sourceUrl: post.shared_url!,
  testMode,
});
```

### Dichiarazione Variabile

Bisogna anche salvare il `preview` in una variabile accessibile a tutto lo scope del blocco (attualmente viene perso dopo l'if/else).

**Linee 712-724 - Prima:**
```typescript
} else {
  // Post normale - fetch articolo esterno
  const preview = await fetchArticlePreview(post.shared_url!);
  // ...
}
```

**Dopo:**
```typescript
let preview: any = null;
// ...
} else {
  // Post normale - fetch articolo esterno
  preview = await fetchArticlePreview(post.shared_url!);
  // ...
}
```

## Vincoli Rispettati

- Nessuna modifica al Composer (già funzionante)
- Nessuna modifica al backend
- Nessuna modifica al sistema PULSE/Trust Score
- Compatibilità con Focus interni mantenuta
- Fix isolato in un singolo file

## Test Post-Modifica

1. Aprire un post con link Spotify
2. Cliccare su "Rispondi" → scegliere "Entra con consapevolezza"
3. Verificare che le domande siano specifiche sui testi della canzone
4. Ripetere per YouTube e verificare domande sulla trascrizione

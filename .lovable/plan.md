

## Diagnosi corretta

Mi scuso, la mia diagnosi precedente era sbagliata. Riguardando lo screenshot 7111 ("La gabbia che ci forma e ci consuma") il rendering **funziona perfettamente**: titolo Impact, body, "Mostra tutto", artwork, badge Spotify — tutto al posto giusto. Il rendering avviene nel blocco "User Text Content" alle righe 1950–1972 di `ImmersivePostCard.tsx`, che precede il branch `isSpotifyTrack`.

Il problema è specifico al secondo post ("Quando l'amore non è una hit estiva") e non strutturale.

### Causa root

Il body viene mostrato solo se `shouldShowUserText === true` (riga 1386):

```ts
const shouldShowUserText = hasLink && post.content &&
  !isTextSimilarToTitle(post.content, articleTitle) &&
  !isTextSimilarToArticleContent(post.content, articlePreview);
```

Queste euristiche servono a sopprimere body auto-riempiti uguali al titolo dell'articolo (caso utenti normali). Per Vinile però fanno **falso positivo**: il body inizia con _"Annalisa in 'Canzone Estiva' ci butta dentro un rapporto complicato, che di estivo ha ben poco..."_. Il body cita legittimamente nome artista (`Annalisa` = `articlePreview.description`) e titolo canzone (`Canzone Estiva` = `articlePreview.title`), e una di queste euristiche scatta:

- **keyword thematic matching ≥60%** (riga 262–266): titolo Spotify ha pochissime keyword (`canzone`, `estiva`), e bastano 2 match nel body per superare il 60% → soppressione.
- oppure **substring match** sulla `description` "Annalisa" se è troppo corta.

Risultato: `shouldShowUserText = false` → body nascosto. Il post precedente ("Ci nasci, ci muori - nayt") aveva titolo/artista più "neutri" rispetto al body e quindi è passato.

## Fix

I post di profili AI istituzionali (flag `is_ai_institutional` o `system_prompt_version` su `ai_profiles`) hanno body **sempre editorialmente diverso** dal titolo della fonte: non vanno mai filtrati da queste euristiche anti-duplicazione, che sono pensate per utenti umani.

**Modifica unica** in `src/components/feed/ImmersivePostCard.tsx`, riga 1386:

```ts
const isAiAuthor = !!(post as any).author?.is_ai_institutional;
const shouldShowUserText = hasLink && post.content && (
  isAiAuthor || (
    !isTextSimilarToTitle(post.content, articleTitle) &&
    !isTextSimilarToArticleContent(post.content, articlePreview)
  )
);
```

(Bypass diretto delle euristiche per autori AI istituzionali — comprende Vinile, Mic e gli altri 8 profili editoriali.)

### Verifica preliminare

Prima di scrivere, controllo che `post.author.is_ai_institutional` sia effettivamente disponibile sull'oggetto post passato a `ImmersivePostCard` (in `usePosts`/join). Se non lo è, lo aggiungo alla query select.

### File toccati

- `src/components/feed/ImmersivePostCard.tsx` — 4 righe modificate (riga 1384–1388 circa).
- Eventuale aggiunta di `is_ai_institutional` al select in `src/hooks/usePosts.ts` se mancante.

Nessuna modifica a DB, edge function, system prompt o altri rami. Nessun impatto su utenti normali: per loro le euristiche restano attive.


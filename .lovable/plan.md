

# Fix Voice Post Card & Challenge Card — Piano di Implementazione

## Diagnosi dei problemi

### 1. ChallengeCard non renderizza contenuto
La query `usePosts` in `src/hooks/usePosts.ts` **non fetcha la tabella `challenges`**. Il campo `challenge` nel mapping (linee 205-268) non viene mai popolato. Quando `FeedCardAdapt` fa `const challengeData = post.challenge || post` (linea 768), `post.challenge` è sempre `null/undefined`, quindi `challengeData` diventa l'intero `post` — che non ha `thesis`, `voicePost`, `author` nella forma attesa dalla `ChallengeCard`. Risultato: la card non mostra nulla perché accede a proprietà inesistenti (`challenge.thesis`, `challenge.voicePost.audio_url`).

### 2. VoicePlayer — Già redesignato ma ha un bug minore
Il VoicePlayer attuale ha già il design glassmorphic. Il prop si chiama `durationSeconds` (non `duration` come nel codice fornito dall'utente). Il componente è funzionante.

### 3. Spaziatura Voice Post — Content duplicato
In `FeedCardAdapt.tsx`, il blocco Voice Post (linea 910-931) mostra il contenuto come "titolo audio" e poi il blocco "User Comment" (linea 934) mostra lo **stesso contenuto** di nuovo sotto. Serve un condizionale per nascondere il blocco commento se è un voice post.

### 4. Shimmer keyframe — Già presente
`@keyframes shimmer` è già in `src/index.css` (linea 1807). Serve aggiungere `@keyframes spin` se non presente (ma Tailwind `animate-spin` usa già il suo).

---

## Modifiche

### File 1: `src/hooks/usePosts.ts` — Aggiungere fetch challenges
Nella query Supabase (linea 127-200), aggiungere il join con la tabella `challenges`:
```sql
challenges!challenges_post_id_fkey (
  id, thesis, duration_hours, status, expires_at,
  votes_for, votes_against, voice_post_id,
  voice_posts!challenges_voice_post_id_fkey (
    id, audio_url, duration_seconds, waveform_data, transcript, transcript_status
  )
)
```
Nel mapping (linee 205-268), aggiungere:
```ts
challenge: post.challenges?.[0] ? {
  id: post.challenges[0].id,
  thesis: post.challenges[0].thesis,
  duration_hours: post.challenges[0].duration_hours,
  status: post.challenges[0].status,
  expires_at: post.challenges[0].expires_at,
  votes_for: post.challenges[0].votes_for || 0,
  votes_against: post.challenges[0].votes_against || 0,
  voice_post: post.challenges[0].voice_posts || null,
} : null,
```

### File 2: `src/components/feed/FeedCardAdapt.tsx` — Fix data mapping + spaziatura
1. **Challenge data mapping** (linee 766-824): Adattare `challengeData` per matchare l'interfaccia di ChallengeCard. Il campo `author` va preso da `post.author`. Il campo `voicePost` va mappato da `challenge.voice_post`.
2. **Nascondere contenuto duplicato** (linea 934): Wrappare il blocco "User Comment" in `{!isVoicePost && (...)}` per evitare la doppia visualizzazione del testo.

### File 3: `src/components/feed/ChallengeCard.tsx` — Fix null safety
Aggiungere null checks su `challenge.voicePost` prima di passarlo al VoicePlayer (linea 173-180). Se `voicePost` è null, non renderizzare il player.

### File 4: `src/components/media/VoicePlayer.tsx` — Minore
Il componente è già redesignato. Nessuna modifica strutturale necessaria — solo verificare che funziona con i dati reali.

---

## Ordine di esecuzione

1. **usePosts.ts** — Fetch challenges dal database (root cause della ChallengeCard rotta)
2. **FeedCardAdapt.tsx** — Fix mapping dati challenge + nascondere contenuto duplicato per voice post
3. **ChallengeCard.tsx** — Null safety su voicePost
4. Verifica end-to-end


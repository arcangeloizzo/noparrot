## Blindatura Comprehension Gate — 9 interventi

Task grosso: modifiche a DB (trigger), 3 Edge Functions, ~10 file frontend, e cancellazione codice morto. Prima di procedere confermo il piano perché una parte (blindatura DB + UI badge) è irreversibile su comportamento in produzione.

### 1. BUG testMode (CommentsDrawer.tsx)
- Sostituire `getTestModeWithSource(userWordCount)` con `getTestModeWithSource(postOriginalWordCount)`.
- In `generateQA({...})` (sia branch URL che branch media OCR), passare come `userText` il testo del **post autore** (`getPostFullText(post)`) invece di `newComment`.

### 2. Trigger DB su `public.comments`
Migration con trigger `BEFORE INSERT`:
- Se `NEW.passed_gate = true` e l'inserente non è l'autore del post e non esiste riga `post_gate_attempts(user_id=inserente, post_id=NEW.post_id, passed=true)` → forza `NEW.passed_gate = false`.
- Function `SECURITY DEFINER`, `SET search_path = public`.

### 3. Rimozione scorciatoia reshare (generate-qa/index.ts)
Cancellare il blocco "Strategy 2.5: RESHARE LOOKUP" (righe ~1119-1153). Chi ricondivide genera un quiz nuovo dai propri parametri.

### 4. Costante 120 char unificata
- Nuovo export in `src/lib/gate-utils.ts`: `export const MIN_EXTRACTED_CHARS = 120;`
- `supabase/functions/_shared/constants.ts` (nuovo file): `export const MIN_EXTRACTED_CHARS = 120;` (Deno non condivide con src)
- Sostituire i controlli `> 120` / `> 50` legati a `extracted_text` in: `CommentsDrawer.tsx`, `ComposerModal.tsx` (3 punti), `ImmersivePostCard.tsx`, `generate-qa/index.ts`.
- `extract-media-text/index.ts`: allineare `MIN_OCR_CHARS` e `MIN_TRANSCRIPT_CHARS` alla stessa costante (**nota**: alzare `MIN_TRANSCRIPT_CHARS` da 50 a 120 può far fallire trascrizioni brevi che oggi passano — confermare).

### 5. Concatenazione carousel
In `generate-qa/index.ts` case `mediaId`: se il ref punta a un post con più media, caricare da `post_media` (join `media`) ordinato per `order_idx`, concatenare `extracted_text` con separatori, e valutare la soglia una sola volta. In `CommentsDrawer.tsx` cambiare `postMediaWithExtractedText` in `postExtractedText` (concatenato) e passare come qaSourceRef il primo media id + una flag lato server per "concat all".

### 6. Limite 180s video
- Già presente in `useMediaUpload.ts:186` (rigetto lato client) e `extract-media-text/index.ts` (rigetto lato server). Aggiungere copy chiaro nel toast client-side ("Limite tecnico: 3 minuti massimo per video"). VoiceRecorder gestisce audio, non video → non toccato.

### 7. Codice morto
- Muovere `fetchTrustScore` da `src/lib/comprehension-gate.tsx` a nuovo file `src/lib/trustScore.ts`.
- Aggiornare import in `src/hooks/useTrustScore.ts` e `src/components/composer/EnhancedComposer.tsx`.
- In `EnhancedComposer.tsx` sostituire `<GateButton>` con `<Button>` semplice (perde il pre-check policy, che comunque è già bypassato dal flusso reale del Comprehension Gate server-side).
- In `src/pages/Index.tsx` e `src/pages/Feed.tsx`: rimuovere `<CGProvider>` wrapper e relativo import.
- Delete: `src/lib/comprehension-gate.tsx`, `src/components/ui/gate-button.tsx`, `src/components/feed/CommentsSheet.tsx`.

### 8. UI badge "HA LETTO" / "AUTORE"
`CommentItem.tsx`:
- Pastiglia consapevole 19px, `rgba(10,122,255,0.18)`, logo NoParrot + label mono 8.5px "HA LETTO".
- Se `comment.author_id === post.author_id` (serve passare `postAuthorId` come prop dal drawer): pastiglia gialla mono "AUTORE".
- Container commento consapevole: fondo `rgba(10,122,255,0.06)`, costola sinistra blu neon 3px con box-shadow glow.
- Container commento autore: costola gialla `#FFD464`.
`CommentsDrawer.tsx`:
- Passa `postAuthorId={post.author.id}` ai CommentItem.
- Header drawer: filtri pill mono "TUTTI" / "CONSAPEVOLI"; filtro applicato lato client su `comments.filter(c => c.passed_gate)`.

### 9. Scelta gate dentro il drawer
`CommentsDrawer.tsx`:
- Rimuovere `<Dialog>` (righe 645-872).
- Aggiungere sopra il composer un pannello vetro visibile quando `showCommentTypeChoice`:
  - Ordine invertito: **Leggi prima la fonte** (bottone glow blu, primario) SOPRA, **Partecipa subito** (bottone ghost) SOTTO.
- Composer disabilitato (`opacity 40%`, textarea `disabled`) mentre `showCommentTypeChoice` è aperto e nessuna scelta è fatta.
- Trigger: al focus della textarea, se `requiresGateChoice && !selectedCommentType`, mostra il pannello (già fa).

### Rischi / conferme richieste
- **#4 threshold transcript**: alzare `MIN_TRANSCRIPT_CHARS` da 50 → 120 potrebbe scartare più trascrizioni. Confermi?
- **#7 EnhancedComposer**: perdere `<GateButton>` significa perdere il timer/scroll policy pre-share. Ma il vero gate è già server-side via `runGateBeforeAction`. Confermo la sostituzione con `<Button>`.
- **#8 postAuthorId**: cambio firma di `CommentItem` (`postAuthorId?: string`). OK?

Confermi il piano e procedo con tutto in un'unica sequenza di commit? Alla fine chiudo con checklist punto per punto, file toccati e typecheck verde.
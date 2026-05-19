## Causa confermata

In modalità challenge il composer raccoglie due campi:
- `voiceTitle` → "Agentic platform transcript"
- `voiceBodyText` → "Agentic success takes a platform approach"

Entrambi sono stati salvati correttamente in `voice_posts`. Ma il payload `challengeData.thesis` è mappato sul `cleanContent` del rich text editor principale, che in challenge mode resta vuoto. Quindi sul server arriva `thesis=""`, il codice fa `"" || null`, la colonna `challenges.thesis` è NOT NULL → insert fallisce → post orfano (nessuna riga in `challenges`).

L'audio c'è (23s, transcript "Agentic platform"), titolo e testo ci sono, manca solo la riga `challenges`.

## Cosa fare

### 1. Fix mappatura nel composer (`ComposerModal.tsx` ~1769)
Per le challenge usare come `thesis` il primo valore non vuoto fra:
1. `cleanContent.trim()` (se in futuro si aggiunge un campo tesi dedicato)
2. `voiceBodyText.trim()`
3. `voiceTitle.trim()`

Così il corpo che l'utente scrive viene effettivamente usato come tesi della sfida. Niente cambi all'UI.

### 2. Fix difensivo lato server (`publish-post/index.ts` ~516)
Stessa fallback chain server-side per blindare le richieste vecchie/malformate:
`thesis = challengeData.thesis?.trim() || challengeData.bodyText?.trim() || challengeData.title?.trim() || null`.
Se ancora `null`, **rispondere 400** prima di inserire il post (no più post orfani).

### 3. Hardening anti-orfani (`publish-post`)
Se per qualsiasi motivo l'insert su `challenges` dovesse fallire DOPO l'insert del post, eliminare il post appena creato e restituire errore al client.

### 4. Recupero del post esistente (`ebfa273a-…`)
Migration SQL che inserisce la riga `challenges` mancante:
- `post_id = ebfa273a-ac7d-4d3f-831e-5767c1bae6da`
- `voice_post_id = 2ab3fecb-094b-473d-8631-5872de4f0fd8`
- `thesis = 'Agentic success takes a platform approach'` (dal `voice_posts.body_text`)
- `title = 'Agentic platform transcript'`
- `body_text = 'Agentic success takes a platform approach'`
- `duration_hours = 48`, `expires_at = created_at + 48h`
- `status = 'active'`

Così la tua card torna visibile come challenge reale.

## File previsti
- migration SQL (recupero `ebfa273a-…`)
- `supabase/functions/publish-post/index.ts` (fallback chain + validazione + cleanup on failure)
- `src/components/composer/ComposerModal.tsx` (mappatura `thesis` con fallback)

## Cosa NON tocco
- UI del composer, schema tabelle, voice transcription, rendering card challenge, gate, trust score.

## Verifica
1. La tua challenge `ebfa273a-…` appare nel feed con titolo, tesi e voice player.
2. Pubblicare una challenge nuova con solo titolo+body+audio (come hai fatto tu) → funziona, riga `challenges` creata.
3. Pubblicare senza audio o con tutti i campi vuoti → server risponde 400, niente post orfano.

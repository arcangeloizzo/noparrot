
# Piano: Ripristino del Flusso YouTube Nativo

## Problema Identificato

Il flusso YouTube si rompe nel **Composer** quando provi a pubblicare un link `youtu.be/`. L'errore "contenuto insufficiente" appare perché:

1. `generate-qa` tenta di chiamare `transcribe-youtube` internamente per recuperare la trascrizione
2. La chiamata usa il **service role key** come Authorization header
3. `transcribe-youtube` rifiuta la chiamata perché cerca un JWT utente valido (errore: "invalid claim: missing sub claim")
4. Senza trascrizione, il contenuto risulta insufficiente per il quiz

## Soluzione Proposta

Modificare `transcribe-youtube` per accettare **anche** il service role per le chiamate server-to-server interne, mantenendo la sicurezza per le chiamate client dirette.

## Modifiche Tecniche

### 1. `supabase/functions/transcribe-youtube/index.ts`

Aggiungere la logica per distinguere tra:
- **Chiamata client diretta**: richiede JWT utente valido
- **Chiamata interna (server-to-server)**: accetta service role key

```text
// BEFORE (lines 272-301):
// Solo JWT utente accettato

// AFTER:
// 1. Prova prima JWT utente
// 2. Se fallisce, verifica se è il service role (internal call)
// 3. Service role identificato controllando se l'auth fallisce ma il token 
//    corrisponde al pattern del service role (usato solo internamente)
```

Logica di autenticazione aggiornata:
- Se `getUser()` ha successo → chiamata client, procedi con userId
- Se fallisce con "missing sub claim" → verifica se è una chiamata interna da Edge Function
- Per chiamate interne, usa un userId placeholder e logga come "internal_call"

### 2. Nessuna modifica a questi file

- `generate-qa/index.ts` - già corretto, usa `qaSourceRef.kind: 'youtubeId'`
- `fetch-article-preview/index.ts` - già corretto, restituisce `qaSourceRef` per YouTube
- `ComposerModal.tsx` - già corretto, costruisce `qaSourceRef` per YouTube
- `CommentsDrawer.tsx` - non coinvolto in questo flusso (Composer)
- `useMediaUpload.ts` - non coinvolto (è per media caricati, non link)

## Flusso Corretto (dopo il fix)

```text
1. Utente incolla youtu.be/xxx nel Composer
2. ComposerModal → fetchArticlePreview(url)
3. fetch-article-preview → rileva YouTube, restituisce:
   - title, thumbnail, embedHtml
   - qaSourceRef: { kind: 'youtubeId', id: 'xxx' }
   - transcriptStatus: 'pending' (se non in cache)
4. Utente clicca Pubblica → Reader → Continua
5. ComposerModal → generateQA({ qaSourceRef: { kind: 'youtubeId', id: 'xxx' } })
6. generate-qa:
   a. Cerca in youtube_transcripts_cache
   b. Se MISS → chiama transcribe-youtube internamente (ora funziona!)
   c. Usa la trascrizione per generare il quiz
7. Quiz mostrato, utente risponde, post pubblicato
```

## Separazione dei Flussi Garantita

| Flusso | Sorgente Contenuto | Servizio AI | Nessun Cross-over |
|--------|-------------------|-------------|-------------------|
| **YouTube Link** | `youtube_transcripts_cache` / Supadata | Gemini (quiz) | ✓ Nessun Whisper/OCR |
| **Video Caricato** | `media.extracted_text` | Whisper | ✓ Nessun YouTube |
| **Immagine OCR** | `media.extracted_text` | Gemini Vision | ✓ Separato |

## Impatto

- **Basso rischio**: modifica isolata a `transcribe-youtube`
- **Retrocompatibile**: le chiamate client continuano a funzionare
- **Nessun costo aggiuntivo**: usa l'infrastruttura esistente (Supadata già configurato)

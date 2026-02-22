

# Fix Build Errors

## Problema Principale (Blocca il Build)
In `ImmersivePostCard.tsx` alla riga 648, manca la dichiarazione della funzione `goDirectlyToGateForPost`. Il codice usa `await` (riga 662) ma non e racchiuso in una funzione `async`. La dichiarazione e stata accidentalmente rimossa durante un edit precedente.

## Errori Edge Functions (Non bloccano il build frontend, ma generano warning)
Diversi errori di tipo nelle Edge Functions Deno che vanno corretti.

---

## Modifiche

### 1. `src/components/feed/ImmersivePostCard.tsx` (CRITICO - blocca il build)
- Aggiungere `const goDirectlyToGateForPost = async () => {` prima della riga 648 (dopo la chiusura di `startComprehensionGateForPost` alla riga 646)
- Questo racchiude tutto il blocco fino alla riga 768 (`};`) in una funzione async, risolvendo l'errore `"await" can only be used inside an "async" function`

### 2. `supabase/functions/classify-content/index.ts`
- Riga 174: cambiare `error.message` in `(error as Error).message` per risolvere `TS18046: 'error' is of type 'unknown'`

### 3. `supabase/functions/cleanup-expired-cache/index.ts`
- Riga 123: cambiare `error.message` in `(error as Error).message`

### 4. `supabase/functions/extract-media-text/index.ts`
- Riga 354: cambiare `error.message` in `(error as Error).message`

### 5. `supabase/functions/fetch-daily-focus/index.ts`
- Righe 526, 547, 553, 561: aggiungere tipo esplicito `(e: any)` ai parametri dei callback `.find()` e `.filter()`

### 6. `supabase/functions/generate-infographic/index.ts`
- Righe 155-167: il watermarking con `imagescript` causa errori di tipo (`GIF | Image` non assegnabile a `Image`). Aggiungere type assertion `as any` o rimuovere il watermark e usare il buffer originale come fallback sicuro.


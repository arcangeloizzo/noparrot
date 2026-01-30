
# Piano Fix: Errore 500 su generate-qa (FK Violation)

## Diagnosi

L'errore 500 indica una **violazione della Foreign Key** nel database:

```
insert or update on table "post_qa_questions" violates foreign key constraint "post_qa_questions_post_id_fkey"
Key (post_id)=(c2a683bd-f945-4e30-94f2-7eda1cc902a9) is not present in table "posts".
```

### Flusso Attuale (Errato)

```text
1. Client: Condividi post editoriale "Il Punto"
2. Client → generate-qa: {
     contentId: "c2a683bd-..." (ID della tabella daily_focus)
     sourceUrl: "editorial://c2a683bd-..."
     isPrePublish: undefined (non passato!)
   }
3. Backend: isPrePublish è undefined, quindi inserisce:
     post_id: contentId = "c2a683bd-..."
4. Database: FK error - quell'UUID è di daily_focus, non di posts!
```

---

## Soluzione

### FIX 1: Frontend - Passare isPrePublish per Editorial (ImmersivePostCard.tsx)

Alla linea 902-912, quando generiamo il quiz per contenuti editoriali, dobbiamo passare `isPrePublish: true`:

```typescript
// Prima (errato):
const result = await generateQA({
  contentId: isEditorial ? readerSource.id : post.id,
  // ... altri parametri
});

// Dopo (corretto):
const result = await generateQA({
  contentId: null,  // Nessun post_id per editorial
  isPrePublish: true,  // Forza post_id = null nel backend
  // ... altri parametri
});
```

### FIX 2: Backend - Check Difensivo per editorial:// (generate-qa/index.ts)

Aggiungere un check difensivo alla linea 821-825 per forzare `post_id = null` quando l'URL è editoriale:

```typescript
// Nel blocco insert (linea 821-834):
const { data: insertedQA, error: insertError } = await supabase
  .from('post_qa_questions')
  .insert({
    // FIX: Per editorial URLs, sempre null per evitare FK violation
    post_id: (isPrePublish || sourceUrl?.startsWith('editorial://')) ? null : contentId,
    source_url: sourceUrl || '',
    // ...
  })
```

---

## File da Modificare

| File | Linee | Modifica |
|------|-------|----------|
| `ImmersivePostCard.tsx` | 902-912 | Passare `isPrePublish: true` e `contentId: null` per editorial |
| `generate-qa/index.ts` | 821-825 | Check difensivo per `editorial://` → `post_id = null` |

---

## Risultato Atteso

| Prima | Dopo |
|-------|------|
| FK error 500 su contenuti editoriali | Quiz generato e salvato correttamente |
| `post_id = daily_focus.id` (errato) | `post_id = null` (corretto) |

---

## Note Tecniche

- `post_qa_questions.post_id` è nullable by design per supportare quiz pre-pubblicazione
- Il `source_url` (`editorial://...`) rimane il riferimento al contenuto editoriale
- `owner_id` continua a tracciare chi ha generato il quiz

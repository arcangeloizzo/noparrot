

# Piano: Fix collegamento Quiz → Post per Reshare Carousel

## Problema identificato

Il quiz generato per un carousel ha sempre `post_id: NULL` perché:

1. `generate-qa` usa `isPrePublish: true` → crea quiz senza `post_id`
2. `publish-post` crea il post ma **NON aggiorna** `post_qa_questions.post_id`
3. Il resharer cerca il quiz per `quoted_post_id` ma non lo trova perché `post_id` è ancora NULL

## Soluzione

Aggiungere l'update del `post_id` in `publish-post/index.ts` dopo la creazione del post.

### Modifica a `supabase/functions/publish-post/index.ts`

Dopo la riga 447 (dopo `stage=insert_ok`), aggiungere:

```typescript
// ========================================================================
// LINK QUIZ TO POST: Update post_qa_questions.post_id for gate validation
// This enables reshare lookup (Strategy 2.5 in generate-qa)
// ========================================================================
try {
  // Find quiz by owner_id that was created recently (last 10 minutes) with null post_id
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  const { data: pendingQuiz, error: quizLookupErr } = await supabase
    .from('post_qa_questions')
    .select('id')
    .eq('owner_id', user.id)
    .is('post_id', null)
    .gte('generated_at', tenMinutesAgo)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (quizLookupErr) {
    console.warn(`[publish-post:${reqId}] stage=quiz_link_lookup error`, quizLookupErr.message);
  } else if (pendingQuiz?.id) {
    // Update the quiz with the new post_id
    const { error: quizUpdateErr } = await supabase
      .from('post_qa_questions')
      .update({ post_id: inserted.id })
      .eq('id', pendingQuiz.id);

    if (quizUpdateErr) {
      console.warn(`[publish-post:${reqId}] stage=quiz_link_update error`, quizUpdateErr.message);
    } else {
      console.log(`[publish-post:${reqId}] stage=quiz_link_ok quizId=${pendingQuiz.id}`);
    }
  } else {
    console.log(`[publish-post:${reqId}] stage=quiz_link_skip no pending quiz`);
  }
} catch (quizLinkErr) {
  console.warn(`[publish-post:${reqId}] stage=quiz_link_exception`, quizLinkErr);
  // Non-blocking: don't fail the publish if quiz linking fails
}
```

## Flusso dopo la fix

| Step | Prima | Dopo |
|------|-------|------|
| 1. Autore genera quiz | `post_id: NULL` | `post_id: NULL` |
| 2. Autore passa test | - | - |
| 3. Autore pubblica post | `post_id` resta NULL | `post_id` aggiornato con ID post |
| 4. Resharer cerca quiz | Non trovato! | Trovato via Strategy 2.5 |
| 5. Resharer passa test | Errore bloccante | Usa quiz originale |

## File da modificare

| File | Modifica |
|------|----------|
| `supabase/functions/publish-post/index.ts` | Aggiungere logica per linkare quiz al post dopo insert |

## Note

- Il lookup usa `owner_id` + `post_id IS NULL` + `generated_at` recente per trovare il quiz pendente
- Il collegamento è best-effort: se fallisce, il post viene comunque pubblicato (non bloccante)
- Risolve il problema per i NUOVI post; quelli già pubblicati senza link rimarranno con `post_id: NULL`


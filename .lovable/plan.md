
# Fix Critico: Visibilità "Riprova Analisi" + Rimozione Pulizia LinkedIn

## Problema Identificato

Ho analizzato il codice e identificato i seguenti problemi critici:

### 1. Props `errorState` e `onRetry` NON passate al QuizModal

Nel file `src/components/composer/ComposerModal.tsx` (linee 1610-1711), il `QuizModal` viene renderizzato così:

```tsx
<QuizModal
  questions={Array.isArray(quizData.questions) ? quizData.questions : []}
  qaId={quizData.qaId}
  onSubmit={handleQuizSubmit}
  onCancel={() => {...}}
  onComplete={(passed) => {...}}
  provider="Comprehension Gate"
  postCategory={contentCategory}
/>
```

**Mancano le props `errorState` e `onRetry`!**

Quando viene settato `quizData` con `errorState` (linee 632-641 e 817-827), l'oggetto contiene:
```ts
{
  errorState: { code: result.error_code, message: '...' },
  onRetry: handleRetryWithCacheClear,
  onCancel: () => {...}
}
```

Ma queste proprietà **non vengono mai passate** al componente `QuizModal`, quindi il blocco `if (errorState)` a linea 89 di `quiz-modal.tsx` non viene mai eseguito.

### 2. Pulizia LinkedIn Ancora Troppo Aggressiva

Nonostante l'approccio "additivo", il testo estratto da LinkedIn potrebbe ancora essere problematico. Per evitare contenuto vuoto che rompe l'app, rimuoverò temporaneamente la pulizia LinkedIn.

---

## Modifiche da Effettuare

### File 1: `src/components/composer/ComposerModal.tsx`

**Linee 1610-1711** - Aggiungere le props mancanti:

```tsx
<QuizModal
  questions={Array.isArray(quizData.questions) ? quizData.questions : []}
  qaId={quizData.qaId}
  onSubmit={handleQuizSubmit}
  onCancel={() => {
    // Se c'è onCancel custom in quizData (per error state), usalo
    if (quizData.onCancel) {
      quizData.onCancel();
    } else {
      addBreadcrumb('quiz_cancel_during');
      forceUnlockBodyScroll();
      setShowQuiz(false);
      setQuizData(null);
      setQuizPassed(false);
    }
  }}
  onComplete={(passed) => { /* ... existing logic ... */ }}
  provider="Comprehension Gate"
  postCategory={contentCategory}
  // NEW: Pass error state props
  errorState={quizData.errorState}
  onRetry={quizData.onRetry || quizData.onCancel}
/>
```

### File 2: `supabase/functions/generate-qa/index.ts`

**Linee 102-167** - Disabilitare completamente la pulizia LinkedIn:

```typescript
function cleanLinkedInContent(content: string): string {
  // TEMPORARILY DISABLED: Return raw content to avoid breaking the app
  // The additive cleaning was still causing issues
  console.log(`[generate-qa] LinkedIn cleaning DISABLED, returning raw content (${content.length} chars)`);
  return content;
}
```

Questo garantisce che:
1. Il testo LinkedIn arrivi al quiz generator senza modifiche
2. L'app non si rompa per contenuto vuoto
3. Possiamo testare se il problema era la pulizia o altro

---

## Modifiche Aggiuntive per Sicurezza

### File 3: `src/components/ui/quiz-modal.tsx`

Verificare che il blocco `errorState` sia davvero prioritario (già presente a linea 89, verificato funzionante).

Aggiungere logging per debug:

```tsx
// After line 30, add debug logging
console.log('[QuizModal] Render with props:', { 
  hasErrorState: !!errorState, 
  hasOnRetry: !!onRetry,
  questionsCount: questions?.length 
});
```

---

## Riepilogo Modifiche

| File | Modifica |
|------|----------|
| `ComposerModal.tsx` (1610-1711) | Passare `errorState` e `onRetry` da `quizData` al `QuizModal` |
| `generate-qa/index.ts` (102-167) | Disabilitare pulizia LinkedIn (return raw content) |
| `quiz-modal.tsx` (30+) | Aggiungere logging per debug |

---

## Risultato Atteso

1. Quando il backend ritorna `ERROR_METADATA_ONLY` o `ERROR_INSUFFICIENT_CONTENT`
2. Il `ComposerModal` setta `quizData.errorState` 
3. Il `QuizModal` riceve `errorState` prop
4. Il blocco `if (errorState)` mostra l'UI con "Riprova Analisi"
5. L'utente può cliccare il pulsante per ritentare con cache pulita

---

## Garanzie Anti-Regressione

- Nessuna modifica al flusso normale del quiz (quando non c'è errore)
- Nessuna modifica ad altri provider (YouTube, Spotify, News)
- Logica commenti/condivisione non toccata
- Solo fix del passaggio props + disabilitazione pulizia LinkedIn

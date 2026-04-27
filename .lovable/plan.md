## Allineamento Gate Commenti per post lunghi senza fonte

Estendo la logica del Comprehension Gate nel `CommentsDrawer` per attivare la scelta "commento consapevole / commento spontaneo" anche sui **post text-only lunghi (>30 parole)**, allineandola al comportamento già attivo nel reshare (`ComposerModal`). **Nessun altro flusso esistente verrà modificato.**

---

### 1. `src/components/feed/CommentsDrawer.tsx` — unica modifica logica

**Aggiungere** accanto alla variabile esistente `postHasSource`:

```ts
import { getWordCount, getQuestionCountWithoutSource } from '@/lib/gate-utils';

const postWordCount = getWordCount(post?.content || '');
const postHasLongText = !postHasSource && postWordCount > 30;
const requiresGateChoice = postHasSource || postHasLongText;
```

**Sostituire** ogni occorrenza di `postHasSource` che governa l'apertura del `FocusCommentChoiceSheet` con `requiresGateChoice`. Le check che riguardano specificamente la **fonte esterna** (es. fetch preview, OCR media) restano legate a `postHasSource`.

**Bypass invariati** (NON tocco):
- Autore del post
- Tentativo precedente già superato (cache `comprehension_attempts`)
- Commento senza link su post senza fonte e ≤30 parole → resta spontaneo diretto
- Link nel commento → resta gestito da `shouldRequireGate(commentText)` esistente

---

### 2. Branch QA per "commento consapevole" su post text-only lungo

Nel handler che oggi chiama `runGateBeforeAction` con `linkUrl = post.shared_url`, aggiungere un branch:

```ts
if (postHasLongText && !postHasSource) {
  // Riusa il flow Intent reshare: testo del post come fonte cognitiva
  await runGateBeforeAction({
    linkUrl: `internal://post/${post.id}`, // placeholder, non usato
    intentPostContent: post.content,       // ← chiave: triggera USER_ONLY
    onSuccess,
    onCancel,
    setIsProcessing,
    setQuizData,
    setShowQuiz,
  });
  return;
}
// ...flow esistente per postHasSource invariato
```

`runGateBeforeAction` ha già il branch `intentPostContent` che:
- calcola `getQuestionCountForIntentReshare(originalWordCount)` → 1 domanda (31-120 parole) o 3 domande (>120)
- chiama `generate-qa` con `testMode: 'USER_ONLY'`
- mostra il quiz modal standard

Quindi **nessuna modifica** a `runGateBeforeAction.ts` né a `gate-utils.ts` né alla edge function `generate-qa`.

---

### 3. Copy del `FocusCommentChoiceSheet` (micro-adeguamento condizionale)

Quando la scelta è triggherata da `postHasLongText` (no fonte esterna), adattare la label del bottone "consapevole":
- Default attuale (con fonte): "Verifica la fonte" / "Commento consapevole"
- Nuovo caso (text-only lungo): "Rileggi il post" / "Commento consapevole"

Passare un prop opzionale `gateReason: 'source' | 'long-text'` allo sheet per scegliere la copy. Nessun cambio strutturale, solo testo.

---

### 4. Cosa NON viene toccato (esplicito)

- ✅ `ComposerModal.tsx` — reshare flow (già corretto)
- ✅ `runGateBeforeAction.ts` — branch Intent già esistente
- ✅ `generate-qa` edge function
- ✅ `gate-utils.ts` — utilities già pronte
- ✅ Bypass autore, bypass tentativo precedente
- ✅ Gate sui link nel commento (logica `shouldRequireGate`)
- ✅ Gate sui media con OCR/trascrizione
- ✅ Tutti i flussi del Composer, Messaggi, Sondaggi, Challenge

---

### 5. Verifica post-implementazione

1. Commento sul post lungo di Nico (text-only, >30 parole, no link) → appare scelta consapevole/spontaneo ✅
2. Commento consapevole → quiz USER_ONLY (1 o 3 domande sul testo del post) ✅
3. Commento spontaneo → pubblica direttamente come oggi ✅
4. Commento su post breve (≤30 parole) senza fonte → nessun gate (invariato) ✅
5. Commento su post con `shared_url` → flow esistente invariato ✅
6. Commento su post con media + OCR → flow esistente invariato ✅
7. Reshare dello stesso post di Nico → gate invariato come oggi ✅
8. Autore commenta sul proprio post → bypass invariato ✅
9. Build TypeScript verde

---

### 6. File modificati

- `src/components/feed/CommentsDrawer.tsx` — logica `requiresGateChoice` + branch Intent
- `src/components/feed/FocusCommentChoiceSheet.tsx` — prop `gateReason` per copy condizionale

Nessuna migration, nessuna edge function, nessun altro file toccato.
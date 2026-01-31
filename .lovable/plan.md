
# Audit e Fix: Consistenza Breadcrumbs `quiz_closed` su Tutti i Punti di Ingresso

## Obiettivo
Estendere l'audit già completato su `CommentsDrawer.tsx` a tutti i componenti che usano il quiz, assicurando che ogni chiamata a `setShowQuiz(false)` sia preceduta da `addBreadcrumb('quiz_closed', { via: '...' })`.

## Panoramica dell'Architettura Attuale

Il `QuizModal` già gestisce automaticamente:
- `quiz_mount` → al mount del componente
- `quiz_cleanup_done` → al unmount (fallback in `crashBreadcrumbs.ts`)
- `quiz_closed` → solo quando l'utente clicca "Annulla" o backdrop

**Problema**: Quando il quiz viene chiuso programmaticamente (es. dopo `data.passed === true`), il breadcrumb `quiz_closed` non viene aggiunto nei componenti parent.

---

## File da Modificare

### 1. `src/components/feed/FeedCard.tsx`

**Import da aggiungere:**
```typescript
import { addBreadcrumb } from '@/lib/crashBreadcrumbs';
```

**Punti di modifica:**

| Linea | Contesto | Breadcrumb |
|-------|----------|------------|
| ~654 | Quiz passato con successo | `addBreadcrumb('quiz_closed', { via: 'passed' })` |
| ~668 | onCancel del QuizModal | `addBreadcrumb('quiz_closed', { via: 'cancelled' })` |
| ~683 | Chiusura error state | `addBreadcrumb('quiz_closed', { via: 'error_dismissed' })` |

---

### 2. `src/components/feed/FeedCardAdapt.tsx`

**Import da aggiungere:**
```typescript
import { addBreadcrumb } from '@/lib/crashBreadcrumbs';
```

**Punti di modifica:**

| Linea | Contesto | Breadcrumb |
|-------|----------|------------|
| ~641 | Quiz passato | `addBreadcrumb('quiz_closed', { via: 'passed' })` |
| ~663 | Quiz fallito | `addBreadcrumb('quiz_closed', { via: 'failed' })` |
| ~678 | Errore catch | `addBreadcrumb('quiz_closed', { via: 'error' })` |
| ~1008 | onCancel del QuizModal | `addBreadcrumb('quiz_closed', { via: 'cancelled' })` |
| ~1025 | Chiusura error state | `addBreadcrumb('quiz_closed', { via: 'error_dismissed' })` |

---

### 3. `src/components/feed/ImmersivePostCard.tsx`

**Import da aggiungere:**
```typescript
import { addBreadcrumb } from '@/lib/crashBreadcrumbs';
```

**Punti di modifica:**

| Linea | Contesto | Breadcrumb |
|-------|----------|------------|
| ~1044 | Quiz passato | `addBreadcrumb('quiz_closed', { via: 'passed' })` |
| ~1056 | Quiz fallito | `addBreadcrumb('quiz_closed', { via: 'failed' })` |
| ~1065 | Errore catch | `addBreadcrumb('quiz_closed', { via: 'error' })` |
| ~2065 | onCancel del QuizModal | `addBreadcrumb('quiz_closed', { via: 'cancelled' })` |

---

### 4. `src/components/feed/ImmersiveEditorialCarousel.tsx`

**Import da aggiungere:**
```typescript
import { addBreadcrumb } from '@/lib/crashBreadcrumbs';
```

**Punti di modifica:**

| Linea | Contesto | Breadcrumb |
|-------|----------|------------|
| ~192 | `handleQuizPass()` | `addBreadcrumb('quiz_closed', { via: 'passed' })` |
| ~205 | `handleQuizClose()` | `addBreadcrumb('quiz_closed', { via: 'cancelled' })` |

---

### 5. `src/components/messages/MessageComposer.tsx`

**Import da aggiungere:**
```typescript
import { addBreadcrumb } from '@/lib/crashBreadcrumbs';
```

**Punti di modifica:**

| Linea | Contesto | Breadcrumb |
|-------|----------|------------|
| ~232 | Quiz passato | `addBreadcrumb('quiz_closed', { via: 'passed' })` |
| ~244 | Errore catch | `addBreadcrumb('quiz_closed', { via: 'error' })` |
| ~249 | onCancel del QuizModal | `addBreadcrumb('quiz_closed', { via: 'cancelled' })` |
| ~264 | Chiusura error state | `addBreadcrumb('quiz_closed', { via: 'error_dismissed' })` |

---

### 6. `src/components/composer/ComposerModal.tsx`

Questo file già importa `addBreadcrumb` e ha molti breadcrumb. Dobbiamo aggiungerne alcuni specifici per `quiz_closed`:

| Linea | Contesto | Breadcrumb |
|-------|----------|------------|
| ~639 | Error state onCancel (iOS flow) | `addBreadcrumb('quiz_closed', { via: 'error_cancelled' })` |
| ~688 | Retry - close before regenerate | `addBreadcrumb('quiz_closed', { via: 'retry_start' })` |
| ~723 | Retry fallback to Intent Mode | `addBreadcrumb('quiz_closed', { via: 'retry_fallback' })` |
| ~741 | Retry error - Intent Mode | `addBreadcrumb('quiz_closed', { via: 'retry_error' })` |
| ~845 | Error state onCancel (reader flow) | `addBreadcrumb('quiz_closed', { via: 'error_cancelled' })` |
| ~1641 | quiz_cancel_during - già presente ma manca `quiz_closed` specifico | Aggiungere `addBreadcrumb('quiz_closed', { via: 'cancelled' })` |
| ~1664 | onComplete handler - chiusura quiz | Aggiungere `addBreadcrumb('quiz_closed', { via: passed ? 'passed' : 'failed' })` prima di `setShowQuiz(false)` |

---

## Dettaglio Modifiche per File

### FeedCard.tsx - Modifiche Complete

```typescript
// PRIMA (linea ~654)
if (passed) {
  haptics.success();
  if (quizData.onSuccess) {
    quizData.onSuccess();
  }
  setShowQuiz(false);

// DOPO
if (passed) {
  haptics.success();
  if (quizData.onSuccess) {
    quizData.onSuccess();
  }
  addBreadcrumb('quiz_closed', { via: 'passed' });
  setShowQuiz(false);
```

```typescript
// PRIMA (linea ~664)
onCancel={() => {
  if (quizData.onCancel) {
    quizData.onCancel();
  }
  setShowQuiz(false);

// DOPO
onCancel={() => {
  if (quizData.onCancel) {
    quizData.onCancel();
  }
  addBreadcrumb('quiz_closed', { via: 'cancelled' });
  setShowQuiz(false);
```

```typescript
// PRIMA (linea ~681)
onClick={() => {
  if (quizData.onCancel) quizData.onCancel();
  setShowQuiz(false);

// DOPO
onClick={() => {
  if (quizData.onCancel) quizData.onCancel();
  addBreadcrumb('quiz_closed', { via: 'error_dismissed' });
  setShowQuiz(false);
```

---

## Riepilogo Modifiche

| File | Punti | Import Nuovo |
|------|-------|--------------|
| `FeedCard.tsx` | 3 | ✅ Sì |
| `FeedCardAdapt.tsx` | 5 | ✅ Sì |
| `ImmersivePostCard.tsx` | 4 | ✅ Sì |
| `ImmersiveEditorialCarousel.tsx` | 2 | ✅ Sì |
| `MessageComposer.tsx` | 4 | ✅ Sì |
| `ComposerModal.tsx` | 7 | No (già presente) |

**Totale: 25 punti di modifica su 6 file**

---

## Garanzie Anti-Regressione

1. **Nessun cambio logico**: Solo aggiunta di log, nessuna modifica al flusso
2. **Fallback preservato**: `quiz_cleanup_done` rimane come safety net
3. **Diagnostica migliorata**: Ogni chiusura quiz avrà un `via` descrittivo
4. **Pattern consistente**: Stesso approccio già validato in `CommentsDrawer.tsx`

---

## Test Consigliati

Dopo l'implementazione, verificare questi flussi:

1. **Feed → Condividi post con link → Quiz passato** → No toast errore
2. **Feed → Condividi post con link → Quiz annullato** → No toast errore
3. **Notifica → Post → Commento con link → Quiz passato** → No toast errore
4. **DM → Invia messaggio con link → Quiz passato** → No toast errore
5. **Composer → Pubblica con link → Quiz passato** → No toast errore
6. **Editorial Carousel → Condividi → Quiz passato** → No toast errore

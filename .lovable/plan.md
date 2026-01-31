
# Fix: Falso Positivo "Sessione precedente interrotta" dopo Quiz da Notifica

## Problema Identificato

Quando l'utente arriva da una **notifica** e completa il quiz:
- Il quiz viene chiuso programmaticamente (`setShowQuiz(false)`)
- Ma il breadcrumb `quiz_closed` **non viene aggiunto**
- Quando torna sull'Index, `checkForRecentCrash()` vede `quiz_mount` senza un corrispondente evento di chiusura
- Risultato: toast "Sessione precedente interrotta. Ultimo evento: quiz" errato

**Perché funziona dal Feed ma non da Notifica:**
- Dal Feed: L'utente resta sulla stessa pagina. Al prossimo reload, `clearBreadcrumbs()` viene chiamato subito in `Index.tsx`, cancellando tutto prima del check.
- Da Notifica: L'utente naviga a `/post/:id` (pagina separata) → completa quiz → torna su `/` → i breadcrumbs vecchi ci sono ancora → crash detection li trova.

---

## Soluzione

### Approccio a Due Livelli

**1. Aggiungere `quiz_cleanup_done` come evento di chiusura valido**

Nel file `crashBreadcrumbs.ts`, aggiungere `quiz_cleanup_done` all'array `closeEvents`. Questo è già emesso nel cleanup di `QuizModal`, quindi funziona come fallback.

**2. Aggiungere breadcrumb espliciti `quiz_closed` in `CommentsDrawer.tsx`**

Prima di ogni `setShowQuiz(false)` nel gestore quiz, aggiungere il breadcrumb appropriato per maggiore chiarezza e diagnostica.

---

## Modifiche File

### File 1: `src/lib/crashBreadcrumbs.ts` (linea 115)

```typescript
// Prima
const closeEvents = ['reader_closed', 'quiz_closed', 'publish_success'];

// Dopo
const closeEvents = ['reader_closed', 'quiz_closed', 'quiz_cleanup_done', 'publish_success'];
```

### File 2: `src/components/feed/CommentsDrawer.tsx`

Aggiungere `addBreadcrumb('quiz_closed', { via: '...' })` prima di ogni `setShowQuiz(false)`:

| Linea circa | Contesto | Breadcrumb da aggiungere |
|-------------|----------|--------------------------|
| 833 | Errore validazione | `addBreadcrumb('quiz_closed', { via: 'validation_error' })` |
| 847 | Quiz non passato | `addBreadcrumb('quiz_closed', { via: 'failed' })` |
| 854 | Quiz passato | `addBreadcrumb('quiz_closed', { via: 'passed' })` |
| 861 | Errore catch | `addBreadcrumb('quiz_closed', { via: 'error' })` |
| 868 | Annullamento manuale | `addBreadcrumb('quiz_closed', { via: 'cancelled' })` |

---

## Perché Questa Soluzione È Sicura

| Garanzia | Dettaglio |
|----------|-----------|
| **Nessun cambio al flusso** | Le chiamate a `setShowQuiz(false)` restano identiche |
| **Fallback robusto** | Anche se il breadcrumb esplicito non viene aggiunto, `quiz_cleanup_done` (dal cleanup di QuizModal) ora conta come chiusura |
| **Crash detection reale intatta** | Se c'è un crash PRIMA che il quiz venga chiuso, né `quiz_closed` né `quiz_cleanup_done` saranno presenti → il toast apparirà correttamente |
| **Diagnostica migliorata** | I breadcrumb `{ via: 'passed'/'failed'/... }` aiutano a capire come il quiz è stato chiuso |

---

## Flusso Corretto Dopo il Fix

```text
Utente arriva da notifica
        │
        ▼
   /post/:id carica
        │
        ▼
   CommentsDrawer apre
        │
        ▼
   Quiz genera → quiz_mount ✓
        │
        ▼
   Utente completa quiz
        │
        ▼
   quiz_closed (via: 'passed') ✓   ← NUOVO
        │
        ▼
   QuizModal unmount → quiz_cleanup_done ✓
        │
        ▼
   Utente torna su /
        │
        ▼
   checkForRecentCrash():
   openCount: 1 (quiz_mount)
   closeCount: 2 (quiz_closed + quiz_cleanup_done)
   hasUnmatchedOpen: false
   crashed: false ✓
```

---

## Riepilogo Modifiche

| File | Tipo | Descrizione |
|------|------|-------------|
| `src/lib/crashBreadcrumbs.ts` | Modifica | Aggiungere `quiz_cleanup_done` a `closeEvents` |
| `src/components/feed/CommentsDrawer.tsx` | Modifica | Aggiungere breadcrumb `quiz_closed` prima di ogni `setShowQuiz(false)` |

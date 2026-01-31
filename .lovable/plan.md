
# Implementazione Session Guard - Post-Background Stability

## Obiettivo
Risolvere i problemi di "Sessione precedente interrotta" e fallimenti random dopo che l'app torna dal background su iOS.

## Causa Root
Race condition: le Edge Functions vengono chiamate PRIMA che il refresh del token JWT sia completato dopo il resume dell'app.

## Soluzione: Session Guard System

### Garanzie Richieste (implementate)
1. **Fail-Safe Timeout 8s**: Se il check sessione impiega più di 8 secondi, l'UI si sblocca comunque
2. **Singleton Pattern**: Un solo refresh alla volta (cooldown 5s tra refresh)

---

## File da Creare/Modificare

### 1. NUOVO: `src/lib/sessionGuard.ts`
Modulo centrale con:
- `withSessionGuard(fn)` - wrapper per chiamate Edge Function
- `markSessionNeedsVerification()` - chiamato al resume dell'app
- `getIsSessionReady()` - stato corrente
- Retry automatico su errori 401/403
- Timeout fail-safe di 8s
- Singleton pattern per refresh

### 2. MODIFICA: `src/hooks/useAppLifecycle.ts`
- Usa `markSessionNeedsVerification()` invece di logica inline
- Esporta stato `isSessionReady` via React hook
- Sottoscrive ai cambiamenti di stato sessione

### 3. MODIFICA: `src/lib/ai-helpers.ts`
Wrappa con `withSessionGuard()`:
- `generateQA()`
- `validateAnswers()`
- `fetchArticlePreview()`

### 4. MODIFICA: `src/lib/runGateBeforeAction.ts`
Wrappa le chiamate Edge Function con `withSessionGuard()`

### 5. MODIFICA: `src/pages/Index.tsx`
Riduci i falsi positivi del toast "Sessione precedente interrotta":
- Mostra solo se c'è un reale problema (scroll lock, pending publish, evento di errore)
- Non mostrare per eventi di sistema normali

---

## Flusso Implementato

```text
App torna dal background (>30s)
              │
              ▼
   isSessionReady = false
              │
              ▼
   ┌───────────────────────────┐
   │ markSessionNeedsVerification │
   │ (con timeout 8s fail-safe)   │
   │ (singleton - max 1 per 5s)   │
   └─────────────┬─────────────┘
                 │
       ┌─────────┴─────────┐
       │                   │
   Successo            Timeout/Errore
       │                   │
       ▼                   ▼
 Token refreshato     UI sbloccata
                      (fail-open)
       │                   │
       └─────────┬─────────┘
                 │
                 ▼
        isSessionReady = true
                 │
                 ▼
         UI pronta per azioni
```

---

## Impatto

| Scenario | Prima | Dopo |
|----------|-------|------|
| Commento dopo background | Può fallire con "Sessione interrotta" | Attende sessione, poi esegue |
| Quiz per post/commento | Fallisce silenziosamente | Retry automatico con refresh |
| Toast falsi positivi | Frequenti | Solo su reali problemi |
| Performance normale | Invariata | Invariata (nessun overhead) |
| Primo rientro da background | Race condition | 200-500ms attesa, poi fluido |

---

## Garanzie Anti-Regressione

1. Se l'utente non va in background, tutto funziona esattamente come prima
2. UI mai bloccata per più di 8 secondi
3. Nessun refresh duplicato grazie al singleton pattern
4. Su errore, UI si sblocca comunque (fail-open)
5. Ogni step viene loggato nei breadcrumbs per diagnostica

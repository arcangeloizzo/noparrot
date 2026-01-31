

# Fallback a Intent Mode dopo Secondo Tentativo Fallito

## Obiettivo

Quando il retry del quiz fallisce (secondo tentativo), invece di mostrare solo un toast di errore, il sistema deve:
1. Chiudere il modal del quiz
2. Attivare l'Intent Mode
3. Permettere all'utente di pubblicare con 30+ parole

---

## Modifiche Tecniche

### File: `src/components/composer/ComposerModal.tsx`

#### Linee 717-728: Sostituire toast.error con attivazione Intent Mode

**Codice Attuale:**
```typescript
// Handle same error again
if (result.error_code) {
  toast.error('Impossibile analizzare il contenuto. Prova con un\'altra fonte.');
  addBreadcrumb('retry_validation_error', { code: result.error_code });
  setIsGeneratingQuiz(false);
  return;
}

if (result.error || !result.questions) {
  toast.error('Errore generazione quiz. Riprova più tardi.');
  setIsGeneratingQuiz(false);
  return;
}
```

**Nuovo Codice:**
```typescript
// Handle same error again → Fallback to Intent Mode
if (result.error_code) {
  toast.dismiss();
  console.log('[ComposerModal] Second retry failed, activating Intent Mode');
  addBreadcrumb('retry_fallback_intent', { code: result.error_code });
  
  // Close quiz modal (already closed above, but ensure state is clean)
  setShowQuiz(false);
  setQuizData(null);
  setIsGeneratingQuiz(false);
  
  // Activate Intent Mode
  setIntentMode(true);
  
  // Show friendly message
  toast.info('Contenuto non analizzabile. Aggiungi almeno 30 parole per condividere.');
  
  return;
}

if (result.error || !result.questions) {
  toast.dismiss();
  console.log('[ComposerModal] Second retry error, activating Intent Mode');
  addBreadcrumb('retry_error_intent', { error: result.error });
  
  setShowQuiz(false);
  setQuizData(null);
  setIsGeneratingQuiz(false);
  
  setIntentMode(true);
  toast.info('Contenuto non analizzabile. Aggiungi almeno 30 parole per condividere.');
  
  return;
}
```

---

## Flusso Risultante

| Tentativo | Esito | Comportamento |
|-----------|-------|---------------|
| 1° | Fallisce con error_code | Modal "Riprova Analisi" con pulsante RefreshCw |
| 2° (Retry) | Fallisce ancora | Chiude modal → Attiva Intent Mode → Word counter visibile |

---

## Garanzie Anti-Regressione

1. **1° tentativo invariato**: La logica che mostra il modal "Riprova Analisi" rimane intatta
2. **Intent Mode esistente**: L'UI con word counter e validazione 30+ parole è già implementata
3. **Altre piattaforme non toccate**: Spotify, YouTube, Web funzionano normalmente
4. **runGateBeforeAction non modificato**: Il flusso per commenti/messaggi rimane separato
5. **Caso successo**: Se il retry funziona, mostra il quiz normalmente (linee 730-737)

---

## Test Post-Implementazione

1. **Contenuto che fallisce due volte**:
   - 1° tentativo → Modal "Riprova Analisi"
   - Click su "Riprova Analisi" → (fallisce) → Intent Mode attivo
   - Word counter visibile, utente scrive 30+ parole → Pubblica abilitato

2. **Contenuto che passa al 2° tentativo**:
   - Nessuna regressione, quiz normale mostrato


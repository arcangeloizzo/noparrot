

# Piano: Migliorare Feedback Visivo Trascrizione Video

## Problemi Identificati

### 1. **Toast "Trascrizione in corso..." sparisce dopo 5 secondi**
L'unico feedback e' un toast temporaneo che sparisce rapidamente. L'utente non ha modo di sapere se il processo e' ancora attivo.

### 2. **Nessun indicatore di progresso persistente**
Il pulsante "Trascrivi" diventa opaco (disabled) ma non c'e' alcun indicatore che mostri che il processo e' in corso.

### 3. **Pulsante "Pubblica" sempre attivo durante trascrizione**
L'utente puo' premere "Pubblica" e potenzialmente interrompere il processo di trascrizione.

### 4. **Overlay "pending" poco visibile**
L'overlay di elaborazione (loader sulla preview) e' piccolo e non comunica chiaramente lo stato.

### 5. **Messaggio sotto la preview troppo discreto**
Il testo "Stiamo mettendo a fuoco il testo..." e' piccolo e poco visibile.

---

## Soluzioni Proposte

### A. **Bloccare "Pubblica" durante trascrizione attiva**

```typescript
// In ComposerModal.tsx, aggiornare canPublish
const hasPendingTranscription = uploadedMedia.some(m => 
  m.extracted_status === 'pending' && m.extracted_kind === 'transcript'
);

const canPublish = !hasPendingExtraction && 
  !hasPendingTranscription &&  // <-- NUOVO
  (content.trim().length > 0 || uploadedMedia.length > 0 || !!detectedUrl || !!quotedPost) && 
  intentWordsMet;
```

### B. **Mostrare un overlay persistente durante la trascrizione**

Aggiungere un overlay full-modal (ma non bloccante) che mostra lo stato della trascrizione:

```typescript
// In ComposerModal.tsx, nuovo componente
{hasPendingTranscription && (
  <div className="absolute inset-x-0 top-0 z-40 bg-gradient-to-b from-black/80 to-transparent pt-safe pb-6 px-4">
    <div className="flex items-center gap-3 bg-primary/20 border border-primary/30 rounded-xl px-4 py-3">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
      <div className="flex-1">
        <p className="text-sm font-medium text-white">Trascrizione in corso...</p>
        <p className="text-xs text-muted-foreground">Il video viene analizzato, potrebbe richiedere fino a 60 secondi</p>
      </div>
    </div>
  </div>
)}
```

### C. **Pulsante Pubblica con stato visivo**

Mostrare stato diverso quando trascrizione e' in corso:

```typescript
// Pulsante Pubblica con feedback
<Button 
  onClick={handlePublish}
  disabled={!canPublish || hasPendingTranscription}
  className={cn(
    // ... classi esistenti,
    hasPendingTranscription && "opacity-50"
  )}
>
  {hasPendingTranscription ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      Attendere...
    </>
  ) : (
    'Pubblica'
  )}
</Button>
```

### D. **Progress Indicator nella MediaPreviewTray**

Migliorare l'overlay di pending con un messaggio piu' chiaro:

```typescript
// In MediaPreviewTray.tsx, sostituire l'overlay pending
{isPending && (
  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10 gap-3">
    <div className="bg-black/80 backdrop-blur-sm rounded-full p-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
    <div className="text-center px-4">
      <p className="text-white text-sm font-medium">
        {item.extracted_kind === 'transcript' ? 'Trascrizione in corso' : 'Estrazione testo'}
      </p>
      <p className="text-white/60 text-xs mt-1">
        {item.extracted_kind === 'transcript' ? 'Circa 30-60 secondi' : 'Pochi secondi'}
      </p>
    </div>
  </div>
)}
```

### E. **Banner persistente sotto la preview (piu' visibile)**

```typescript
// In MediaPreviewTray.tsx, migliorare il feedback
{media.some(m => m.extracted_status === 'pending') && (
  <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2.5">
    <Loader2 className="w-5 h-5 animate-spin text-primary" />
    <div className="flex-1">
      <span className="text-sm font-medium text-primary">
        {media.find(m => m.extracted_kind === 'transcript') 
          ? 'Trascrizione video in corso...'
          : 'Estrazione testo in corso...'}
      </span>
      <p className="text-xs text-muted-foreground mt-0.5">
        Non chiudere questa schermata
      </p>
    </div>
  </div>
)}
```

### F. **Toast di conferma finale**

Quando la trascrizione termina con successo, mostrare un toast chiaro:

```typescript
// In ComposerModal.tsx, useEffect per monitorare cambio stato
useEffect(() => {
  const justCompleted = uploadedMedia.find(m => 
    m.extracted_status === 'done' && 
    m.extracted_kind === 'transcript' &&
    m.extracted_text
  );
  
  if (justCompleted && isTranscribing) {
    toast.success('Trascrizione completata! Ora puoi pubblicare.');
    setIsTranscribing(false);
  }
}, [uploadedMedia]);
```

---

## Riepilogo UX Migliorata

| Momento | Prima | Dopo |
|---------|-------|------|
| Clicca "Trascrivi" | Toast che sparisce | Toast + Overlay persistente |
| Durante trascrizione | Solo loader piccolo | Banner visibile + Pulsante "Attendere..." |
| Pulsante Pubblica | Sempre attivo | Disabilitato con testo "Attendere..." |
| Fine trascrizione | Badge "Pronto" discreto | Toast successo + Badge |
| Errore trascrizione | Badge "Errore" | Toast errore + Badge |

---

## Flusso Utente Corretto

```text
1. Utente carica video
2. Vede anteprima con pulsante "Trascrivi"
3. Clicca "Trascrivi"
4. IMMEDIATAMENTE:
   - Toast "Trascrizione avviata"
   - Overlay sul video con spinner e "Trascrizione in corso (30-60s)"
   - Banner sotto la preview "Non chiudere questa schermata"
   - Pulsante Pubblica → "Attendere..."
5. DURANTE (polling ogni 2s):
   - Tutto resta visibile e persistente
   - Utente capisce chiaramente che deve aspettare
6. FINE SUCCESSO:
   - Toast "Trascrizione completata!"
   - Badge verde "Pronto"
   - Pulsante torna "Pubblica"
7. FINE ERRORE:
   - Toast rosso con messaggio specifico
   - Badge rosso "Errore"
   - Pulsante torna "Pubblica" (l'utente puo' riprovare o pubblicare senza trascrizione)
```

---

## File da Modificare

| File | Modifica |
|------|----------|
| `src/components/composer/ComposerModal.tsx` | Bloccare Pubblica durante trascrizione, aggiungere banner header, toast finale |
| `src/components/media/MediaPreviewTray.tsx` | Overlay pending migliorato, banner sotto preview piu' visibile |


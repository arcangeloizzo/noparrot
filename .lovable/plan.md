
# Piano: Risolvere Definitivamente UX Trascrizione Video

## Problema Identificato

L'analisi approfondita ha rivelato **3 bug critici** che causano l'esperienza pessima:

### 1. Timeout `isTranscribing` troppo breve (500ms)
```typescript
// ComposerModal.tsx:138
setTimeout(() => setIsTranscribing(false), 500);
```
Il flag locale `isTranscribing` si resetta dopo **500ms**, ma l'aggiornamento al database puo' impiegare 1-2 secondi. Risultato: il pulsante "Trascrivi" si riabilita mentre lo stato e' ancora `idle` nel DB, causando doppi click.

### 2. Il pulsante Pubblica non e' bloccato dalla trascrizione
```typescript
// MediaPreviewTray.tsx:141
const isPending = item.extracted_status === 'pending' || isTranscribing;
```
`isPending` e' calcolato per ogni singolo item, ma il **pulsante Pubblica** dipende da `hasPendingTranscription` che legge solo dallo stato database, non dal flag locale `isTranscribing`. Quando `isTranscribing` si resetta (500ms) e il polling non ha ancora letto `pending` dal DB, il pulsante Pubblica resta cliccabile.

### 3. Errori non mostrati all'utente
Quando Deepgram o la generazione quiz fallisce, il toast e' generico ("Errore generazione quiz") senza dettagli. L'utente non capisce cosa e' successo.

---

## Soluzioni

### Fix 1: Stato `isTranscribing` persistente fino al cambio DB

Attualmente: `isTranscribing` si resetta dopo 500ms.

Nuovo comportamento: `isTranscribing` resta `true` finche' il media non transita a `done` o `failed`.

```typescript
// ComposerModal.tsx - Nuovo approccio
const [transcribingMediaId, setTranscribingMediaId] = useState<string | null>(null);

const handleRequestTranscription = async (mediaId: string) => {
  if (transcribingMediaId) return; // Guard
  setTranscribingMediaId(mediaId);
  const success = await requestTranscription(mediaId);
  if (!success) {
    setTranscribingMediaId(null); // Solo se fallisce subito
    toast.error('Impossibile avviare la trascrizione');
  }
};

// Reset quando il media completa (in useEffect esistente)
useEffect(() => {
  if (transcribingMediaId) {
    const media = uploadedMedia.find(m => m.id === transcribingMediaId);
    if (media && (media.extracted_status === 'done' || media.extracted_status === 'failed')) {
      setTranscribingMediaId(null); // Reset solo quando DB conferma
    }
  }
}, [uploadedMedia, transcribingMediaId]);
```

### Fix 2: Blocco corretto di Trascrivi + Pubblica

Usare `transcribingMediaId` (flag locale) combinato con `hasPendingTranscription` (da DB):

```typescript
// Blocco ENTRAMBI i pulsanti
const isTranscriptionInProgress = !!transcribingMediaId || hasPendingTranscription;

// Pulsante Pubblica
<Button disabled={!canPublish || isLoading || isTranscriptionInProgress}>
  {isTranscriptionInProgress ? (
    <><Loader2 className="animate-spin" /> Attendere...</>
  ) : 'Pubblica'}
</Button>

// MediaPreviewTray riceve il flag
<MediaPreviewTray
  isTranscribing={isTranscriptionInProgress}
  // ...
/>
```

### Fix 3: Messaggi di errore dettagliati

Catturare e mostrare errori specifici sia dalla trascrizione che dal quiz:

```typescript
// useMediaUpload.ts - Ritornare dettagli errore
const requestTranscription = async (mediaId: string): Promise<{ 
  success: boolean; 
  error?: string; 
  errorCode?: string 
}> => {
  // ...
  const { data, error } = await supabase.functions.invoke('extract-media-text', {...});
  if (error || data?.error) {
    return { 
      success: false, 
      error: data?.error || error.message,
      errorCode: data?.errorCode 
    };
  }
  return { success: true };
};

// ComposerModal.tsx - Mostrare errori specifici
const result = await requestTranscription(mediaId);
if (!result.success) {
  const errorMessages: Record<string, string> = {
    'video_too_long': 'Video troppo lungo (max 3 minuti)',
    'file_too_large': 'File troppo pesante per la trascrizione',
    'service_unavailable': 'Servizio temporaneamente non disponibile',
    'transcription_failed': 'Trascrizione fallita. Puoi pubblicare senza test.'
  };
  toast.error(errorMessages[result.errorCode || ''] || result.error || 'Errore trascrizione');
}
```

### Fix 4: Consenti publish senza test se fallisce

Quando la trascrizione o il quiz fallisce, permettere la pubblicazione con avviso:

```typescript
// ComposerModal.tsx - handleMediaGateFlow
if (result.error || !result.questions) {
  // NON bloccare - consenti publish senza test
  toast.warning('Impossibile generare il test. Puoi pubblicare comunque.', {
    duration: 5000
  });
  // Resetta stati e procedi alla pubblicazione diretta
  setIsGeneratingQuiz(false);
  await publishPost(); // Pubblica senza gate
  return;
}
```

---

## Flusso UX Corretto

```text
Stato: IDLE
┌─────────────────────────────────────┐
│  [Video Preview]                    │
│  └ [Trascrivi]  (cliccabile)        │
│                                     │
│  [      Pubblica      ]  (attivo)   │
└─────────────────────────────────────┘
                 │
                 ▼ Clicca "Trascrivi"
                 
Stato: TRANSCRIBING (immediato, locale)
┌─────────────────────────────────────┐
│  [Video Preview]                    │
│  ├ OVERLAY: Loader + "30-60 sec"    │
│  └ [Trascrivi]  (disabilitato)      │
│                                     │
│  Banner: "Non chiudere schermata"   │
│                                     │
│  [Loader + Attendere...]  (disab.)  │
└─────────────────────────────────────┘
                 │
                 ▼ Polling ogni 2s
                 
Stato: DONE (da DB)
┌─────────────────────────────────────┐
│  Toast: "Trascrizione completata!"  │
│  [Video Preview]                    │
│  └ Badge verde "Pronto"             │
│                                     │
│  [      Pubblica      ]  (attivo)   │
└─────────────────────────────────────┘

Stato: FAILED (da DB)
┌─────────────────────────────────────┐
│  Toast: "Errore: [motivo specifico]"│
│  Toast: "Puoi pubblicare comunque"  │
│  [Video Preview]                    │
│  └ Badge rosso "Errore"             │
│  └ [Riprova] (opzionale)            │
│                                     │
│  [      Pubblica      ]  (attivo)   │
└─────────────────────────────────────┘
```

---

## File da Modificare

| File | Modifica |
|------|----------|
| `src/components/composer/ComposerModal.tsx` | 1. Nuovo stato `transcribingMediaId` persistente; 2. Blocco Pubblica con `isTranscriptionInProgress`; 3. Toast errori dettagliati; 4. Publish senza test se fallisce |
| `src/components/media/MediaPreviewTray.tsx` | 1. Usare `isTranscribing` passato dal parent per disabilitare tutti i controlli; 2. Badge "Riprova" se fallito |
| `src/hooks/useMediaUpload.ts` | 1. `requestTranscription` ritorna `{ success, error, errorCode }`; 2. Await dell'invoke (non fire-and-forget) per catturare errori immediati |

---

## Dettagli Tecnici

### useMediaUpload.ts - Modifiche

```typescript
// PRIMA (fire-and-forget)
supabase.functions.invoke('extract-media-text', {...}).catch(err => {...});
return true;

// DOPO (await + errori)
const { data, error } = await supabase.functions.invoke('extract-media-text', {...});
if (error) {
  return { success: false, error: error.message };
}
if (data?.error) {
  return { success: false, error: data.error, errorCode: data.error };
}
return { success: true };
```

### ComposerModal.tsx - Gestione Stato Persistente

```typescript
// Nuovo stato
const [transcribingMediaId, setTranscribingMediaId] = useState<string | null>(null);

// Flag combinato per UI
const isTranscriptionInProgress = !!transcribingMediaId || hasPendingTranscription;

// Reset quando completa
useEffect(() => {
  if (!transcribingMediaId) return;
  const media = uploadedMedia.find(m => m.id === transcribingMediaId);
  if (media?.extracted_status === 'done') {
    toast.success('Trascrizione completata!');
    setTranscribingMediaId(null);
  }
  if (media?.extracted_status === 'failed') {
    toast.error('Trascrizione fallita. Puoi pubblicare comunque.');
    setTranscribingMediaId(null);
  }
}, [uploadedMedia, transcribingMediaId]);

// Handler aggiornato
const handleRequestTranscription = async (mediaId: string) => {
  if (transcribingMediaId) return;
  setTranscribingMediaId(mediaId);
  toast.info('Trascrizione avviata...');
  
  const result = await requestTranscription(mediaId);
  if (!result.success) {
    setTranscribingMediaId(null);
    const msg = {
      'video_too_long': 'Video troppo lungo (max 3 minuti)',
      'file_too_large': 'File troppo pesante',
      'service_unavailable': 'Servizio non disponibile'
    }[result.errorCode || ''] || 'Impossibile avviare la trascrizione';
    toast.error(msg);
  }
  // Se success, NON resettare - aspetta polling
};
```

### handleMediaGateFlow - Fallback Publish

```typescript
const handleMediaGateFlow = async (media: typeof uploadedMedia[0]) => {
  // ... generazione quiz ...
  
  if (result.error || !result.questions) {
    // NUOVO: Non bloccare, consenti publish
    toast.warning('Test non disponibile. Puoi pubblicare comunque.');
    setIsGeneratingQuiz(false);
    await publishPost(); // Procedi senza gate
    return;
  }
  
  // Quiz valido - mostra
  setQuizData({...});
  setShowQuiz(true);
};
```

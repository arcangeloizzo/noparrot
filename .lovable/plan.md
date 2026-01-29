

# Piano: Integrazione Media OCR nel Comprehension Gate

## Obiettivo

Fare in modo che le immagini con OCR completato (testo estratto sufficiente) attivino il Comprehension Gate (quiz) prima della pubblicazione, mantenendo inalterati tutti i flussi esistenti per link, YouTube, X, LinkedIn, quoted post e reshare.

---

## Analisi del Flusso Attuale

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          handlePublish()                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─ detectedUrl? ─────────────────────────────────────────────────────────┐│
│   │                                                                         ││
│   │   ┌─ intentMode? ────────┐    ┌─ urlPreview ok? ─────────────────────┐ ││
│   │   │                      │    │                                       │ ││
│   │   │  publishPost(true)   │    │  showReader=true → Reader → Quiz     │ ││
│   │   │  (bypass gate)       │    │  → publishPost() dopo quiz pass      │ ││
│   │   └──────────────────────┘    └───────────────────────────────────────┘ ││
│   └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│   ┌─ NO detectedUrl ───────────────────────────────────────────────────────┐│
│   │                                                                         ││
│   │   publishPost() direttamente                                            ││
│   │   (nessun gate, anche con media OCR!)    ← PROBLEMA                    ││
│   └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Soluzione Proposta

Aggiungere un nuovo branch in `handlePublish()` che intercetta i media con OCR completato e genera il quiz direttamente (senza Reader, perché l'utente ha già visto l'immagine).

### Nuovo Flusso

```text
handlePublish()
  │
  ├─ detectedUrl? → [flusso esistente - INVARIATO]
  │
  ├─ mediaWithExtractedText? → [NUOVO: genera quiz da mediaId → showQuiz]
  │
  └─ else → publishPost() [flusso esistente - INVARIATO]
```

---

## Modifiche Tecniche

### File: `src/components/composer/ComposerModal.tsx`

#### 1. Nuova Helper per Rilevare Media con Testo Estratto

```typescript
// Cerca media con OCR/trascrizione completata e testo sufficiente (>120 chars)
const mediaWithExtractedText = uploadedMedia.find(m => 
  m.extracted_status === 'done' && 
  m.extracted_text && 
  m.extracted_text.length > 120
);
```

#### 2. Aggiornamento `gateStatus` per Feedback UI

Modificare la sezione `gateStatus` per includere i media con OCR:

```typescript
const gateStatus = (() => {
  // Gate attivo se c'è un URL
  if (detectedUrl) {
    return { label: 'Gate attivo', requiresGate: true };
  }
  
  // [NUOVO] Gate attivo se c'è media con testo estratto
  if (mediaWithExtractedText) {
    return { 
      label: mediaWithExtractedText.extracted_kind === 'ocr' 
        ? 'Gate OCR attivo' 
        : 'Gate trascrizione attivo', 
      requiresGate: true 
    };
  }
  
  // Gate sui caratteri SOLO per ricondivisioni (quotedPost presente)
  if (quotedPost) {
    const wordCount = getWordCount(content);
    if (wordCount > 120) {
      return { label: 'Gate completo', requiresGate: true };
    }
    if (wordCount > 30) {
      return { label: 'Gate light', requiresGate: true };
    }
  }
  
  // Nessun gate per testo libero senza URL
  return { label: 'Nessun gate', requiresGate: false };
})();
```

#### 3. Nuovo Branch in `handlePublish()`

Inserire il nuovo branch DOPO il check per `detectedUrl` ma PRIMA del fallback a `publishPost()`:

```typescript
const handlePublish = async () => {
  if (!user || (!content.trim() && !detectedUrl && uploadedMedia.length === 0 && !quotedPost)) return;
  
  // [ESISTENTE] Branch per URL
  if (detectedUrl) {
    // ... codice esistente INVARIATO ...
    return;
  }
  
  // [NUOVO] Branch per media con testo estratto (OCR/trascrizione)
  if (mediaWithExtractedText) {
    console.log('[Composer] Media with extracted text detected, triggering gate');
    addBreadcrumb('media_gate_start', { 
      mediaId: mediaWithExtractedText.id,
      kind: mediaWithExtractedText.extracted_kind,
      textLength: mediaWithExtractedText.extracted_text?.length
    });
    
    await handleMediaGateFlow(mediaWithExtractedText);
    return;
  }
  
  // [ESISTENTE] Fallback: nessun gate
  await publishPost();
};
```

#### 4. Nuova Funzione `handleMediaGateFlow()`

Simile a `handleIOSQuizOnlyFlow()` ma per media:

```typescript
const handleMediaGateFlow = async (media: MediaFile) => {
  if (isGeneratingQuiz) return;
  
  try {
    setIsGeneratingQuiz(true);
    addBreadcrumb('media_generating_quiz');
    
    toast.loading('Stiamo mettendo a fuoco ciò che conta…');
    
    const result = await generateQA({
      contentId: null,
      isPrePublish: true,
      title: '', // Media non ha titolo
      qaSourceRef: { kind: 'mediaId', id: media.id },
      sourceUrl: undefined,
      userText: content,
      testMode: 'SOURCE_ONLY', // Per media, sempre SOURCE_ONLY
    });
    
    toast.dismiss();
    addBreadcrumb('media_qa_generated', { 
      hasQuestions: !!result.questions, 
      error: result.error,
      pending: result.pending
    });
    
    // Handle pending (estrazione ancora in corso)
    if (result.pending) {
      toast.info('Estrazione testo in corso, riprova tra qualche secondo...');
      setIsGeneratingQuiz(false);
      return;
    }
    
    if (result.insufficient_context) {
      // Testo insufficiente: fallback a Intent Gate
      console.log('[Composer] Media text insufficient, activating intent mode');
      toast.warning('Testo insufficiente per il test. Aggiungi almeno 30 parole.');
      setIntentMode(true);
      setIsGeneratingQuiz(false);
      return;
    }
    
    if (result.error || !result.questions) {
      console.error('[ComposerModal] Media quiz generation failed:', result.error);
      toast.error('Errore generazione quiz. Riprova.');
      setIsGeneratingQuiz(false);
      return; // Non pubblicare - gate mandatory
    }
    
    // Mostra quiz
    setQuizData({
      qaId: result.qaId,
      questions: result.questions,
      sourceUrl: `media://${media.id}`, // Identificatore speciale per media
    });
    setShowQuiz(true);
    addBreadcrumb('media_quiz_mount');
    
  } catch (error) {
    console.error('[ComposerModal] Media gate flow error:', error);
    toast.dismiss();
    toast.error('Errore durante la generazione del quiz. Riprova.');
    addBreadcrumb('media_gate_error', { error: String(error) });
  } finally {
    setIsGeneratingQuiz(false);
  }
};
```

#### 5. Nessuna Modifica ai Flussi Esistenti

I seguenti flussi rimangono **completamente invariati**:
- Link esterni (URL detection → Reader → Quiz)
- YouTube (qaSourceRef.kind === 'youtubeId')
- Spotify (qaSourceRef.kind === 'spotifyId')
- Twitter/X (qaSourceRef.kind === 'tweetId')
- Quoted post/Reshare (quotedPost presente)
- Intent mode per piattaforme bloccate

---

## Aggiornamento ai-helpers.ts

Il tipo `QASourceRef` è già stato aggiornato nella precedente implementazione per includere `mediaId`:

```typescript
export interface QASourceRef {
  kind: 'url' | 'youtubeId' | 'spotifyId' | 'tweetId' | 'mediaId';
  id: string;
  url?: string;
}
```

---

## UX e Feedback

### Indicatore Gate nel Composer

Quando è presente un media con OCR completato, l'indicatore mostrerà:
- `"Gate OCR attivo"` per immagini
- `"Gate trascrizione attivo"` per video

### Flusso Utente

1. Utente carica immagine/screenshot
2. OCR parte automaticamente (se heuristica passa)
3. Badge verde "Testo estratto (X caratteri)" appare
4. Indicatore "Gate OCR attivo" appare in basso
5. Utente clicca "Pubblica"
6. Quiz appare direttamente (senza Reader - l'utente ha già visto l'immagine)
7. Se quiz passato → post pubblicato
8. Se quiz fallito → ritorno al composer

### Fallback Intent Gate

Se l'OCR produce testo insufficiente (<120 caratteri):
- `generate-qa` ritorna `insufficient_context: true`
- Composer attiva `intentMode`
- Utente deve aggiungere 30+ parole di contesto

---

## Riepilogo Modifiche

| File | Modifica | Impatto |
|------|----------|---------|
| `ComposerModal.tsx` | Aggiungere `mediaWithExtractedText` check | Rileva media con OCR |
| `ComposerModal.tsx` | Aggiornare `gateStatus` | Feedback UI gate OCR |
| `ComposerModal.tsx` | Nuovo branch in `handlePublish()` | Intercetta media OCR |
| `ComposerModal.tsx` | Nuova funzione `handleMediaGateFlow()` | Genera quiz da media |

**Flussi NON modificati:**
- Link detection e Reader
- YouTube transcription
- Spotify lyrics
- Twitter/X embed
- LinkedIn extraction
- Quoted post/Reshare
- Intent mode

---

## Note Tecniche

### Perché No Reader per Media?

A differenza dei link esterni, l'utente ha già visto l'immagine/video nel composer. Il Reader serve per consumare contenuti esterni prima del quiz. Per i media, questo step non è necessario.

### Soglia 120 Caratteri

La soglia di 120 caratteri è la stessa usata in `generate-qa` per determinare se il testo estratto è sufficiente. Questo garantisce coerenza tra frontend e backend.

### sourceUrl per Media

Per i media, usiamo `media://{mediaId}` come sourceUrl identificativo nei log e nel cache. Questo non influenza il flusso ma aiuta il debugging.



# Universal Semantic Quality Guardrail & Mandatory Retry UI

## Obiettivo

Implementare un sistema di protezione semantica a livello universale che:
1. **Escluda rigorosamente** le domande basate su metadati di piattaforma
2. **Applichi la logica a TUTTE le fonti** (LinkedIn, Spotify, YouTube, Web generici)
3. **Intercetti quiz low-quality DOPO la generazione AI** (doppio filtro)
4. **Forzi la Retry UI** come fallback obbligatorio per contenuti rumorosi

---

## Architettura del Sistema

```text
┌─────────────────────────────────────────────────────────────────┐
│                     FLUSSO DI GENERAZIONE QUIZ                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Estrazione Contenuto (Jina/Firecrawl/Cache)                 │
│                     ↓                                            │
│  2. PRE-VALIDATION: validateContentQuality()                     │
│     • MetadataRatio > 0.30 → ERROR_METADATA_ONLY                │
│     • Contenuto < 150 chars → ERROR_INSUFFICIENT_CONTENT        │
│                     ↓                                            │
│  3. AI Generation (Gemini) con prompt anti-metadata             │
│                     ↓                                            │
│  4. POST-VALIDATION: validateGeneratedQuestions()  ← NUOVO      │
│     • Rileva domande generiche (titolo, formato, piattaforma)   │
│     • MetadataRatio > 0.45 → ERROR_LOW_QUALITY_QUIZ             │
│                     ↓                                            │
│  5. Return Quiz OR Error Code                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND HANDLING                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  IF error_code in [ERROR_METADATA_ONLY,                         │
│                    ERROR_INSUFFICIENT_CONTENT,                  │
│                    ERROR_LOW_QUALITY_QUIZ]:                     │
│                     ↓                                            │
│  → Show Retry Modal with "Riprova Analisi" (forceRefresh=true)  │
│                                                                  │
│  ELSE: Show standard quiz                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Backend: Prompt AI con Strict Metadata Exclusion

**File:** `supabase/functions/generate-qa/index.ts`

### Aggiornare il System Prompt (linea 986)

Attualmente il system prompt è minimo. Aggiungere istruzioni esplicite anti-metadata:

```typescript
const systemPrompt = `Sei un assistente per quiz di comprensione. Rispondi sempre in JSON valido.

REGOLE CRITICHE - ESCLUSIONI OBBLIGATORIE:
❌ MAI generare domande su:
- Metadati di piattaforma (numero di like, follower, commenti, reactions)
- Elementi UI (pulsanti, menu, navigazione, login)
- Formato tecnico del contenuto (audio, video, testo, immagine)
- Nome della piattaforma (Spotify, LinkedIn, YouTube, Twitter)
- Titolo del brano/video/articolo (a meno che sia l'UNICO dato disponibile)
- Cookie policy, privacy policy, termini di servizio
- Date di pubblicazione o statistiche di visualizzazione

✅ Genera domande SOLO su:
- Contenuto semantico effettivo (argomento, tema, messaggio)
- Fatti, dati, affermazioni presenti nel testo
- Opinioni e argomentazioni dell'autore
- Contesto e significato del contenuto

Se il testo sorgente contiene SOLO o PRINCIPALMENTE metadati di piattaforma, 
rispondi con: {"insufficient_context": true, "reason": "metadata_only"}`;
```

### Aggiornare l'User Prompt (linee 916-975)

Aggiungere avvertimento esplicito alla fine del prompt:

```typescript
const prompt = `Sei un assistente esperto nella valutazione della comprensione.

${contentDescription}

REGOLE GENERAZIONE:
${questionRules}

${isVideo && testMode === 'SOURCE_ONLY' ? `NOTA: Poiché questo è un video...` : ''}

2. Per ogni domanda:
   - 3 opzioni di risposta (A, B, C)
   - Solo 1 opzione corretta
   - Le altre 2 plausibili ma sbagliate
   - Difficoltà media (no trabocchetti)
   - IMPORTANTE: Varia la posizione della risposta corretta tra A, B, C

⚠️ ESCLUSIONI OBBLIGATORIE:
- NON chiedere "Quanti like ha ricevuto?" o simili
- NON chiedere "Su quale piattaforma è stato pubblicato?"
- NON chiedere "Qual è il titolo?" (a meno che sia il solo dato)
- NON chiedere informazioni su formato audio/video/testo
- Se non riesci a generare 3 domande sul CONTENUTO EFFETTIVO, 
  restituisci {"insufficient_context": true, "reason": "metadata_only"}

3. OUTPUT JSON rigoroso:
...rest of prompt...`;
```

---

## 2. Backend: Post-Generation Quality Check

**File:** `supabase/functions/generate-qa/index.ts`

### Nuova Funzione: validateGeneratedQuestions() (dopo linea 163)

Questo è un SECONDO filtro dopo la generazione AI per intercettare quiz low-quality:

```typescript
// ============================================================================
// POST-GENERATION QUALITY CHECK - Detect generic/metadata-based questions
// ============================================================================
interface QuestionValidation {
  isValid: boolean;
  reason?: 'generic_questions' | 'metadata_questions' | 'platform_questions';
}

function validateGeneratedQuestions(questions: any[]): QuestionValidation {
  if (!questions || questions.length === 0) {
    return { isValid: false, reason: 'generic_questions' };
  }
  
  // Patterns that indicate low-quality/metadata questions
  const genericPatterns = [
    // Platform metadata
    /quanti? (like|follower|commenti|reaction|visualizzazion)/i,
    /numero di (like|follower|commenti|reaction|view)/i,
    /(like|follower|commenti) (ha ricevuto|sono stati|ci sono)/i,
    
    // Platform identity
    /quale piattaforma/i,
    /su (spotify|linkedin|youtube|twitter|instagram|tiktok|facebook)/i,
    /(pubblicato|condiviso) su quale/i,
    
    // Format/technical
    /(formato|tipo) (del contenuto|di file|multimediale)/i,
    /(audio|video|immagine|testo) (è|sia|formato)/i,
    
    // Title-only questions (weak signal, check if it's the ONLY question type)
    /qual è il titolo/i,
    /come si intitola/i,
    /il titolo (del brano|della canzone|del video|dell'articolo)/i,
    
    // Cookie/privacy (should never appear)
    /cookie policy/i,
    /privacy policy/i,
    /termini di servizio/i,
    
    // Engagement metrics
    /popolarità (su spotify|del brano)/i,
    /quanto è popolare/i,
  ];
  
  let genericQuestionCount = 0;
  
  for (const question of questions) {
    const stem = question.stem || question.question || '';
    
    for (const pattern of genericPatterns) {
      if (pattern.test(stem)) {
        genericQuestionCount++;
        console.log(`[validateGeneratedQuestions] ⚠️ Generic question detected: "${stem.substring(0, 50)}..."`);
        break;
      }
    }
  }
  
  // If MORE than 1 question out of 3 is generic, reject the quiz
  const genericRatio = genericQuestionCount / questions.length;
  if (genericRatio > 0.33) { // More than 1/3 generic = bad quiz
    console.log(`[validateGeneratedQuestions] ❌ Too many generic questions: ${genericQuestionCount}/${questions.length}`);
    return { isValid: false, reason: 'generic_questions' };
  }
  
  return { isValid: true };
}
```

### Integrare il Check Post-Generazione (dopo linea 1056)

Dopo il parsing del JSON e prima del salvataggio:

```typescript
// ... existing parsing code ...

if (parsedContent.insufficient_context) {
  // Check if AI explicitly flagged metadata-only
  if (parsedContent.reason === 'metadata_only') {
    return new Response(
      JSON.stringify({ 
        error_code: 'ERROR_METADATA_ONLY',
        message: 'Il contenuto contiene solo metadati di piattaforma'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  return new Response(
    JSON.stringify({ insufficient_context: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// NEW: POST-GENERATION QUALITY CHECK
const questionValidation = validateGeneratedQuestions(parsedContent.questions);
if (!questionValidation.isValid) {
  console.log(`[generate-qa] ❌ Generated questions failed quality check: ${questionValidation.reason}`);
  return new Response(
    JSON.stringify({ 
      error_code: 'ERROR_LOW_QUALITY_QUIZ',
      message: 'Le domande generate non riflettono il contenuto effettivo. Riprova per un\'analisi migliore.',
      reason: questionValidation.reason
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Validate schema
if (!parsedContent.questions || parsedContent.questions.length !== expectedQuestions) {
  ...
}
```

---

## 3. Backend: Aumentare Soglia Metadata Ratio

**File:** `supabase/functions/generate-qa/index.ts`

### Modificare validateContentQuality (linea 157)

Attualmente la soglia è 0.30 (30%). Aumentare a 0.45 per ridurre falsi positivi ma mantenere protezione:

```typescript
// Linea 157 - Aumentare soglia
if (metadataRatio > 0.45) { // Era 0.30, ora 0.45 per ridurre falsi positivi
  console.log(`[generate-qa] ⚠️ Content is ${Math.round(metadataRatio * 100)}% platform metadata`);
  return { isValid: false, metadataRatio, errorCode: 'ERROR_METADATA_ONLY' };
}
```

---

## 4. Frontend: Supporto Nuovo Error Code

**File:** `src/lib/ai-helpers.ts`

### Aggiornare il tipo error_code

```typescript
export interface QAGenerationResult {
  qaId?: string;
  questions?: QuizQuestion[];
  insufficient_context?: boolean;
  pending?: boolean;
  error?: string;
  // Updated: Add new error code
  error_code?: 'ERROR_INSUFFICIENT_CONTENT' | 'ERROR_METADATA_ONLY' | 'ERROR_LOW_QUALITY_QUIZ';
  metadata_ratio?: number;
  message?: string;
  reason?: string;
}
```

---

## 5. Frontend: QuizModal - Gestire Nuovo Error Code

**File:** `src/components/ui/quiz-modal.tsx`

### Aggiornare Interface (linea 23-26)

```typescript
errorState?: {
  code: 'ERROR_INSUFFICIENT_CONTENT' | 'ERROR_METADATA_ONLY' | 'ERROR_LOW_QUALITY_QUIZ';
  message: string;
};
```

### Aggiornare Messaggio (linee 117-120)

```typescript
<p className="text-muted-foreground mb-6 text-sm">
  {errorState.code === 'ERROR_METADATA_ONLY' 
    ? "Il contenuto estratto contiene troppi elementi di interfaccia. Riprova per un'analisi più accurata."
    : errorState.code === 'ERROR_LOW_QUALITY_QUIZ'
    ? "Le domande generate non riflettono il vero contenuto. Riprova per una migliore analisi."
    : "Non è stato possibile estrarre abbastanza contenuto dalla fonte. Riprova o aggiungi più contesto."}
</p>
```

---

## 6. Frontend: ComposerModal - Gestire Nuovo Error Code

**File:** `src/components/composer/ComposerModal.tsx`

### Verificare che handleRetryWithCacheClear gestisca anche ERROR_LOW_QUALITY_QUIZ

Il codice attuale (linea 717) gestisce già `result.error_code` genericamente, quindi dovrebbe funzionare automaticamente. Assicurarsi però che il messaggio di toast sia appropriato:

```typescript
// Linea 717-720
if (result.error_code) {
  const errorMessage = result.error_code === 'ERROR_LOW_QUALITY_QUIZ'
    ? 'Il quiz generato non era di qualità sufficiente. Prova un\'altra fonte.'
    : 'Impossibile analizzare il contenuto. Prova con un\'altra fonte.';
  toast.error(errorMessage);
  addBreadcrumb('retry_validation_error', { code: result.error_code });
  setIsGeneratingQuiz(false);
  return;
}
```

---

## 7. Frontend: runGateBeforeAction - Gestire Nuovo Error Code

**File:** `src/lib/runGateBeforeAction.ts`

### Aggiornare il check error_code (linee 143-168)

Il codice attuale gestisce già error_code genericamente. Solo verificare che tutti i nuovi codici vengano catturati:

```typescript
// Linea 144-145: Il check esistente già funziona per tutti i codici
if (qaData.error_code) {
  console.log('[runGateBeforeAction] Content validation failed:', qaData.error_code);
  // ... existing retry UI logic works for all error codes
}
```

---

## Riepilogo Modifiche

| File | Modifiche |
|------|-----------|
| `generate-qa/index.ts` (linea 986) | System prompt con strict metadata exclusion |
| `generate-qa/index.ts` (linee 916-975) | User prompt con esclusioni esplicite |
| `generate-qa/index.ts` (dopo linea 163) | Nuova `validateGeneratedQuestions()` |
| `generate-qa/index.ts` (dopo linea 1056) | Post-generation quality check |
| `generate-qa/index.ts` (linea 157) | Soglia metadataRatio a 0.45 |
| `ai-helpers.ts` | Nuovo error_code `ERROR_LOW_QUALITY_QUIZ` |
| `quiz-modal.tsx` (linee 23, 117) | Gestione nuovo error code |
| `ComposerModal.tsx` (linea 717) | Messaggio toast per nuovo error code |

---

## Garanzie Anti-Regressione

1. **Universalità**: La logica si applica a TUTTE le fonti (la validazione è dopo l'estrazione, indipendente dalla piattaforma)
2. **Doppio Filtro**: Pre-validation (metadataRatio) + Post-validation (pattern questions)
3. **No-Parrot Policy**: Se il corpo dell'articolo manca, l'utente vede la Retry UI, mai quiz fasulli
4. **Fail-Closed**: Quiz low-quality vengono bloccati prima di essere mostrati
5. **Retry Always**: Qualsiasi error code attiva la stessa Retry UI con forceRefresh

---

## Test Post-Implementazione

1. **Spotify senza lyrics**: Deve mostrare Retry UI, non quiz su "popolarità"
2. **LinkedIn con solo UI**: Deve mostrare Retry UI, non quiz su "numero di like"
3. **YouTube senza trascrizione**: Deve mostrare Retry UI o quiz solo sul titolo se esplicito
4. **Web article valido**: Quiz normali sul contenuto
5. **Retry**: Verificare che forceRefresh pulisca cache e ritenti

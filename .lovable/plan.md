
# Content Validation & Anti-Failure System

## Obiettivo

Implementare un sistema di validazione robusto che:
1. Corregga la pulizia LinkedIn (approccio "additivo" invece di regex aggressivi)
2. Rilevi contenuti "low-quality" PRIMA della generazione quiz (errori dedicati)
3. Mostri un'UI dedicata con "Riprova Analisi" che pulisce la cache
4. Blocchi la pubblicazione fino a quiz valido completato

---

## 1. Backend: Pulizia LinkedIn Additiva

**File:** `supabase/functions/generate-qa/index.ts`

### Riscrivere `cleanLinkedInContent` (linee 102-179)

Sostituire la logica a regex broad con rimozione di SOLE stringhe specifiche:

```typescript
function cleanLinkedInContent(content: string): string {
  if (!content) return '';
  
  const originalLength = content.length;
  
  // SOLO stringhe UI specifiche da rimuovere (NO regex generici)
  const exactStringsToRemove = [
    'Sign in to view more content',
    'Join now to see who you already know',
    'See who you know',
    'Get the LinkedIn app',
    'Skip to main content',
    'LinkedIn and 3rd parties use',
    'Accept & Join LinkedIn',
    'By clicking Continue',
    'Like Comment Share',
    'Report this post',
    'Copy link to post',
    'Repost with your thoughts',
    'More from this author',
    'Welcome back',
    "Don't miss out",
    'LinkedIn Corporation ©',
    'See more',
    'Altro',
    'Mostra altro',
    'Read more',
    'Leggi tutto',
    'Edited',
    'Tradotto',
    'Modificato',
  ];
  
  let cleaned = content;
  
  // Rimuovi solo stringhe esatte (case-insensitive)
  for (const str of exactStringsToRemove) {
    const escapedStr = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(escapedStr, 'gi'), ' ');
  }
  
  // Rimuovi solo pattern markdown immagine sicuri
  cleaned = cleaned.replace(/\[Image[^\]]*\]/gi, ' ');
  cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/gi, ' ');
  
  // Rimuovi righe composte SOLO da hashtag (preserva hashtag inline)
  cleaned = cleaned.replace(/^(?:#[\w\u00C0-\u024F]+\s*)+$/gm, '');
  
  // Normalizza whitespace
  cleaned = cleaned
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // SAFEGUARD RAFFORZATO: Se pulizia riduce sotto 200 chars E originale era > 200
  if (cleaned.length < 200 && originalLength > 200) {
    console.log(`[generate-qa] ⚠️ LinkedIn cleaning too aggressive, keeping original`);
    return content;
  }
  
  console.log(`[generate-qa] LinkedIn clean: ${originalLength} -> ${cleaned.length} chars`);
  return cleaned;
}
```

---

## 2. Backend: Validation Layer ("Sistema Immunitario")

**File:** `supabase/functions/generate-qa/index.ts`

### Aggiungere dopo linea 179 (dopo cleanLinkedInContent)

```typescript
// ============================================================================
// CONTENT QUALITY VALIDATION - "Immune System" against platform noise
// ============================================================================
interface ContentValidation {
  isValid: boolean;
  metadataRatio: number;
  errorCode?: 'ERROR_INSUFFICIENT_CONTENT' | 'ERROR_METADATA_ONLY';
}

function validateContentQuality(text: string): ContentValidation {
  if (!text || text.length < 150) {
    return { isValid: false, metadataRatio: 1, errorCode: 'ERROR_INSUFFICIENT_CONTENT' };
  }
  
  // Keywords tipici di metadata/UI di piattaforma
  const platformKeywords = [
    'cookie', 'privacy', 'terms', 'log in', 'sign in', 'sign up',
    'follow', 'following', 'followers', 'reactions', 'repost',
    'spotify ab', 'linkedin corp', 'twitter inc', 'meta platforms',
    'accept cookies', 'cookie policy', 'privacy policy',
    'create account', 'join now', 'see who you know',
    'get the app', 'download app', 'open in app',
    'advertisement', 'sponsored', 'promoted',
    'skip to main', 'navigation', 'menu',
    'copyright ©', 'all rights reserved',
    'view profile', 'connect', 'message',
  ];
  
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/).filter(w => w.length > 2);
  
  if (words.length === 0) {
    return { isValid: false, metadataRatio: 1, errorCode: 'ERROR_INSUFFICIENT_CONTENT' };
  }
  
  let metadataWordCount = 0;
  for (const word of words) {
    for (const keyword of platformKeywords) {
      if (keyword.split(' ').some(kw => word.includes(kw) || kw.includes(word))) {
        metadataWordCount++;
        break;
      }
    }
  }
  
  const metadataRatio = metadataWordCount / words.length;
  
  if (metadataRatio > 0.3) {
    console.log(`[generate-qa] ⚠️ Content is ${Math.round(metadataRatio * 100)}% platform metadata`);
    return { isValid: false, metadataRatio, errorCode: 'ERROR_METADATA_ONLY' };
  }
  
  return { isValid: true, metadataRatio };
}
```

### Integrare validazione prima della generazione AI (dopo linea ~835)

Prima della chiamata Gemini, aggiungere:

```typescript
// VALIDATION LAYER: Check content quality before AI generation
const validation = validateContentQuality(finalContentText);
if (!validation.isValid) {
  console.log(`[generate-qa] ❌ Content validation failed: ${validation.errorCode}`);
  return new Response(
    JSON.stringify({ 
      error_code: validation.errorCode,
      metadata_ratio: validation.metadataRatio,
      message: validation.errorCode === 'ERROR_METADATA_ONLY' 
        ? 'Il contenuto estratto contiene troppi metadati di piattaforma'
        : 'Contenuto insufficiente per generare domande'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

## 3. Backend: Cache Invalidation per Retry

**File:** `supabase/functions/generate-qa/index.ts`

### Accettare parametro `forceRefresh` (linee ~235-240)

```typescript
const { 
  contentId, 
  isPrePublish, 
  title, 
  summary,
  excerpt, 
  type, 
  sourceUrl,
  userText,
  testMode,
  questionCount,
  qaSourceRef,
  forceRefresh  // NEW: Pulisce cache per retry
} = await req.json();
```

### Implementare pulizia cache se forceRefresh (dopo linea ~250)

```typescript
// CACHE INVALIDATION: If forceRefresh, delete cached content for this URL
if (forceRefresh && sourceUrl) {
  const normalizedUrl = safeNormalizeUrl(sourceUrl);
  console.log(`[generate-qa] 🔄 Force refresh: invalidating cache for ${normalizedUrl}`);
  
  await supabase.from('content_cache').delete().eq('source_url', normalizedUrl);
  
  // Also try with qaSourceRef.url if different
  if (qaSourceRef?.url && qaSourceRef.url !== normalizedUrl) {
    const qaUrl = safeNormalizeUrl(qaSourceRef.url);
    await supabase.from('content_cache').delete().eq('source_url', qaUrl);
  }
  
  console.log(`[generate-qa] ✅ Cache invalidated, will fetch fresh content`);
}
```

---

## 4. Frontend: Tipi Aggiornati

**File:** `src/lib/ai-helpers.ts`

### Aggiornare QAGenerationResult (linee 15-21)

```typescript
export interface QAGenerationResult {
  qaId?: string;
  questions?: QuizQuestion[];
  insufficient_context?: boolean;
  pending?: boolean;
  error?: string;
  // NEW: Validation error codes
  error_code?: 'ERROR_INSUFFICIENT_CONTENT' | 'ERROR_METADATA_ONLY';
  metadata_ratio?: number;
  message?: string;
}
```

### Aggiornare generateQA (linee 48-62)

```typescript
export async function generateQA(params: {
  contentId: string | null;
  isPrePublish?: boolean;
  title?: string;
  summary?: string;
  userText?: string;
  excerpt?: string;
  type?: 'article' | 'video' | 'audio' | 'image';
  sourceUrl?: string;
  testMode?: 'SOURCE_ONLY' | 'MIXED' | 'USER_ONLY';
  questionCount?: 1 | 3;
  qaSourceRef?: QASourceRef;
  forceRefresh?: boolean;  // NEW: Pulisce cache per retry
}): Promise<QAGenerationResult> {
```

---

## 5. Frontend: QuizModal con Error State

**File:** `src/components/ui/quiz-modal.tsx`

### Aggiungere props per error state (linee 14-22)

```typescript
interface QuizModalProps {
  questions: QuizQuestion[];
  qaId: string;
  onSubmit: (...) => Promise<...>;
  onCancel?: () => void;
  onComplete?: (passed: boolean) => void;
  provider?: string;
  postCategory?: string;
  // NEW: Error state con retry
  errorState?: {
    code: 'ERROR_INSUFFICIENT_CONTENT' | 'ERROR_METADATA_ONLY';
    message: string;
  };
  onRetry?: () => void;
}
```

### Render dedicato per error state (prima del check hasValidQuestions, ~linea 88)

```typescript
// Show dedicated error state with retry button
if (errorState) {
  return (
    <div 
      className="fixed inset-0 bg-black/80 z-[9999] pointer-events-auto"
      onClick={(e) => e.target === e.currentTarget && onCancel?.()}
    >
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl w-full max-w-md p-8 text-center shadow-2xl border border-border">
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-[hsl(var(--cognitive-incorrect))]/20 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-[hsl(var(--cognitive-incorrect))]" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-3">L'analisi del contenuto non è stata ottimale</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            {errorState.code === 'ERROR_METADATA_ONLY' 
              ? 'Il contenuto estratto contiene troppi elementi di interfaccia. Riprova per un\'analisi più accurata.'
              : 'Non è stato possibile estrarre abbastanza contenuto dalla fonte. Riprova o aggiungi più contesto.'}
          </p>
          <div className="space-y-3">
            <Button onClick={onRetry} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Riprova Analisi
            </Button>
            <Button onClick={onCancel} variant="outline" className="w-full">
              Annulla
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Frontend: ComposerModal - Gestione Error + Retry

**File:** `src/components/composer/ComposerModal.tsx`

### Modificare handleIOSQuizOnlyFlow (linee ~600+)

Dopo la chiamata `generateQA`, aggiungere gestione error_code:

```typescript
// Check for validation errors
if (result.error_code) {
  toast.dismiss();
  setQuizData({
    errorState: {
      code: result.error_code,
      message: result.message || 'Errore nell\'analisi'
    },
    onRetry: async () => {
      setShowQuiz(false);
      setQuizData(null);
      // Re-trigger with forceRefresh to clear cache
      await handleRetryWithCacheClear();
    },
    onCancel: () => {
      setShowQuiz(false);
      setQuizData(null);
    }
  });
  setShowQuiz(true);
  return;
}
```

### Aggiungere helper per retry con cache clear (dopo handleIOSQuizOnlyFlow)

```typescript
const handleRetryWithCacheClear = async () => {
  if (!urlPreview?.qaSourceRef || !user) return;
  
  try {
    setIsGeneratingQuiz(true);
    toast.loading('Riprovo l\'analisi con dati freschi…');
    
    const result = await generateQA({
      contentId: null,
      isPrePublish: true,
      title: urlPreview?.title || '',
      qaSourceRef: urlPreview.qaSourceRef,
      sourceUrl: detectedUrl || urlPreview?.url,
      userText: content,
      testMode: getTestModeWithSource(content, !!detectedUrl || !!quotedPost),
      forceRefresh: true, // KEY: Pulisce cache prima del retry
    });
    
    toast.dismiss();
    
    // Handle same error again
    if (result.error_code) {
      toast.error('Impossibile analizzare il contenuto. Prova con un\'altra fonte.');
      setIsGeneratingQuiz(false);
      return;
    }
    
    if (result.error || !result.questions) {
      toast.error('Errore generazione quiz. Riprova più tardi.');
      setIsGeneratingQuiz(false);
      return;
    }
    
    // Success! Show quiz
    setQuizData({
      qaId: result.qaId,
      questions: result.questions,
      sourceUrl: detectedUrl || urlPreview?.url,
    });
    setShowQuiz(true);
    
  } catch (error) {
    toast.dismiss();
    toast.error('Errore durante il retry. Riprova più tardi.');
  } finally {
    setIsGeneratingQuiz(false);
  }
};
```

### Applicare stessa logica a handleReaderComplete e handleMediaGateFlow

Aggiungere gestione error_code + onRetry a tutti i flussi che chiamano generateQA.

---

## 7. Frontend: runGateBeforeAction - Error Handling

**File:** `src/lib/runGateBeforeAction.ts`

### Aggiungere gestione error_code (dopo linea ~56)

```typescript
// Check for validation errors
if (qaData.error_code) {
  console.log('[runGateBeforeAction] Content validation failed:', qaData.error_code);
  if (setQuizData && setShowQuiz) {
    setQuizData({
      errorState: {
        code: qaData.error_code,
        message: qaData.message || 'Analisi non ottimale'
      },
      onRetry: () => runGateBeforeAction({ 
        linkUrl, 
        onSuccess, 
        onCancel, 
        setIsProcessing, 
        setQuizData, 
        setShowQuiz,
        forceRefresh: true  // Retry con cache clear
      }),
      onCancel
    });
    setShowQuiz(true);
  }
  if (setIsProcessing) setIsProcessing(false);
  return;
}
```

### Aggiungere forceRefresh come parametro

```typescript
interface GateOptions {
  linkUrl: string;
  onSuccess: () => void;
  onCancel: () => void;
  setIsProcessing?: (processing: boolean) => void;
  setQuizData?: (data: any) => void;
  setShowQuiz?: (show: boolean) => void;
  intentPostContent?: string;
  forceRefresh?: boolean;  // NEW
}
```

---

## Riepilogo File da Modificare

| File | Modifiche |
|------|-----------|
| `supabase/functions/generate-qa/index.ts` | Pulizia additiva + validateContentQuality + forceRefresh cache invalidation |
| `src/lib/ai-helpers.ts` | Tipi per error_code + forceRefresh param |
| `src/components/ui/quiz-modal.tsx` | errorState prop + UI dedicata con Riprova |
| `src/components/composer/ComposerModal.tsx` | Gestione error_code + handleRetryWithCacheClear |
| `src/lib/runGateBeforeAction.ts` | Gestione error_code + forceRefresh |

---

## Garanzie Anti-Regressione

1. **YouTube/News non toccati**: La pulizia LinkedIn è attivata SOLO per `linkedin.com`
2. **Prompt AI non modificato**: La logica di generazione domande rimane identica
3. **Fail-Open preservato**: Il sistema continua a permettere condivisione se estrazione fallisce completamente
4. **Validazione additiva**: Nuovo layer di validazione non modifica flusso esistente
5. **Cache invalidation chirurgica**: Solo l'URL specifico viene pulito, non tutta la cache

---

## Test Post-Implementazione

1. **LinkedIn**: Testare il link Brexit - domande devono riguardare il contenuto reale
2. **Retry**: Verificare che "Riprova Analisi" pulisca la cache e faccia nuovo scraping
3. **YouTube**: Verificare nessuna regressione su video
4. **Spotify**: Verificare nessuna regressione su brani
5. **Pubblica bloccato**: Verificare che il pulsante sia disabilitato senza quiz completato

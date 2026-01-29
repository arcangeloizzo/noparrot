

# Piano di Implementazione: Fix Completo del Gate per Reshare

## Obiettivo
Ripristinare il comportamento "Fail-Closed" del Gate su tutti i reshare. Il sistema deve:
1. Sempre trovare la fonte originale (anche per catene profonde)
2. Mai permettere la condivisione senza quiz completato
3. Gestire correttamente "Il Punto" (focus://daily/...) come sorgente editoriale
4. Mostrare errore chiaro quando il contenuto non è valutabile

---

## Analisi del Problema Attuale

### Punti Critici Identificati

**1. Deep Lookup Funziona SOLO come Hook React**
- `useOriginalSource` è un hook che usa React Query
- Richiede che il componente sia montato e la query sia completata
- Al click su "Condividi", `originalSource` potrebbe essere `undefined` se la query non è finita

**2. `handleReaderComplete` Ha un Bypass Pericoloso (righe 744-749)**
```typescript
if (result.insufficient_context) {
  toast({ title: 'Contenuto troppo breve', description: 'Puoi comunque condividere questo post' });
  await closeReaderSafely();
  onQuoteShare?.(post);  // ❌ BYPASS - permette share senza quiz
  return;
}
```

**3. focus://daily/... Viene Trattato come URL Esterno**
- `fetchArticlePreview` ritorna `{ success: false, isInternal: true }` per focus://
- Ma `startComprehensionGate` non gestisce questo caso → reader vuoto

**4. generateQA Riceve `qaSourceRef` Incompleto**
- Per reshare esterni, il sistema passa `qaSourceRef` ma potrebbe non avere contenuto
- Backend ritorna `insufficient_context` → bypass attuale permette share

---

## Implementazione

### File da Modificare
`src/components/feed/ImmersivePostCard.tsx`

---

### 1. Aggiungere Funzione "On-Demand Deep Lookup" (Nuovo Codice)

Posizione: dopo le importazioni (circa riga 72), aggiungere una funzione imperativa che fa lo stesso lavoro di `useOriginalSource` ma senza dipendere da React Query:

```typescript
// Deep lookup imperativo per risolvere la fonte originale al click
const resolveOriginalSourceOnDemand = async (quotedPostId: string | null): Promise<{
  url: string;
  title: string | null;
  image: string | null;
  articleContent?: string;
} | null> => {
  if (!quotedPostId) return null;
  
  let currentId: string | null = quotedPostId;
  let depth = 0;
  const MAX_DEPTH = 10;

  while (currentId && depth < MAX_DEPTH) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, shared_url, shared_title, preview_img, quoted_post_id, article_content')
      .eq('id', currentId)
      .single();

    if (error || !data) break;

    // Found a post with a source URL
    if (data.shared_url) {
      return {
        url: data.shared_url,
        title: data.shared_title,
        image: data.preview_img,
        articleContent: data.article_content,
      };
    }

    // Move to the next ancestor
    currentId = data.quoted_post_id;
    depth++;
  }

  return null;
};
```

---

### 2. Modificare `startComprehensionGate` per Usare Deep Lookup On-Demand

Posizione: righe 576-652

**PRIMA (problema):**
```typescript
const startComprehensionGate = async () => {
  // Use finalSourceUrl to include sources from quoted posts and deep chains
  if (!finalSourceUrl || !user) return;
  // ...
```

**DOPO (fix):**
```typescript
const startComprehensionGate = async () => {
  if (!user) return;

  // On-demand deep lookup: garantisce di avere la fonte anche se hook non ha finito
  let resolvedSourceUrl = finalSourceUrl;
  let resolvedArticleContent: string | undefined;
  
  if (!resolvedSourceUrl && post.quoted_post_id) {
    toast({ title: 'Caricamento fonte originale...' });
    const deepSource = await resolveOriginalSourceOnDemand(post.quoted_post_id);
    if (deepSource?.url) {
      resolvedSourceUrl = deepSource.url;
      resolvedArticleContent = deepSource.articleContent || undefined;
    }
  }
  
  if (!resolvedSourceUrl) {
    // Nessuna fonte trovata nella catena - questo non dovrebbe succedere
    // ma fail-closed: non permettiamo share
    toast({ 
      title: 'Impossibile trovare la fonte', 
      description: 'Non è possibile condividere questo contenuto.',
      variant: 'destructive' 
    });
    setShareAction(null);
    return;
  }

  // === GESTIONE ESPLICITA PER "Il Punto" (focus://daily/...) ===
  if (resolvedSourceUrl.startsWith('focus://daily/')) {
    const focusId = resolvedSourceUrl.replace('focus://daily/', '');
    
    // Fetch contenuto editoriale dal DB
    let editorialContent = resolvedArticleContent;
    let editorialTitle = 'Il Punto';
    
    if (!editorialContent || editorialContent.length < 50) {
      const { data } = await supabase
        .from('daily_focus')
        .select('title, deep_content, summary')
        .eq('id', focusId)
        .maybeSingle();
      
      if (data) {
        editorialTitle = data.title || 'Il Punto';
        // Pulisci markers [SOURCE:N] dal contenuto
        editorialContent = (data.deep_content || data.summary || '')
          .replace(/\[SOURCE:[\d,\s]+\]/g, '')
          .trim();
      }
    }
    
    if (!editorialContent || editorialContent.length < 50) {
      toast({ 
        title: 'Contenuto editoriale non disponibile', 
        variant: 'destructive' 
      });
      setShareAction(null);
      return;
    }
    
    // Apri reader con contenuto editoriale reale
    setReaderSource({
      id: focusId,
      state: 'reading' as const,
      url: `editorial://${focusId}`,  // Usa editorial:// per il quiz
      title: editorialTitle,
      content: editorialContent,
      articleContent: editorialContent,
      summary: editorialContent.substring(0, 200),
      isEditorial: true,
      platform: 'article',
      contentQuality: 'complete',
    });
    setShowReader(true);
    return;
  }

  // Resto della logica esistente per URL esterni...
  try {
    const host = new URL(resolvedSourceUrl).hostname.toLowerCase();
    // ... (codice esistente per blocked platforms, Intent posts, etc.)
```

---

### 3. Modificare `handleReaderComplete` per Rimuovere Bypass (FAIL-CLOSED)

Posizione: righe 671-782

**Problema attuale (riga 744-749):**
```typescript
if (result.insufficient_context) {
  toast({ title: 'Contenuto troppo breve', description: 'Puoi comunque condividere questo post' });
  await closeReaderSafely();
  onQuoteShare?.(post);  // ❌ BYPASS
  return;
}
```

**FIX (fail-closed per fonti esterne):**
```typescript
if (result.insufficient_context) {
  // FAIL-CLOSED: per fonti esterne, bloccare la condivisione
  // Solo per post originali (post://) permettiamo il fallback
  const isOriginalPost = readerSource.isOriginalPost;
  
  if (isOriginalPost) {
    // Post originale troppo breve - ok, può condividere
    toast({ title: 'Contenuto troppo breve', description: 'Puoi condividere questo post' });
    await closeReaderSafely();
    onQuoteShare?.(post);
    return;
  } else {
    // Fonte esterna non valutabile - BLOCCARE
    toast({ 
      title: 'Impossibile verificare la fonte', 
      description: 'Non è stato possibile generare il test. Apri la fonte originale per verificarla.',
      variant: 'destructive' 
    });
    setReaderLoading(false);
    // NON chiamare onQuoteShare - la share è bloccata
    return;
  }
}
```

---

### 4. Gestire Reader Vuoto con Messaggio Chiaro

Posizione: Componente `SourceReaderGate` (verifica se già gestisce questo caso)

Nel `handleReaderComplete`, aggiungere check per contenuto vuoto prima di chiamare generateQA:

```typescript
const handleReaderComplete = async () => {
  if (!readerSource || !user) return;
  setGateStep('reader:loading');
  setReaderLoading(true);

  try {
    // Check contenuto minimo per fonti esterne
    if (!readerSource.isOriginalPost && !readerSource.isIntentPost) {
      const hasContent = readerSource.content || readerSource.summary || readerSource.articleContent;
      if (!hasContent || hasContent.length < 50) {
        toast({ 
          title: 'Contenuto non disponibile', 
          description: 'Apri la fonte originale per leggerla.',
          variant: 'destructive' 
        });
        setReaderLoading(false);
        return;  // Non permettere di proseguire
      }
    }
    
    // ... resto del codice esistente
```

---

### 5. Fix generateQA per Editorial (Legacy Mode)

Nella chiamata a `generateQA` dentro `handleReaderComplete`, aggiungere supporto per editorial:

```typescript
// Per contenuti editoriali, usare legacy mode con summary
const isEditorial = readerSource.isEditorial || readerSource.url?.startsWith('editorial://');

const result = await generateQA({
  contentId: isEditorial ? readerSource.id : post.id,
  title: readerSource.title,
  // Per editorial, passare summary (legacy mode) invece di qaSourceRef
  summary: isEditorial ? readerSource.articleContent : (isOriginalPost ? fullContent : undefined),
  qaSourceRef: (!isOriginalPost && !isEditorial) ? readerSource.qaSourceRef : undefined,
  userText: userText || '',
  sourceUrl: isOriginalPost ? undefined : readerSource.url,
  testMode: isEditorial ? 'SOURCE_ONLY' : testMode,
  questionCount: isEditorial ? 3 : questionCount,
});
```

---

## Riepilogo Modifiche

| Riga | Modifica |
|------|----------|
| ~72 | Aggiungere `resolveOriginalSourceOnDemand()` |
| 576-652 | Riscrivere `startComprehensionGate` con deep lookup + supporto focus:// |
| 671-682 | Aggiungere check contenuto minimo in `handleReaderComplete` |
| 744-749 | Rimuovere bypass `insufficient_context` per fonti esterne |
| 733-742 | Aggiungere supporto legacy mode per editorial in `generateQA` call |

---

## Comportamento Atteso Dopo il Fix

| Scenario | Comportamento |
|----------|---------------|
| **Reshare Spotify** | Deep lookup → Reader → Quiz → Share (o blocco se lyrics assenti) |
| **Reshare Il Punto** | Deep lookup → Reader con contenuto editoriale → Quiz legacy → Share |
| **Reshare Link Web** | Deep lookup → Reader iframe → Quiz → Share (o blocco se estrazione fallita) |
| **Reshare LinkedIn** | Deep lookup → Reader → Quiz → Share (o blocco se contenuto vuoto) |
| **Catena reshare** | Deep lookup risolve fonte originale → flusso normale |
| **Fonte non trovata** | Toast errore, share bloccata |

---

## Note Tecniche

### Perché "On-Demand" invece di aspettare l'Hook?
- L'hook `useOriginalSource` usa React Query che è asincrono
- Al click su "Condividi", la query potrebbe non essere completata
- Il lookup on-demand è sincrono rispetto al click: garantisce di avere la fonte

### Perché "Fail-Closed"?
- L'utente sta ricondividendo contenuto già nel feed
- Se il Gate non riesce a valutare, qualcosa non va
- Meglio bloccare (sicuro) che permettere share non verificate

### Editorial vs External URL
- `focus://daily/...` → contenuto interno, già nel DB → legacy mode con summary
- URL esterno → deve passare per `fetchArticlePreview` → qaSourceRef mode


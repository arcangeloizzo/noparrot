
# Piano di Risoluzione: 4 Problemi Critici del Gate System

## Panoramica dei Problemi Identificati

| # | Problema | Causa Root | File Coinvolti |
|---|----------|------------|----------------|
| 1 | 400 Bad Request su `submit-qa` | Validazione UUID su IDs che sono stringhe (`q1`, `a`) | `submit-qa/index.ts` |
| 2 | Blocco share per `insufficient_context` | Policy fail-closed troppo restrittiva | `ImmersivePostCard.tsx` |
| 3 | Crash 500 su `editorial://` | Nessun fallback server-side per contenuti editoriali | `generate-qa/index.ts` |
| 4 | LinkedIn bloccato da CSP | Non incluso in `isBlockedPlatform` | `ImmersivePostCard.tsx` |

---

## Problema 1: Validazione UUID Errata (CRITICAL FIX)

### Diagnosi
I log mostrano chiaramente il problema:
```
[submit-qa] Invalid questionId format: q1
```

La funzione `isValidUuid` (linee 20-23) richiede formato UUID:
```typescript
/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
```

Ma i dati reali nel database hanno formato semplice:
```json
{
  "id": "q1",
  "choices": [{"id": "a"}, {"id": "b"}, {"id": "c"}],
  "correctId": "b"
}
```

### Soluzione
Creare una funzione di validazione specifica per questionId e choiceId:

```typescript
// Validates short IDs like "q1", "q2", "q3" and "a", "b", "c"
function isValidShortId(id: unknown): id is string {
  if (!id || typeof id !== 'string') return false;
  // Question IDs: q1, q2, q3, etc.
  // Choice IDs: a, b, c
  return /^(q[1-9]|[a-c])$/i.test(id);
}
```

Sostituire la validazione alle linee 108-124 per usare questa funzione invece di `isValidUuid`.

---

## Problema 2: Fail-Open per `insufficient_context`

### Diagnosi
Attualmente (linee 920-930) se la generazione quiz fallisce per una fonte esterna, la condivisione viene BLOCCATA:

```typescript
if (result.insufficient_context) {
  if (isOriginalPost) {
    // Post originale - allow share
    onQuoteShare?.(post);
  } else {
    // Fonte esterna - BLOCCO
    toast({ title: 'Impossibile verificare la fonte', variant: 'destructive' });
    return; // Share bloccata
  }
}
```

### Soluzione
Modificare per permettere la condivisione con un warning:

```typescript
if (result.insufficient_context) {
  if (isOriginalPost) {
    // Post originale - allow share
    toast({ title: 'Contenuto troppo breve', description: 'Puoi condividere questo post' });
  } else {
    // Fonte esterna - ALLOW con warning (Fail-Open)
    console.warn('[Gate] External source insufficient - allowing share with warning');
    toast({ 
      title: 'Impossibile generare il quiz', 
      description: 'Condivisione consentita senza verifica.'
    });
  }
  await closeReaderSafely();
  onQuoteShare?.(post);
  return;
}
```

---

## Problema 3: Crash 500 su Editorial URLs

### Diagnosi
Quando `sourceUrl` inizia con `editorial://`, la funzione non ha un handler specifico. Se il `summary` è vuoto (non passato dal client), il contenuto risulta insufficiente e può causare errori.

### Soluzione
Aggiungere un handler specifico per `editorial://` che recupera il contenuto dalla tabella `daily_focus`:

```typescript
// Handle editorial:// URLs - fetch content from daily_focus
if (sourceUrl?.startsWith('editorial://')) {
  const focusId = sourceUrl.replace('editorial://', '');
  console.log(`[generate-qa] 📰 Editorial content, fetching from daily_focus: ${focusId}`);
  
  const { data: focusData } = await supabase
    .from('daily_focus')
    .select('title, summary, deep_content')
    .eq('id', focusId)
    .maybeSingle();
  
  if (focusData) {
    const editorialContent = focusData.deep_content || focusData.summary || '';
    // Clean [SOURCE:N] markers
    serverSideContent = editorialContent.replace(/\[SOURCE:[\d,\s]+\]/g, '').trim();
    contentSource = 'daily_focus';
    console.log(`[generate-qa] ✅ Editorial content: ${serverSideContent.length} chars`);
  }
}
```

Questo va aggiunto dopo il blocco `switch (qaSourceRef.kind)` e prima del check `if (contentText.length < 50)`.

---

## Problema 4: LinkedIn come Piattaforma Bloccata

### Diagnosi
La lista `isBlockedPlatform` (linea 695) include solo Instagram e Facebook:

```typescript
const isBlockedPlatform = host.includes('instagram.com') || 
  host.includes('facebook.com') || host.includes('m.facebook.com') || 
  host.includes('fb.com') || host.includes('fb.watch');
```

LinkedIn causa problemi di CSP nell'iframe ma non è gestito.

### Soluzione
Aggiungere LinkedIn alla lista:

```typescript
const isBlockedPlatform = host.includes('instagram.com') || 
  host.includes('facebook.com') || host.includes('m.facebook.com') || 
  host.includes('fb.com') || host.includes('fb.watch') ||
  host.includes('linkedin.com');
```

---

## Riepilogo Modifiche File

### File: `supabase/functions/submit-qa/index.ts`
1. Aggiungere funzione `isValidShortId()` 
2. Sostituire validazione alle linee 108-124 per usare `isValidShortId` invece di `isValidUuid` per questionId/choiceId

### File: `supabase/functions/generate-qa/index.ts`  
1. Aggiungere handler per `editorial://` URLs dopo la linea 379 (post-qaSourceRef switch)
2. Fetch da tabella `daily_focus` usando focusId estratto

### File: `src/components/feed/ImmersivePostCard.tsx`
1. Linea 695: Aggiungere `host.includes('linkedin.com')` alla condizione `isBlockedPlatform`
2. Linee 920-930: Convertire logica da Fail-Closed a Fail-Open per fonti esterne

---

## Ordine di Implementazione

1. **submit-qa** (Critical) - Fix validazione ID
2. **generate-qa** (Critical) - Handler editorial
3. **ImmersivePostCard** - Fail-Open + LinkedIn
4. **Deploy Edge Functions** - Automatico dopo modifiche

---

## Verifica Post-Implementazione

1. Test condivisione post con link articolo (Il Post)
2. Test quiz su contenuto editoriale "Il Punto"
3. Test link LinkedIn (deve aprire in nuovo tab)
4. Test risposta quiz corretta (deve passare)

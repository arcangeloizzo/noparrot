
# Piano Completo: Fix Reshare Carousel (Gate + UI)

## Problema

Quando un utente ricondivide un post con carousel:

1. **Gate rotto**: Il sistema tenta di generare un NUOVO quiz invece di riutilizzare quello dell'autore originale
2. **UI incompleta**: `QuotedPostCard` non renderizza i media del post quotato

### Flusso attuale (sbagliato)

```text
Utente A pubblica carousel → Passa test OCR → Post salvato con quiz ID
                                                        ↓
Utente B ricondivide → generate-qa con isPrePublish:true
                                                        ↓
                     ❌ Strategy 2 (post_id) saltata perché isPrePublish=true
                     ❌ Strategy 1/3 falliscono perché non c'è source_url
                                                        ↓
                     Genera NUOVO quiz → OCR < 150 chars → ERRORE
                                                        ↓
                     Fail-open: "Test non disponibile. Puoi pubblicare comunque."
                                                        ↓
                     Post pubblicato MA carousel non visibile (UI mancante)
```

### Flusso corretto (da implementare)

```text
Utente A pubblica carousel → Passa test OCR → Post salvato con quiz ID
                                                        ↓
Utente B ricondivide → Lookup quiz per quoted_post_id
                                                        ↓
                     ✅ Trova quiz originale di Utente A
                                                        ↓
                     Mostra STESSO test → Utente B passa
                                                        ↓
                     Post pubblicato E carousel visibile
```

---

## Parte 1: Fix Logica Gate (Backend + Frontend)

### 1.1 Modificare `generate-qa/index.ts` - Nuova Strategy per Reshare

Aggiungere una **Strategy 2.5**: lookup by `quoted_post_id` quando siamo in un reshare.

**Parametri da aggiungere alla richiesta:**
- `quotedPostId?: string` - ID del post originale che si sta ricondividendo

**Nuova logica (dopo Strategy 2, prima di Strategy 3):**

```typescript
// Strategy 2.5: Reshare lookup - find quiz from original post being shared
if (!existing && quotedPostId) {
  console.log('[generate-qa] Reshare detected, looking for original post quiz:', quotedPostId);
  
  const { data: reshareMatch } = await supabase
    .from('post_qa_questions')
    .select('id, questions, content_hash, test_mode, owner_id, post_id')
    .eq('post_id', quotedPostId)
    .limit(1)
    .maybeSingle();
  
  if (reshareMatch) {
    console.log('[generate-qa] ✅ Found RESHARE quiz from original post:', reshareMatch.id);
    existing = reshareMatch;
    // Force cache hit - resharer takes same test as original author
  }
}
```

**Rimuovere fail-open per reshare**: Se il quiz originale esiste, deve essere usato. Se non esiste (edge case), allora può scattare il fallback.

### 1.2 Modificare `ComposerModal.tsx` - Passare quotedPostId

Nella funzione `handleQuotedMediaGateFlow` (riga 754), modificare la chiamata a `generateQA`:

```typescript
const result = await generateQA({
  contentId: quotedPost?.id || null,
  quotedPostId: quotedPost?.id, // ← NUOVO: ID del post originale
  isPrePublish: true,
  // ... resto invariato
});
```

Stessa modifica per `handleReshareTextOnlyGateFlow` (riga 832).

### 1.3 Modificare `src/lib/comprehension-gate.tsx` o hook equivalente

Aggiungere `quotedPostId` ai parametri della funzione `generateQA`:

```typescript
interface GenerateQAParams {
  // ... esistenti
  quotedPostId?: string; // ID del post che si sta ricondividendo
}
```

### 1.4 Rimuovere fail-open per reshare

In `ComposerModal.tsx` riga 801-809, modificare il comportamento:

```typescript
if (result.error || !result.questions) {
  // Se è un reshare e il quiz originale non esiste, è un bug (non dovrebbe succedere)
  if (quotedPost?.id) {
    console.error('[ComposerModal] Reshare quiz lookup failed - this should not happen');
    toast.error('Impossibile recuperare il test originale. Riprova.');
    setIsGeneratingQuiz(false);
    return; // ← NON permettere pubblicazione senza test
  }
  
  // Per post originali (non reshare), mantieni fail-open
  toast.warning('Test non disponibile. Puoi pubblicare comunque.');
  await publishPost();
  return;
}
```

---

## Parte 2: Fix UI QuotedPostCard

### 2.1 Estendere interfaccia in `QuotedPostCard.tsx`

```typescript
interface QuotedPost {
  id: string;
  content: string;
  created_at: string;
  shared_url?: string | null;
  shared_title?: string | null;
  preview_img?: string | null;
  sources?: string[];
  is_intent?: boolean;
  author: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  // NUOVO
  media?: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail_url?: string | null;
  }>;
}
```

### 2.2 Aggiungere rendering media

Dopo il contenuto testuale, aggiungere gallery compatta:

```tsx
{/* Media Gallery */}
{quotedPost.media && quotedPost.media.length > 0 && (
  <div className="mt-2 rounded-lg overflow-hidden">
    {quotedPost.media.length === 1 ? (
      // Singola immagine/video
      quotedPost.media[0].type === 'video' ? (
        <video 
          src={quotedPost.media[0].url}
          poster={quotedPost.media[0].thumbnail_url || undefined}
          className="w-full max-h-32 object-cover rounded-lg"
        />
      ) : (
        <img 
          src={quotedPost.media[0].url}
          alt=""
          className="w-full max-h-32 object-cover rounded-lg"
        />
      )
    ) : (
      // Grid 2x2 per carousel
      <div className="grid grid-cols-2 gap-1">
        {quotedPost.media.slice(0, 4).map((m, idx) => (
          <div key={m.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
            {m.type === 'video' ? (
              <video 
                src={m.url}
                poster={m.thumbnail_url || undefined}
                className="w-full h-full object-cover"
              />
            ) : (
              <img 
                src={m.url}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
            {idx === 3 && quotedPost.media!.length > 4 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  +{quotedPost.media!.length - 4}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

---

## File da modificare

| File | Modifica |
|------|----------|
| `supabase/functions/generate-qa/index.ts` | Aggiungere Strategy 2.5 per reshare lookup |
| `src/lib/comprehension-gate.tsx` | Aggiungere `quotedPostId` ai parametri |
| `src/components/composer/ComposerModal.tsx` | Passare `quotedPostId` e rimuovere fail-open per reshare |
| `src/components/feed/QuotedPostCard.tsx` | Aggiungere supporto media e gallery |

---

## Comportamento finale

| Scenario | Prima | Dopo |
|----------|-------|------|
| Reshare carousel con OCR < 150 | Toast "Test non disponibile", pubblica vuoto | Usa quiz originale, mostra carousel |
| Reshare post testuale | Genera nuovo quiz (può fallire) | Riutilizza quiz dell'autore originale |
| Post originale con media scarso | Fail-open (OK) | Invariato (fail-open mantenuto) |
| QuotedPostCard con media | Non renderizza | Grid 2x2 o singola immagine |

---

## Note di sicurezza

- Il resharer DEVE passare lo stesso test dell'autore originale
- Non c'è bypass: se il quiz originale non viene trovato, la condivisione viene bloccata
- Questo garantisce che chi diffonde contenuti abbia la stessa comprensione di chi li ha pubblicati
